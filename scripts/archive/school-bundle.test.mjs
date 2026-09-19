import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requiredDatasets, sha256, buildSchoolBundles, recoverSchoolBundle } from './school-bundle.mjs';

const schoolA = '10000000-0000-4000-8000-000000000001';
const schoolB = '10000000-0000-4000-8000-000000000002';
function fixture() {
  const datasets = Object.fromEntries(requiredDatasets.map((name) => [name, []]));
  for (const [suffix, school] of [['a', schoolA], ['b', schoolB]]) {
    datasets.schools.push({ id: school, name: `Synthetic school ${suffix}` });
    datasets.attendance_students.push({ id: `student-${suffix}`, school_id: school, active: false });
    datasets.sections.push({ id: `section-${suffix}`, school_id: school });
    datasets.gradebooks.push({ id: `book-${suffix}`, section_id: `section-${suffix}` });
    datasets.gradebook_students.push({ gradebook_id: `book-${suffix}`, student_id: `student-${suffix}`, active: false });
    datasets.gradebook_categories.push({ id: `category-${suffix}`, gradebook_id: `book-${suffix}` });
    datasets.gradebook_items.push({ id: `item-${suffix}`, gradebook_id: `book-${suffix}`, category_id: `category-${suffix}` });
    datasets.gradebook_attempts.push({ id: `attempt-${suffix}`, gradebook_id: `book-${suffix}`, item_id: `item-${suffix}`, student_id: `student-${suffix}` });
    for (const revision of [1, 2]) datasets.gradebook_revisions.push({ id: `${suffix}-${revision}`, gradebook_id: `book-${suffix}`, attempt_id: `attempt-${suffix}`, score: revision === 1 ? 0 : 76 });
    datasets.gradebook_finalizations.push({ id: `final-${suffix}`, gradebook_id: `book-${suffix}`, student_id: `student-${suffix}`, snapshot: { grade: 76 } });
    datasets.tower_permanent_tests.push({ id: `test-${suffix}`, gradebook_id: `book-${suffix}`, student_id: `student-${suffix}` });
    datasets.tower_certificates.push({ id: `cert-${suffix}`, test_id: `test-${suffix}`, gradebook_id: `book-${suffix}`, student_id: `student-${suffix}`, snapshot: { synthetic: true } });
    datasets.attendance_pairs.push({ id: `pair-${suffix}`, school_id: school, primary_section_id: `section-${suffix}` });
    datasets.attendance_sessions.push({ id: `attendance-${suffix}`, school_id: school, pair_id: `pair-${suffix}` });
    datasets.attendance_records.push({ id: `record-${suffix}`, school_id: school, session_id: `attendance-${suffix}`, student_id: `student-${suffix}`, final_status: 'present' });
    datasets.job_card_sessions.push({ id: `job-${suffix}`, school_id: school, section_id: `section-${suffix}` });
    datasets.job_card_submissions.push({ id: `job-submission-${suffix}`, school_id: school, job_card_session_id: `job-${suffix}`, student_uuid: `student-${suffix}`, evidence_note: 'Synthetic job evidence' });
  }
  const bytes = Buffer.from('Synthetic certificate attachment; not a valid certificate.');
  return { format: 'ltg-student-snapshot-v2', scope: 'all-schools', consistency: 'repeatable-read',
    environment: 'staging', exportId: '20000000-0000-4000-8000-000000000001', capturedAt: '2026-09-19T14:00:00Z',
    sourceRevision: 'a'.repeat(40), expectedSchoolIds: [schoolA, schoolB], datasets,
    sourceCounts: Object.fromEntries(requiredDatasets.map((name) => [name, datasets[name].length])),
    fileInventory: [{ id: 'synthetic-file', schoolId: schoolA, sourceVersion: 'version-1', bytes: bytes.length, sha256: sha256(bytes) }],
    files: [{ id: 'synthetic-file', schoolId: schoolA, sourceVersion: 'version-1', base64: bytes.toString('base64') }] };
}

test('all schools have separate recoverable bundles including inactive students and every grade revision', () => {
  const source = fixture();
  const bundles = buildSchoolBundles(source);
  assert.equal(bundles.length, 2);
  for (const bundle of bundles) {
    const restored = recoverSchoolBundle(bundle.bytes, { expectedDigest: bundle.sha256, schoolId: bundle.schoolId, exportId: bundle.exportId });
    assert.equal(restored.datasets.attendance_students.length, 1);
    assert.equal(restored.datasets.attendance_students[0].active, false);
    assert.deepEqual(restored.datasets.gradebook_revisions.map((row) => row.score), [0, 76]);
    assert.equal(restored.datasets.attendance_records.length, 1);
    assert.equal(restored.datasets.tower_certificates.length, 1);
    assert.equal(restored.datasets.job_card_submissions.length, 1);
    assert.equal(restored.files.length, bundle.schoolId === schoolA ? 1 : 0);
  }
});

for (const [name, mutate] of Object.entries({
  'omitted school': (s) => s.expectedSchoolIds.pop(),
  'truncated revisions': (s) => s.datasets.gradebook_revisions.pop(),
  'duplicate revision replaces history': (s) => { s.datasets.gradebook_revisions[1] = structuredClone(s.datasets.gradebook_revisions[0]); },
  'missing finalizations': (s) => delete s.datasets.gradebook_finalizations,
  'cross-school student': (s) => { s.datasets.gradebook_students[0].student_id = 'student-b'; },
  'cross-school section': (s) => { s.datasets.job_card_sessions[0].section_id = 'section-b'; },
  'cross-book attempt': (s) => { s.datasets.gradebook_revisions[0].attempt_id = 'attempt-b'; },
  'cross-student certificate': (s) => { s.datasets.tower_certificates[0].student_id = 'student-b'; },
  'legacy unidentified student': (s) => { s.datasets.job_card_submissions[0].student_uuid = null; },
  'live session code': (s) => { s.datasets.job_card_sessions[0].join_code = 'never-archive'; },
  'missing attachment': (s) => { s.files = []; },
  'altered attachment': (s) => { s.files[0].base64 = Buffer.from('bad bytes').toString('base64'); },
  'cross-school attachment': (s) => { s.files[0].schoolId = schoolB; },
  'changed attachment version': (s) => { s.files[0].sourceVersion = 'version-2'; },
  'missing attachment inventory': (s) => delete s.fileInventory,
})) test(`refuses incomplete export: ${name}`, () => {
  const source = fixture(); mutate(source);
  assert.throws(() => buildSchoolBundles(source));
});

test('recovery rejects modified bytes and another school or export receipt', () => {
  const bundle = buildSchoolBundles(fixture())[0];
  const receipt = { expectedDigest: bundle.sha256, schoolId: bundle.schoolId, exportId: bundle.exportId };
  assert.throws(() => recoverSchoolBundle(Buffer.concat([bundle.bytes, Buffer.from(' ')]), receipt));
  assert.throws(() => recoverSchoolBundle(bundle.bytes, { ...receipt, schoolId: schoolB }));
  assert.throws(() => recoverSchoolBundle(bundle.bytes, { ...receipt, exportId: 'different-export' }));
});

test('a correction creates different bytes while the earlier bundle stays recoverable', () => {
  const source = fixture();
  const original = buildSchoolBundles(source)[0];
  source.exportId = '20000000-0000-4000-8000-000000000002';
  source.datasets.gradebook_revisions.push({ id: 'a-3', gradebook_id: 'book-a', attempt_id: 'attempt-a', score: 80 });
  source.sourceCounts.gradebook_revisions++;
  const corrected = buildSchoolBundles(source)[0];
  assert.notEqual(original.sha256, corrected.sha256);
  const recovered = recoverSchoolBundle(original.bytes, { expectedDigest: original.sha256, schoolId: original.schoolId, exportId: original.exportId });
  assert.deepEqual(recovered.datasets.gradebook_revisions.map((row) => row.score), [0, 76]);
});

