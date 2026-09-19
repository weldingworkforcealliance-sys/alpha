import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requiredDatasets } from './school-bundle.mjs';
import { contextSchema, captureSupplement, contextSchemaSql, contextDataSql, storageSql, templateSql } from './context-reader.mjs';
import { prepareRecords } from './prepare-records.mjs';
import { databaseConfig } from './database-config.mjs';

const school = '10000000-0000-4000-8000-000000000001';
function source() {
  const datasets = Object.fromEntries(requiredDatasets.map(t => [t, []]));
  datasets.schools = [{ id: school, name: 'Synthetic school' }];
  datasets.attendance_students = [{ id: 'student', school_id: school, active: false }];
  datasets.sections = [{ id: 'section', school_id: school }];
  datasets.gradebooks = [{ id: 'book', section_id: 'section' }];
  datasets.tower_permanent_tests = [{ id: 'test', student_id: 'student', gradebook_id: 'book' }];
  datasets.tower_certificates = [{ id: 'cert', test_id: 'test', student_id: 'student', gradebook_id: 'book', snapshot: { synthetic: true } }];
  return { format: 'ltg-student-snapshot-v1', scope: 'all-schools', consistency: 'repeatable-read',
    environment: 'staging', exportId: '20000000-0000-4000-8000-000000000001', capturedAt: '2026-09-19T16:00:00Z',
    sourceRevision: 'a'.repeat(40), expectedSchoolIds: [school], datasets,
    sourceCounts: Object.fromEntries(requiredDatasets.map(t => [t, datasets[t].length])),
    supplement: { format: 'ltg-archive-context-v1', schema: contextSchema,
      datasets: Object.fromEntries(Object.keys(contextSchema).map(t => [t, []])),
      sourceCounts: Object.fromEntries(Object.keys(contextSchema).map(t => [t, 0])),
      storage: { checkedInSnapshot: true, objectCount: 0 }, templates: [{ school_id: school,
        layout: 'pccc-guided-bend-v2', base64: Buffer.from('%PDF-synthetic-template').toString('base64') }] } };
}
const renderer = { renderCertificate: async () => Buffer.from('%PDF-synthetic-certificate') };
test('preserves template bytes, renders saved certificate and produces independently recoverable school bundle', async () => {
  const output = await prepareRecords(source(), renderer);
  assert.equal(output.bundleCount, 1); assert.equal(output.fileCount, 2);
  assert.equal(output.artifacts.length, 4);
  const schoolArtifact = output.artifacts.find(a => a.name.startsWith('school-'));
  const parsed = JSON.parse(schoolArtifact.bytes);
  assert.equal(parsed.payload.datasets.attendance_students[0].active, false);
  assert.equal(parsed.payload.files.length, 2);
  const context = JSON.parse(output.artifacts.find(a => a.name === 'administrative-context.json').bytes);
  assert.equal(context.access, 'archive-administrator-only');
  assert.equal(context.templates[0].base64, source().supplement.templates[0].base64);
});
for (const [name, mutate] of Object.entries({
  'new unhandled Storage file': s => { s.supplement.storage.objectCount = 1; },
  'truncated audit history': s => { s.supplement.sourceCounts.audit_log = 1; },
  'missing context': s => { delete s.supplement.datasets.courses; },
  'missing schema': s => { s.supplement.schema = {}; },
  'template of unknown school': s => { s.supplement.templates[0].school_id = 'other'; },
  'duplicate template': s => { s.supplement.templates.push(s.supplement.templates[0]); },
  'corrupt template': s => { s.supplement.templates[0].base64 = 'garbage'; },
})) test(`blocks incomplete archive: ${name}`, async () => {
  const input = source(); mutate(input); await assert.rejects(prepareRecords(input, renderer));
});
test('certificate rendering failure blocks entire archive', async () => {
  await assert.rejects(prepareRecords(source(), { renderCertificate: async () => { throw Error('cannot render'); } }));
});

function fakeContext({ storage = 0, drift = false, truncate = false } = {}) {
  return { async query(sql) {
    if (sql === contextSchemaSql) return { rows: Object.entries(contextSchema).flatMap(([table, cols]) => cols.map(c => ({
      table_name: table, column_name: c.name, data_type: drift ? 'changed' : c.type }))) };
    if (sql === storageSql) return { rows: [{ object_count: storage }] };
    if (sql === templateSql) return { rows: [] };
    if (Object.keys(contextSchema).some(t => sql === contextDataSql(t))) return { rows: [{ records: [], total: truncate ? 1 : 0 }] };
    throw Error('unexpected query');
  } };
}
test('context reader reconciles all 25 reviewed tables and explicitly checks object inventory', async () => {
  const supplement = await captureSupplement(fakeContext());
  assert.equal(Object.keys(supplement.datasets).length, 25);
  assert.equal(supplement.storage.objectCount, 0);
});
for (const change of [{ storage: 1 }, { drift: true }, { truncate: true }]) {
  test(`context reader fails closed: ${JSON.stringify(change)}`, async () => {
    await assert.rejects(captureSupplement(fakeContext(change)));
  });
}
test('database connection is pinned to expected environment, read role and verified TLS', () => {
  const valid = { project: 'qsmvgyyaemjmklceyikr', host: 'db.qsmvgyyaemjmklceyikr.supabase.co', port: 5432,
    database: 'postgres', user: 'ltg_archive_reader', password: 'x'.repeat(32), ssl: false };
  assert.equal(databaseConfig(JSON.stringify(valid), 'production').ssl.rejectUnauthorized, true);
  for (const delta of [{ project: 'other' }, { host: 'attacker.invalid' }, { port: 6543 }, { user: 'postgres' }, { password: 'short' }]) {
    assert.throws(() => databaseConfig(JSON.stringify({ ...valid, ...delta }), 'production'));
  }
  assert.throws(() => databaseConfig(JSON.stringify(valid), 'staging'));
});

