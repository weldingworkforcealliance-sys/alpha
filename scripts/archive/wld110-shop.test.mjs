import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture} from './synthetic-school-fixture.mjs';
import {buildSchoolBundles,recoverSchoolBundle,requiredDatasets} from './school-bundle.mjs';

test('shop archive restores every failed and qualifying attempt for each inactive student',()=>{
  const source=fixture();
  for(const bundle of buildSchoolBundles(source)){
    const restored=recoverSchoolBundle(bundle.bytes,{expectedDigest:bundle.sha256,schoolId:bundle.schoolId,exportId:bundle.exportId});
    assert.equal(restored.format,'ltg-school-record-bundle-v2');
    assert.equal(restored.datasets.attendance_students[0].active,false);
    assert.deepEqual(restored.datasets.wld110_shop_attempts.map(a=>a.total),[86,82,90]);
    assert.deepEqual(restored.datasets.wld110_shop_attempts.map(a=>a.sizer_note),Array(3).fill('Synthetic sizer check'));
    const completion=restored.datasets.wld110_shop_completions[0];
    assert.equal(completion.grade,88);
    assert.equal(completion.first_attempt_id,restored.datasets.wld110_shop_attempts[0].id);
    assert.equal(completion.second_attempt_id,restored.datasets.wld110_shop_attempts[2].id);
    assert.equal(restored.datasets.wld110_shop_progress[0].current_competency,1);
    assert.equal(Object.keys(restored.datasets).length,28);
    assert.ok(!requiredDatasets.includes('wld110_student_links'));
  }
});
for(const [name,mutate] of Object.entries({
  'missing history':s=>s.datasets.wld110_shop_attempts.pop(),
  'missing new dataset':s=>delete s.datasets.wld110_shop_completions,
  'orphan attempt':s=>{s.datasets.wld110_shop_progress=[];s.sourceCounts.wld110_shop_progress=0;},
  'duplicate completion':s=>{s.datasets.wld110_shop_completions.push(s.datasets.wld110_shop_completions[0]);s.sourceCounts.wld110_shop_completions++;},
  'cross-school history':s=>{s.datasets.wld110_shop_attempts[0].student_id='student-b';},
  'cross-book demonstration':s=>{s.datasets.wld110_shop_completions[0].second_attempt_id='shop-b-3';},
  'wrong competency':s=>{s.datasets.wld110_shop_attempts[0].competency=1;},
  'repeated demonstration':s=>{s.datasets.wld110_shop_completions[0].second_attempt_id='shop-a-1';},
  'wrong posted grade':s=>{s.datasets.wld110_shop_completions[0].gradebook_attempt_id='attempt-b';},
  'access link dataset':s=>{s.datasets.wld110_student_links=[];s.sourceCounts.wld110_student_links=0;},
}))test(`shop archive refuses ${name}`,()=>{
  const source=fixture();mutate(source);assert.throws(()=>buildSchoolBundles(source));
});
test('unchanged archive created by the previous worker still recovers without inventing shop history',()=>{
  const bytes=readFileSync(new URL('./fixtures/legacy-school-v1.json',import.meta.url));
  const restored=recoverSchoolBundle(bytes,{
    expectedDigest:'ad1da69b4219569ad509a8b9667023de0c701bcdd308be787bb5220d585fed88',
    schoolId:'10000000-0000-4000-8000-000000000001',exportId:'20000000-0000-4000-8000-000000000001',
  });
  assert.equal(restored.format,'ltg-school-record-bundle-v1');
  assert.equal(Object.keys(restored.datasets).length,25);
  assert.deepEqual(restored.datasets.gradebook_revisions.map(r=>r.score),[0,76]);
  assert.ok(!Object.hasOwn(restored.datasets,'wld110_shop_attempts'));
});
