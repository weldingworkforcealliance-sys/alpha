import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
const id=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
let db:PGlite;
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create schema private; create schema auth; create role anon; create role authenticated;
 grant usage on schema private to authenticated;
 create function auth.uid() returns uuid language sql as $$ select '${id(1)}'::uuid $$;
 create function can_access_gradebook(uuid) returns boolean language sql as $$ select $1='${id(2)}'::uuid $$;
 create table gradebooks(id uuid primary key); create table attendance_students(id uuid primary key);
 create table classroom_submissions(id uuid primary key);
 insert into gradebooks values('${id(2)}'); insert into attendance_students values('${id(3)}');`);
 const foundation=readFileSync('supabase/migrations/20260916173635_gradebook_foundation.sql','utf8');
 await db.exec(foundation.slice(foundation.indexOf('create table public.gradebook_students'),foundation.indexOf('-- Explicit section authorization')));
 await db.exec(foundation.slice(foundation.indexOf('create function public.record_gradebook_attempt'),foundation.indexOf('-- Configurable categories')));
 await db.exec(`insert into gradebook_students(gradebook_id,student_id) values('${id(2)}','${id(3)}');
 insert into gradebook_categories(id,gradebook_id,code,label) values('${id(4)}','${id(2)}','theory','Theory');
 insert into gradebook_statuses values('${id(2)}','graded','Graded',true,true);
 insert into gradebook_items(id,gradebook_id,category_id,title,assessment_slug) values
 ('${id(5)}','${id(2)}','${id(4)}','Math','math'),('${id(6)}','${id(2)}','${id(4)}','Shop','wld110-shop:0'),('${id(7)}','${id(2)}','${id(4)}','Tower','tower:smaw');`);
 const shop=readFileSync('supabase/migrations/20260919184646_wld110_shop_workflow.sql','utf8');
 await db.exec(shop.slice(shop.indexOf('create table public.wld110_shop_progress'),shop.indexOf('-- Only hashes')));
 await db.exec(`create function private.wld110_assert(uuid,uuid) returns void language plpgsql as $$ begin
 if not public.can_access_gradebook($1) or $2<>'${id(3)}'::uuid then raise exception 'Access denied'; end if; end $$;
 create function private.wld110_snapshot(uuid,uuid) returns jsonb language sql as $$ select to_jsonb(p) from public.wld110_shop_progress p where gradebook_id=$1 and student_id=$2 $$;
 insert into wld110_shop_progress(gradebook_id,student_id) values('${id(2)}','${id(3)}');`);
 await db.exec(readFileSync('supabase/migrations/20261010120625_wld110_instructor_decision.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261011134827_grade_correction_guards.sql','utf8'));
},30000);
afterAll(async()=>{await db?.close();});
async function record(item=id(5)){return (await db.query<{id:string}>('select record_gradebook_attempt($1,$2,$3,$4,8,10,$5) id',[id(2),item,id(3),'graded','Original'])).rows[0].id;}
async function revision(attempt:string){return Number((await db.query<{r:number}>('select max(id) r from gradebook_revisions where attempt_id=$1',[attempt])).rows[0].r);}
const correct=(attempt:string,rev:number|null,opts:{book?:string;item?:string;student?:string;note?:string}={})=>db.query('select correct_gradebook_attempt($1,$2,$3,$4,9,10,$5,$6,$7)',[opts.book??id(2),opts.item??id(5),opts.student??id(3),'graded',opts.note??'Rechecked calculation',attempt,rev]);

describe('grade correction database boundary',()=>{
 it('accepts a current correction, retains history and rejects a stale second editor',async()=>{
  const attempt=await record(),rev=await revision(attempt);
  await correct(attempt,rev);
  await expect(correct(attempt,rev)).rejects.toThrow('Another instructor');
  const rows=(await db.query('select score::int score,note from gradebook_revisions where attempt_id=$1 order by id',[attempt])).rows;
  expect(rows).toEqual([{score:8,note:'Original'},{score:9,note:'Rechecked calculation'}]);
 });
 it('rejects missing revisions, old clients, mismatched identities and missing reasons',async()=>{
  const attempt=await record(),rev=await revision(attempt);
  await expect(correct(attempt,null)).rejects.toThrow('Another instructor');
  await expect(correct(attempt,rev,{student:id(99)})).rejects.toThrow('does not belong');
  await expect(correct(attempt,rev,{book:id(99)})).rejects.toThrow('access denied');
  await expect(correct(attempt,rev,{note:''})).rejects.toThrow('requires a reason');
  await expect(db.query("select record_gradebook_attempt($1,$2,$3,'graded',9,10,'Old client',$4)",[id(2),id(5),id(3),attempt])).rejects.toThrow('Reload');
 });
 it.each([6,7])('rejects generic welding creation and correction for item %i',async item=>{
  await expect(record(id(item))).rejects.toThrow('welding assessment');
  await expect(correct(id(99),1,{item:id(item)})).rejects.toThrow('welding assessment');
 });
 it('still records accepted WLD 110 rubric evidence and advances to the next rod',async()=>{
  const ratings=JSON.stringify(Object.fromEntries(['straightness','placement','execution','consistency','weldSize'].map(k=>[k,18])));
  await db.query("select decide_wld110_weld($1,$2,$3,0,0,$4::jsonb,'{}','Synthetic rubric','grade')",[id(2),id(3),id(100),ratings]);
  expect((await db.query('select current_competency from wld110_shop_progress')).rows[0]).toEqual({current_competency:1});
  expect((await db.query('select c.grade::int grade,r.score::int score from wld110_shop_completions c join gradebook_revisions r on r.attempt_id=c.gradebook_attempt_id')).rows[0]).toEqual({grade:90,score:90});
 });
 it('does not grant clients the private writer or anonymous correction access',async()=>{
  expect((await db.query("select has_function_privilege('authenticated','private.record_gradebook_attempt(uuid,uuid,uuid,text,numeric,numeric,text,uuid)','execute') allowed")).rows[0]).toEqual({allowed:false});
  expect((await db.query("select has_function_privilege('anon','public.correct_gradebook_attempt(uuid,uuid,uuid,text,numeric,numeric,text,uuid,bigint)','execute') allowed")).rows[0]).toEqual({allowed:false});
  const attempt=await record(),rev=await revision(attempt);
  await db.exec('set role authenticated');
  try{await correct(attempt,rev);await expect(record(id(6))).rejects.toThrow('welding assessment');}finally{await db.exec('reset role');}
 });
 it('preserves all owning-workflow validation while changing only the internal writer',()=>{
  const migration=readFileSync('supabase/migrations/20261011134827_grade_correction_guards.sql','utf8');
  for(const [file,name] of [['20260919010424_tower_certificate_save_fix.sql','public.save_tower_student'],['20261010120625_wld110_instructor_decision.sql','private.wld110_grade_decision'],['20261007221648_wld105_binary_aws_homework.sql','public.record_wld105_homework_status']]){
   const source=readFileSync(`supabase/migrations/${file}`,'utf8').replace(/\r\n/g,'\n');
   const start=source.indexOf(`create or replace function ${name}(`),end=source.indexOf('$$;',source.indexOf('as $$',start)+5)+3;
   expect(migration.replace(/\r\n/g,'\n')).toContain(source.slice(start,end).replaceAll('public.record_gradebook_attempt(','private.record_gradebook_attempt('));
  }
 });
});
