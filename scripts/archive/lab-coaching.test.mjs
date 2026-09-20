import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSchoolBundles} from './school-bundle.mjs';
import {fixture} from './synthetic-school-fixture.mjs';
import {snapshotSql} from './snapshot-reader.mjs';

test('core snapshots include coaching history and check requests in the existing student record',()=>{
 const sql=snapshotSql();
 assert.ok(sql.includes('t."lab_coaching"'));
 assert.ok(sql.includes('t."lab_requested_at"'));
 assert.ok(!sql.includes('lab_student_links'));
 const snapshot=fixture();
 const bundles=buildSchoolBundles(snapshot);
 for(const bundle of bundles){
  const {payload}=JSON.parse(bundle.bytes.toString());
  const records=payload.datasets.tower_records;
  assert.equal(records.length,1);
  assert.equal(records[0].lab_coaching.history.length,2);
  assert.equal(records[0].lab_coaching.focus[0],'Travel speed');
  assert.equal(records[0].lab_requested_at,'2026-09-20T12:00:00Z');
 }
});
