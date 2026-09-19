import { createHash } from 'node:crypto';

// Internal archive format, not an authorization boundary or a database restore.
// The reader must supply all schools and unfiltered history from one snapshot.
export const requiredDatasets = Object.freeze([
  'schools', 'attendance_students', 'attendance_pair_enrollments', 'attendance_pairs',
  'attendance_sessions', 'attendance_records', 'sections', 'gradebooks',
  'gradebook_students', 'gradebook_categories', 'gradebook_statuses', 'gradebook_items',
  'gradebook_attempts', 'gradebook_revisions', 'gradebook_finalizations',
  'tower_student_ids', 'tower_records', 'tower_history', 'tower_grade_links',
  'tower_permanent_tests', 'tower_certificates', 'classroom_sessions',
  'classroom_submissions', 'job_card_sessions', 'job_card_submissions',
]);

const bookTables = new Set(requiredDatasets.filter((name) => name.startsWith('gradebook_')
  || ['tower_records', 'tower_history', 'tower_grade_links', 'tower_permanent_tests', 'tower_certificates'].includes(name)));
const directTables = new Set(['attendance_students', 'attendance_pair_enrollments', 'attendance_pairs',
  'attendance_sessions', 'attendance_records', 'sections', 'classroom_sessions', 'job_card_sessions', 'job_card_submissions']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hashPattern = /^[0-9a-f]{64}$/;
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const encode = (value) => Buffer.from(JSON.stringify(value));
function check(ok, message) { if (!ok) throw new Error(message); }

function index(rows, field = 'id') {
  const values = new Map();
  for (const row of rows) {
    check(row[field] !== undefined && row[field] !== null, 'Missing record identity.');
    const key = String(row[field]);
    check(!values.has(key), 'Duplicate record identity.');
    values.set(key, row);
  }
  return values;
}

export function validateSnapshot(snapshot) {
  check(snapshot?.format === 'ltg-student-snapshot-v1', 'Unsupported snapshot format.');
  check(uuid.test(snapshot.exportId) && typeof snapshot.capturedAt === 'string'
    && Number.isFinite(Date.parse(snapshot.capturedAt)), 'Invalid snapshot identity or timestamp.');
  check(['staging', 'production'].includes(snapshot.environment), 'Unknown source environment.');
  check(typeof snapshot.sourceRevision === 'string' && /^[0-9a-f]{40}$/.test(snapshot.sourceRevision), 'Missing source code revision.');
  check(snapshot.scope === 'all-schools' && snapshot.consistency === 'repeatable-read', 'A consistent all-school snapshot is required.');
  const data = snapshot.datasets;
  check(data && Object.keys(data).length === requiredDatasets.length, 'Unexpected or missing datasets.');
  for (const table of requiredDatasets) {
    check(Array.isArray(data[table]), `Missing dataset: ${table}.`);
    check(Number.isSafeInteger(snapshot.sourceCounts?.[table]) && snapshot.sourceCounts[table] === data[table].length,
      `Incomplete dataset: ${table}.`);
    const keyFields = ({ gradebook_students: ['gradebook_id', 'student_id'],
      gradebook_statuses: ['gradebook_id', 'code'], tower_student_ids: ['student_id'],
      tower_records: ['gradebook_id', 'student_id'],
      tower_grade_links: ['gradebook_id', 'student_id', 'assignment_id', 'attempt_number'] })[table] ?? ['id'];
    const keys = new Set();
    for (const row of data[table]) {
      check(row && typeof row === 'object' && !Array.isArray(row), 'Invalid record.');
      check(keyFields.every((key) => row[key] !== undefined && row[key] !== null), 'Missing record identity.');
      const key = JSON.stringify(keyFields.map((field) => String(row[field])));
      check(!keys.has(key), 'Duplicate record identity.');
      keys.add(key);
    }
  }
  const schools = index(data.schools);
  check(schools.size > 0 && [...schools.keys()].every((id) => uuid.test(id)), 'Invalid school inventory.');
  check(Array.isArray(snapshot.expectedSchoolIds)
    && snapshot.expectedSchoolIds.length === schools.size
    && new Set(snapshot.expectedSchoolIds).size === schools.size
    && snapshot.expectedSchoolIds.every((id) => schools.has(id)), 'School inventory does not reconcile.');
  const students = index(data.attendance_students);
  const sections = index(data.sections);
  const books = index(data.gradebooks);
  const sessions = index(data.classroom_sessions);
  const jobs = index(data.job_card_sessions);
  const attendance = index(data.attendance_sessions);
  const pairs = index(data.attendance_pairs);
  const items = index(data.gradebook_items);
  const categories = index(data.gradebook_categories);
  const attempts = index(data.gradebook_attempts);
  const tests = index(data.tower_permanent_tests);
  const submissions = index(data.classroom_submissions);
  const owners = new Map();
  const owner = (table, row) => {
    if (table === 'schools') return row.id;
    if (directTables.has(table)) return row.school_id;
    if (table === 'gradebooks') return sections.get(row.section_id)?.school_id;
    if (bookTables.has(table)) return sections.get(books.get(row.gradebook_id)?.section_id)?.school_id;
    if (table === 'tower_student_ids') return students.get(row.student_id)?.school_id;
    if (table === 'classroom_submissions') return sessions.get(row.classroom_session_id)?.school_id;
    throw new Error('Unclassified dataset.');
  };
  const sameSchool = (expected, actual) => check(actual && actual === expected, 'Missing or cross-school relationship.');
  const sameBook = (row, parent) => check(parent && parent.gradebook_id === row.gradebook_id, 'Missing or cross-gradebook relationship.');
  for (const table of requiredDatasets) for (const row of data[table]) {
    check(row && typeof row === 'object' && !Array.isArray(row), 'Invalid record.');
    check(!Object.hasOwn(row, 'join_code'), 'Session access codes must not be archived.');
    const school = owner(table, row);
    check(schools.has(school), 'Record has no known school.');
    owners.set(row, school);
    if (row.student_id != null && table !== 'classroom_submissions' && table !== 'job_card_submissions') {
      sameSchool(school, students.get(row.student_id)?.school_id);
    }
    if (['classroom_submissions', 'job_card_submissions'].includes(table)) {
      check(row.student_uuid, 'Unresolved legacy student identity; archive remains incomplete.');
      sameSchool(school, students.get(row.student_uuid)?.school_id);
    }
    if (table === 'classroom_sessions' || table === 'job_card_sessions') sameSchool(school, sections.get(row.section_id)?.school_id);
    if (table === 'job_card_submissions') sameSchool(school, jobs.get(row.job_card_session_id)?.school_id);
    if (table === 'attendance_pairs') {
      sameSchool(school, sections.get(row.primary_section_id)?.school_id);
      if (row.completion_section_id != null) sameSchool(school, sections.get(row.completion_section_id)?.school_id);
    }
    if (table === 'attendance_sessions' || table === 'attendance_pair_enrollments') sameSchool(school, pairs.get(row.pair_id)?.school_id);
    if (table === 'attendance_records') sameSchool(school, attendance.get(row.session_id)?.school_id);
    if (table === 'gradebook_items') sameBook(row, categories.get(row.category_id));
    if (table === 'gradebook_attempts') {
      sameBook(row, items.get(row.item_id));
      if (row.source_submission_id != null) {
        const submission = submissions.get(row.source_submission_id);
        check(submission?.student_uuid === row.student_id, 'Attempt source student does not match.');
        sameSchool(school, sessions.get(submission.classroom_session_id)?.school_id);
      }
    }
    if (table === 'gradebook_revisions' || table === 'tower_grade_links') {
      const attempt = attempts.get(row.attempt_id);
      sameBook(row, attempt);
      if (table === 'tower_grade_links') check(attempt.student_id === row.student_id, 'Tower attempt student does not match.');
    }
    if (table === 'tower_certificates') {
      const source = tests.get(row.test_id);
      sameBook(row, source);
      check(source.student_id === row.student_id, 'Certificate student does not match.');
    }
  }
  check(Array.isArray(snapshot.files) && Array.isArray(snapshot.fileInventory), 'Missing attachment inventory.');
  const inventory = index(snapshot.fileInventory);
  const files = index(snapshot.files);
  check(files.size === inventory.size, 'Missing or unexpected attachment.');
  for (const [id, entry] of inventory) {
    const file = files.get(id);
    check(schools.has(entry.schoolId) && file?.schoolId === entry.schoolId, 'Attachment school does not match.');
    check(typeof entry.sourceVersion === 'string' && entry.sourceVersion.length > 0
      && file.sourceVersion === entry.sourceVersion, 'Attachment source version does not match.');
    check(hashPattern.test(entry.sha256) && typeof file.base64 === 'string', 'Invalid attachment digest or content.');
    const bytes = Buffer.from(file.base64, 'base64');
    check(bytes.toString('base64') === file.base64 && entry.bytes === bytes.length && sha256(bytes) === entry.sha256,
      'Attachment content failed verification.');
  }
  return { owners, schoolIds: [...schools.keys()] };
}

export function buildSchoolBundles(snapshot) {
  const { owners, schoolIds } = validateSnapshot(snapshot);
  return schoolIds.map((schoolId) => {
    const datasets = Object.fromEntries(requiredDatasets.map((name) => [name, snapshot.datasets[name].filter((row) => owners.get(row) === schoolId)]));
    const files = snapshot.files.filter((file) => file.schoolId === schoolId);
    const fileInventory = snapshot.fileInventory.filter((file) => file.schoolId === schoolId);
    const payload = { format: 'ltg-school-record-bundle-v1', exportId: snapshot.exportId, schoolId,
      environment: snapshot.environment, capturedAt: snapshot.capturedAt, sourceRevision: snapshot.sourceRevision,
      // Context, audit history and full DB restore are separate acceptance gates.
      completeness: 'core-records-only', datasets, files, fileInventory };
    const manifest = requiredDatasets.map((name) => ({ dataset: name, rows: datasets[name].length,
      bytes: encode(datasets[name]).length, sha256: sha256(encode(datasets[name])) }));
    const bytes = encode({ payload, manifest });
    return { schoolId, exportId: snapshot.exportId, bytes, sha256: sha256(bytes) };
  });
}

// expectedDigest must come from an independently protected receipt, not from the
// same downloaded object. This function neither runs SQL nor writes file paths.
export function recoverSchoolBundle(bytes, { expectedDigest, schoolId, exportId }) {
  check(hashPattern.test(expectedDigest) && sha256(bytes) === expectedDigest, 'Bundle digest does not match trusted receipt.');
  const { payload, manifest } = JSON.parse(bytes.toString('utf8'));
  check(payload?.format === 'ltg-school-record-bundle-v1' && payload.schoolId === schoolId
    && payload.exportId === exportId && payload.completeness === 'core-records-only', 'Unexpected archive identity.');
  check(Array.isArray(manifest) && manifest.length === requiredDatasets.length, 'Incomplete manifest.');
  for (const name of requiredDatasets) {
    const entries = manifest.filter((entry) => entry.dataset === name);
    check(entries.length === 1, 'Duplicate or missing manifest entry.');
    const content = encode(payload.datasets[name]);
    check(entries[0].rows === payload.datasets[name].length && entries[0].bytes === content.length
      && entries[0].sha256 === sha256(content), 'Dataset failed recovery verification.');
  }
  validateSnapshot({ ...payload, format: 'ltg-student-snapshot-v1', scope: 'all-schools',
    consistency: 'repeatable-read', expectedSchoolIds: [schoolId],
    sourceCounts: Object.fromEntries(manifest.map((entry) => [entry.dataset, entry.rows])) });
  return payload;
}

