import { requiredDatasets, sha256 } from './school-bundle.mjs';

const schoolA = '10000000-0000-4000-8000-000000000001';
const schoolB = '10000000-0000-4000-8000-000000000002';
export function fixture() {
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
    const shop = { gradebook_id: `book-${suffix}`, student_id: `student-${suffix}` };
    datasets.wld110_shop_progress.push({ ...shop, current_competency: 1, revision: 3,
      requested_at: null, position_started_on: '2026-09-19', focus: [] });
    for (const [number, ratings] of [[1, [18,18,18,16,16]], [2, [18,16,16,16,16]], [3, [18,18,18,18,18]]]) {
      datasets.wld110_shop_attempts.push({ ...shop, id: `shop-${suffix}-${number}`, competency: 0, attempt_number: number,
        ratings: Object.fromEntries(['straightness','placement','execution','consistency','weldSize'].map((key,i)=>[key,ratings[i]])),
        total: ratings.reduce((a,b)=>a+b,0), tags: {}, sizer_reference: 'ltg-tower-bead-size-v1', sizer_note: 'Synthetic sizer check',
        recorded_by: 'synthetic-instructor', recorded_at: '2026-09-19T14:00:00Z' });
    }
    datasets.wld110_shop_completions.push({ ...shop, competency: 0, first_attempt_id: `shop-${suffix}-1`,
      second_attempt_id: `shop-${suffix}-3`, grade: 88, gradebook_attempt_id: `attempt-${suffix}`, completed_at: '2026-09-19T14:00:00Z' });
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
