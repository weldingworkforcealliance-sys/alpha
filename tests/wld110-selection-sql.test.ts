import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
const id=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
let db:PGlite;
let saveId=100;
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create schema private; create schema auth;
 create function auth.uid() returns uuid language sql as $$ select '${id(1)}'::uuid $$;
 create table gradebooks(id uuid primary key); create table attendance_students(id uuid primary key);
 create table gradebook_attempts(id uuid primary key, score numeric);
 create table gradebook_items(id uuid primary key,gradebook_id uuid,assessment_slug text);
 insert into gradebooks values('${id(2)}'); insert into attendance_students values('${id(3)}');
 create function private.wld110_assert(uuid,uuid) returns void language plpgsql as $$ begin
 if $1<>'${id(2)}'::uuid or $2<>'${id(3)}'::uuid then raise exception 'Access denied'; end if; end $$;
 create function public.record_gradebook_attempt(uuid,uuid,uuid,text,numeric,numeric,text) returns uuid language plpgsql as $$
 declare result uuid:=gen_random_uuid(); begin insert into public.gradebook_attempts values(result,$5); return result; end $$;`);
 const base=readFileSync('supabase/migrations/20260919184646_wld110_shop_workflow.sql','utf8');
 await db.exec(base.slice(base.indexOf('create table public.wld110_shop_progress'),base.indexOf('-- Only hashes')));
 await db.exec(`create function private.wld110_snapshot(uuid,uuid) returns jsonb language sql as $$ select to_jsonb(p) from public.wld110_shop_progress p where gradebook_id=$1 and student_id=$2 $$;
 insert into wld110_shop_progress(gradebook_id,student_id,focus,requested_at) values('${id(2)}','${id(3)}',array['Current focus'],now());
 insert into gradebook_items select gen_random_uuid(),'${id(2)}','wld110-shop:'||n from generate_series(0,7) n;`);
 await db.exec(readFileSync('supabase/migrations/20261009212549_wld110_assignment_selection.sql','utf8'));
},30000);
afterAll(async()=>{await db?.close();});
async function state(){return (await db.query<{current_competency:number;revision:number;focus:string[];requested_at:string|null}>('select * from wld110_shop_progress')).rows[0];}
async function grade(competency:number,options:{revision?:number;save?:string;student?:string}={}){
 const revision=options.revision??(await state()).revision;
 return db.query('select private.wld110_grade($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)',[id(2),options.student??id(3),options.save??id(++saveId),competency,revision,JSON.stringify({straightness:18,placement:18,execution:18,consistency:18,weldSize:18}),'{}','Synthetic inspection']);
}
describe('instructor selects projects without losing existing evidence',()=>{
 it('rejects null/invalid competencies, advanced work before core, and foreign students',async()=>{
  for(const competency of [-1,9,null])await expect(grade(competency as number)).rejects.toThrow('valid SMAW');
  await expect(grade(8)).rejects.toThrow('all eight');
  await expect(grade(0,{student:id(99)})).rejects.toThrow('Access denied');
 });
 it('grades a later position independently without skipping unfinished competencies or clearing their coaching',async()=>{
  await grade(2);await grade(2);
  expect(await state()).toMatchObject({current_competency:0,revision:2,focus:['Current focus']});
  expect((await state()).requested_at).not.toBeNull();
  expect((await db.query('select * from wld110_shop_attempts')).rows).toHaveLength(2);
  expect((await db.query('select * from gradebook_attempts')).rows).toHaveLength(1);
  await expect(grade(2)).rejects.toThrow('already complete');
 });
 it('retries exactly once and rejects stale revisions or changed retry payloads',async()=>{
  const revision=(await state()).revision,save=id(++saveId);
  await grade(0,{revision,save});await grade(0,{revision,save});
  expect((await state()).revision).toBe(revision+1);
  await expect(grade(1,{revision})).rejects.toThrow('student changed');
  await expect(grade(1,{revision,save})).rejects.toThrow('already used');
 });
 it('advances to the first remaining project, skipping only verified completions',async()=>{
  await grade(0);expect((await state()).current_competency).toBe(1);
  await grade(1);await grade(1);expect((await state()).current_competency).toBe(3);
  for(const competency of [3,4,5,6,7]){await grade(competency);await grade(competency);}
  expect((await state()).current_competency).toBe(8);
  expect((await db.query('select * from gradebook_attempts')).rows).toHaveLength(8);
  await grade(8);await grade(8);expect((await state()).current_competency).toBe(9);
  expect((await db.query('select * from gradebook_attempts')).rows).toHaveLength(8);
  expect((await db.query('select * from wld110_shop_attempts')).rows).toHaveLength(18);
 });
});
