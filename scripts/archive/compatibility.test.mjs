import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixture } from './synthetic-school-fixture.mjs';
import { buildSchoolBundles, recoverSchoolBundle, sha256 } from './school-bundle.mjs';
import { captureCoreSnapshot, schemaCheckSql, snapshotSql } from './snapshot-reader.mjs';
import { captureSupplement, contextSchema, contextSchemaSql, contextDataSql, storageSql, templateSql } from './context-reader.mjs';
import { prepareRecords } from './prepare-records.mjs';
import { verifyIsolatedRecovery } from './restore-isolated.mjs';
import { archiveFailure } from './diagnostics.mjs';
const coreSchema = JSON.parse(readFileSync(new URL('./core-schema.json', import.meta.url)));
const columns = schema => Object.entries(schema).flatMap(([table_name, cols]) => cols.map(c => ({table_name,column_name:c.name,data_type:c.type})));
const privateError = () => Object.assign(new Error('SECRET synthetic row and password'), {stage:'SECRET',code:'SECRET',detail:'SECRET',cause:Error('SECRET')});
function current() {
  const s=fixture();
  s.datasets.wld110_shop_attempts.forEach((r,i)=>r.decision=[null,'retry','grade'][i%3]);
  s.datasets.wld110_shop_completions.forEach(r=>{r.first_attempt_id=r.second_attempt_id;r.second_attempt_id=null;r.grade=90;});
  return s;
}
function reader(source, {fail, drift}={}) {
 const calls=[];
 const context=Object.fromEntries(Object.keys(contextSchema).map(t=>[t,[]]));
 context.course_guide_day_math=[{id:'synthetic-math',shared_math_day_number:17},{id:'synthetic-null',shared_math_day_number:null}];
 return {calls, async query(sql){
  calls.push(sql);if(sql===fail)throw privateError();
  if(sql===schemaCheckSql || sql===contextSchemaSql){
   const rows=columns(sql===schemaCheckSql?coreSchema:contextSchema);if(drift)drift(rows,sql);return {rows};
  }
  if(sql===snapshotSql())return {rows:[{snapshot:structuredClone(source)}]};
  if(sql===storageSql)return {rows:[{object_count:0}]};
  if(sql===templateSql)return {rows:[]};
  for(const t of Object.keys(contextSchema))if(sql===contextDataSql(t))return {rows:[{total:context[t].length,records:context[t]}]};
  return {rows:[]};
 }};
}
// Parameterized in-memory adapter exercises recovery insertion, readback and
// rollback without connecting to a database or invoking any cloud operation.
function recoveryClient(){
 const records=[],files=[],calls=[];
 return {records,files,calls,async query(sql,p){
  calls.push(sql);
  if(sql.startsWith('select current_database'))return {rows:[{name:'ltg_archive_recovery',address:'127.0.0.1'}]};
  if(sql.startsWith('INSERT INTO ltg_archive_drill.records'))records.push({ordinal:p[0],scope:p[1],dataset:p[2],payload:JSON.parse(p[3])});
  if(sql.startsWith('INSERT INTO ltg_archive_drill.files'))files.push({ordinal:p[0],identity:p[1],content:Buffer.from(p[2])});
  if(sql.startsWith('SELECT * FROM ltg_archive_drill.records'))return {rows:records};
  if(sql.startsWith('SELECT * FROM ltg_archive_drill.files'))return {rows:files};
  return {rows:[]};
 }};
}
test('all four reviewed columns are projected explicitly in exact inventory order',()=>{
 assert.deepEqual(coreSchema.tower_records.slice(-2),[{name:'lab_coaching',type:'jsonb'},{name:'lab_requested_at',type:'timestamp with time zone'}]);
 assert.deepEqual(coreSchema.wld110_shop_attempts.at(-1),{name:'decision',type:'text'});
 assert.deepEqual(contextSchema.course_guide_day_math.at(-1),{name:'shared_math_day_number',type:'integer'});
 for(const n of ['lab_coaching','lab_requested_at','decision'])assert.ok(snapshotSql().includes(`t."${n}"`));
 assert.ok(contextDataSql('course_guide_day_math').includes('t."shared_math_day_number"'));
});
test('capture, prepare and isolated recovery preserve four additions, nulls and accepted/retry history',async()=>{
 const source=current();const client=reader(source);
 const captured=await captureCoreSnapshot(client,{environment:'staging',sourceRevision:'b'.repeat(40),captureSupplement});
 assert.equal(client.calls.at(-1),'COMMIT');
 const {artifacts}=await prepareRecords(captured,{renderCertificate:async()=>Buffer.from('%PDF-synthetic')});
 const receipt={exportId:captured.exportId,environment:captured.environment,entries:artifacts.map(a=>({name:a.name,sha256:sha256(a.bytes)}))};
 const db=recoveryClient();await verifyIsolatedRecovery(db,artifacts,receipt);
 assert.equal(db.calls.at(-1),'ROLLBACK');
 assert.deepEqual(db.records.filter(r=>r.dataset==='wld110_shop_attempts').map(r=>r.payload.decision),[null,'retry','grade',null,'retry','grade']);
 assert.deepEqual(db.records.filter(r=>r.dataset==='tower_records').map(r=>r.payload),source.datasets.tower_records);
 assert.deepEqual(db.records.filter(r=>r.dataset==='course_guide_day_math').map(r=>r.payload.shared_math_day_number),[17,null]);
 assert.ok(db.records.filter(r=>r.dataset==='wld110_shop_completions').every(r=>r.payload.second_attempt_id===null));
});
for(const [name,mutate] of Object.entries({
 retry:s=>s.datasets.wld110_shop_attempts[2].decision='retry',
 missingDecision:s=>delete s.datasets.wld110_shop_attempts[2].decision,
 missingSecond:s=>delete s.datasets.wld110_shop_completions[0].second_attempt_id,
 orphan:s=>s.datasets.wld110_shop_completions[0].first_attempt_id='missing',
 crossSchool:s=>s.datasets.wld110_shop_completions[0].first_attempt_id='shop-b-3',
 wrongCompetency:s=>s.datasets.wld110_shop_attempts[2].competency=4,
}))test(`single-attempt recovery rejects ${name}`,()=>{const s=current();mutate(s);assert.throws(()=>buildSchoolBundles(s));});
test('frozen v2 archive without additions still recovers unchanged alongside legacy v1 tests',async()=>{
 const bytes=readFileSync(new URL('./fixtures/legacy-school-v2.json',import.meta.url));
 const digest='3cbe46b34d0765d8a7bc9926a7aef4114762a5eb8fdeccfa46e5d3ab929d2a24';
 const restored=recoverSchoolBundle(bytes,{expectedDigest:digest,schoolId:fixture().expectedSchoolIds[0],exportId:fixture().exportId});
 assert.equal(restored.datasets.wld110_shop_completions[0].second_attempt_id,'shop-a-3');
 assert.ok(!Object.hasOwn(restored.datasets.wld110_shop_attempts[0],'decision'));
 assert.ok(!Object.hasOwn(restored.datasets.tower_records[0],'lab_coaching'));
 const artifact={name:`school-${restored.schoolId}.json`,bytes};
 const db=recoveryClient();await verifyIsolatedRecovery(db,[artifact],{exportId:restored.exportId,environment:restored.environment,entries:[{name:artifact.name,sha256:digest}]});
 assert.equal(db.calls.at(-1),'ROLLBACK');
});
for(const schemaSql of [schemaCheckSql,contextSchemaSql])for(const kind of ['missing','extra','type','order'])test(`exact schema remains fail-closed ${schemaSql===schemaCheckSql?'core':'context'} ${kind}`,async()=>{
 const db=reader(current(),{drift:(rows,sql)=>{if(sql!==schemaSql)return;
  if(kind==='missing')rows.pop();if(kind==='extra')rows.push({...rows.at(-1),column_name:'unexpected'});
  if(kind==='type')rows[0].data_type='text';if(kind==='order')[rows[0],rows[1]]=[rows[1],rows[0]];
 }});
 await assert.rejects(captureCoreSnapshot(db,{environment:'staging',sourceRevision:'b'.repeat(40),captureSupplement}),e=>e.message.includes(schemaSql===schemaCheckSql?'core-schema':'context-schema'));
 assert.equal(db.calls.at(-1),'ROLLBACK');assert.ok(!db.calls.includes('COMMIT'));
});
for(const [sql,stage] of [[schemaCheckSql,'core-schema'],[snapshotSql(),'core-read'],[contextSchemaSql,'context-schema'],[contextDataSql('courses'),'context-read'],[storageSql,'storage-inventory'],[templateSql,'template-read'],['COMMIT','core-commit']])test(`safe diagnostic identifies ${stage} and discards underlying error`,async()=>{
 const db=reader(current(),{fail:sql});
 await assert.rejects(captureCoreSnapshot(db,{environment:'staging',sourceRevision:'b'.repeat(40),captureSupplement}),e=>{
  assert.ok(e.message.includes(stage));assert.ok(!JSON.stringify(e).includes('SECRET'));assert.ok(!e.message.includes('SECRET'));assert.equal(e.cause,undefined);return true;
 });assert.equal(db.calls.at(-1),'ROLLBACK');
});
test('top-level diagnostic accepts only fixed stages and internally registered errors',()=>{
 for(const stage of ['retain','recover-objects','recover-database','credentials','prepare']){
  const e=archiveFailure(stage,privateError());assert.ok(e.message.includes(stage));assert.ok(!e.message.includes('SECRET'));
 }
 assert.ok(archiveFailure('SECRET',privateError()).message.includes('unknown'));
 assert.ok(archiveFailure('capture',archiveFailure('context-schema',privateError())).message.includes('context-schema'));
});

test('PostgreSQL service restores new fields and both legacy bundle formats', {skip:process.env.LTG_ARCHIVE_DB_DRILL!=='true'}, async()=>{
 const {Client}=await import('pg');
 const db=new Client({host:'127.0.0.1',port:5432,database:'ltg_archive_recovery',user:'archive_drill',password:'synthetic-local-drill-only',connectionTimeoutMillis:10000});
 await db.connect();
 try {
  const captured=await captureCoreSnapshot(reader(current()),{environment:'staging',sourceRevision:'b'.repeat(40),captureSupplement});
  const {artifacts}=await prepareRecords(captured,{renderCertificate:async()=>Buffer.from('%PDF-synthetic')});
  const receipt={exportId:captured.exportId,environment:'staging',entries:artifacts.map(a=>({name:a.name,sha256:sha256(a.bytes)}))};
  assert.equal((await verifyIsolatedRecovery(db,artifacts,receipt)).artifactsVerified,artifacts.length);
  for(const version of ['v1','v2']){
   const bytes=readFileSync(new URL(`./fixtures/legacy-school-${version}.json`,import.meta.url));
   const payload=JSON.parse(bytes).payload;
   const name=`school-${payload.schoolId}.json`;
   await verifyIsolatedRecovery(db,[{name,bytes}],{exportId:payload.exportId,environment:payload.environment,entries:[{name,sha256:sha256(bytes)}]});
  }
  assert.equal((await db.query("select to_regnamespace('ltg_archive_drill') as schema")).rows[0].schema,null);
 }finally{await db.end();}
});

test('legacy administrative context recovers without inventing the new math field',async()=>{
 const schema=structuredClone(contextSchema);
 schema.course_guide_day_math=schema.course_guide_day_math.filter(c=>c.name!=='shared_math_day_number');
 const context={format:'ltg-archive-context-v1',exportId:fixture().exportId,environment:'staging',schema,datasets:{course_guide_day_math:[{id:'synthetic-legacy-math',math_day_number:3}]}};
 const artifact={name:'administrative-context.json',bytes:Buffer.from(JSON.stringify(context))};
 const db=recoveryClient();
 await verifyIsolatedRecovery(db,[artifact],{exportId:context.exportId,environment:context.environment,entries:[{name:artifact.name,sha256:sha256(artifact.bytes)}]});
 assert.deepEqual(db.records[0].payload,context.datasets.course_guide_day_math[0]);
 assert.ok(!Object.hasOwn(db.records[0].payload,'shared_math_day_number'));
});
