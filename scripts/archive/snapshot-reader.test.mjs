import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { requiredDatasets, buildSchoolBundles } from './school-bundle.mjs';
import { captureCoreSnapshot, snapshotSql, schemaCheckSql } from './snapshot-reader.mjs';
const schema = JSON.parse(readFileSync(new URL('./core-schema.json', import.meta.url), 'utf8'));
const options = { environment: 'staging', sourceRevision: 'b'.repeat(40) };
function fake({ drift = false, fail = false, truncate = false } = {}) {
  const calls = [];
  const client = { async query(sql) {
    calls.push(sql);
    if (sql === schemaCheckSql) return { rows: Object.entries(schema).flatMap(([table, columns]) => columns.map((column) => ({
      table_name: table, column_name: column.name, data_type: drift ? 'changed' : column.type,
    }))) };
    if (sql === snapshotSql()) {
      if (fail) throw new Error('private student contents must not leak');
      return { rows: [{ snapshot: { capturedAt: '2026-09-19T15:00:00Z', expectedSchoolIds: [],
        datasets: Object.fromEntries(requiredDatasets.map((name) => [name, []])),
        sourceCounts: Object.fromEntries(requiredDatasets.map((name) => [name, truncate ? 1 : 0])) } }] };
    }
    return { rows: [] };
  } };
  return { calls, client };
}
test('captures all datasets in a dedicated read-only repeatable-read transaction', async () => {
  const { calls, client } = fake();
  const result = await captureCoreSnapshot(client, options);
  assert.equal(calls[0], 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.ok(calls.includes('SET LOCAL row_security = off'));
  assert.equal(calls.at(-1), 'COMMIT');
  assert.equal(result.files, null);
  assert.equal(result.fileInventory, null);
  assert.equal(result.format, 'ltg-student-snapshot-v2');
  assert.throws(() => buildSchoolBundles(result));
});
for (const scenario of [{ drift: true }, { fail: true }, { truncate: true }]) {
  test(`rolls back schema drift, read errors, or incomplete output: ${JSON.stringify(scenario)}`, async () => {
    const { calls, client } = fake(scenario);
    await assert.rejects(captureCoreSnapshot(client, options), (error) => !error.message.includes('private student'));
    assert.equal(calls.at(-1), 'ROLLBACK');
    assert.ok(!calls.includes('COMMIT'));
  });
}
test('projection preserves bigint identities and excludes live join codes', () => {
  const sql = snapshotSql();
  assert.match(sql, /"revision"::text/);
  assert.ok(!sql.includes('join_code'));
  assert.ok(!sql.includes('wld110_student_links'));
  for (const table of ['wld110_shop_progress','wld110_shop_attempts','wld110_shop_completions']) assert.ok(sql.includes(table));
  assert.ok(!/\blimit\b|\boffset\b|\bwhere\b/i.test(sql));
  assert.ok(!snapshotSql({ countsOnly: true }).includes('as records'));
});
test('supplement shares the snapshot and a failure rolls back instead of producing mixed records', async () => {
  const { calls, client } = fake();
  await assert.rejects(captureCoreSnapshot(client, { ...options, captureSupplement: async (sameClient) => {
    assert.equal(sameClient, client); assert.ok(!calls.includes('COMMIT')); throw Error('private data');
  } }));
  assert.equal(calls.at(-1), 'ROLLBACK');
  assert.ok(!calls.includes('COMMIT'));
});

