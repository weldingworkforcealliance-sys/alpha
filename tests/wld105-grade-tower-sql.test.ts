import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {afterAll,beforeAll,expect,it} from 'vitest';

const id=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const migration=(name:string)=>readFileSync(`supabase/migrations/${name}.sql`,'utf8');
let db:PGlite;
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create schema private; create schema auth; create role anon; create role authenticated;
 create function auth.uid() returns uuid language sql as $$ select '${id(1)}'::uuid $$;
 create function can_access_gradebook(uuid) returns boolean language sql as $$ select $1='${id(2)}'::uuid $$;
 create table gradebooks(id uuid primary key,section_id uuid);
 create table attendance_students(id uuid primary key,display_name text);
 create table classroom_submissions(id uuid primary key);
 create table gradebook_directory(id uuid,course_role text,course_code text);
 create table planner_days(section_id uuid,scheduled_date date);
 insert into gradebooks values('${id(2)}','${id(8)}');
 insert into attendance_students values('${id(3)}','Synthetic fabrication student');
 insert into gradebook_directory values('${id(2)}','theory','WLD 105');
 insert into planner_days values('${id(8)}','2099-12-31');`);
 const foundation=migration('20260916173635_gradebook_foundation');
 await db.exec(foundation.slice(foundation.indexOf('create table public.gradebook_students'),foundation.indexOf('-- Explicit section authorization')));
 await db.exec(foundation.slice(foundation.indexOf('create function public.record_gradebook_attempt'),foundation.indexOf('-- Configurable categories')));
 await db.exec(`insert into gradebook_students(gradebook_id,student_id) values('${id(2)}','${id(3)}');
 insert into gradebook_categories(gradebook_id,code,label) values('${id(2)}','theory_assessments','Theory');
 insert into gradebook_statuses(gradebook_id,code,label,active,requires_score) values('${id(2)}','graded','Graded',true,true),('${id(2)}','ungraded','Ungraded',true,false);
 create view gradebook_roster as select g.gradebook_id,g.student_id,g.active,s.display_name from gradebook_students g join attendance_students s on s.id=g.student_id;`);
 const shop=migration('20260919184646_wld110_shop_workflow');
 await db.exec(shop.slice(shop.indexOf('create table public.wld110_shop_progress'),shop.indexOf('-- Only hashes')));
 for(const name of ['20261007214209_wld105_fabrication_grade_tower','20261007214356_wld105_fabrication_fk_indexes','20261007221648_wld105_binary_aws_homework','20261009212549_wld110_assignment_selection','20261010120625_wld110_instructor_decision','20261011134827_grade_correction_guards']){
  await db.exec(migration(name));
 }
},30000);
afterAll(async()=>{await db?.close();});

it('prepares all eight grading items and preserves the 50/25/25 weights on repeated setup',async()=>{
 await db.query('select ensure_wld105_gradebook_setup($1)',[id(2)]);
 await db.query('select ensure_wld105_gradebook_setup($1)',[id(2)]);
 expect((await db.query('select count(*)::int count from gradebook_items')).rows).toEqual([{count:8}]);
 expect((await db.query('select category_code,weight_percent::int weight from gradebook_category_weights order by category_code')).rows).toEqual([
  {category_code:'fabrication',weight:25},{category_code:'homework',weight:50},{category_code:'theory_assessments',weight:25},
 ]);
});

it('loads tower and homework status and records corrections through the current guarded writer',async()=>{
 const empty=(await db.query<{result:{students:{homework_completed_count:number}[]}}>('select get_wld105_grade_tower($1) result',[id(2)])).rows[0].result;
 expect(empty.students[0].homework_completed_count).toBe(0);
 await db.query("select record_wld105_homework_status($1,$2,'ofc',true,current_date,'Synthetic completion')",[id(2),id(3)]);
 await db.query("select record_wld105_homework_status($1,$2,'ofc',false,null,'Synthetic correction')",[id(2),id(3)]);
 const homework=(await db.query<{result:{students:{completed_count:number;pending_count:number}[]}}>('select get_wld105_homework_status($1) result',[id(2)])).rows[0].result;
 expect(homework.students[0]).toMatchObject({completed_count:0,pending_count:4});
 expect((await db.query('select count(*)::int count from wld105_homework_events')).rows).toEqual([{count:2}]);
 expect((await db.query('select count(*)::int count from gradebook_revisions')).rows).toEqual([{count:2}]);
});

it('saves fabrication evidence, keeps the best attempt and refuses overwriting an attempt',async()=>{
 const record=(attempt:number,score:number)=>db.query("select record_wld105_fabrication_grade($1,$2,'m',$3,$4,false,$4,false,$4,false,$4,false,$4,false,'Synthetic rubric')",[id(2),id(3),attempt,score]);
 await record(1,20);await record(2,16);
 await expect(record(1,10)).rejects.toThrow('already recorded');
 const tower=(await db.query<{result:{students:{fabrication_avg:number;current_grade:number}[]}}>('select get_wld105_grade_tower($1) result',[id(2)])).rows[0].result;
 expect(tower.students[0]).toMatchObject({fabrication_avg:100,current_grade:100});
 expect((await db.query('select count(*)::int count from wld105_fabrication_attempts')).rows).toEqual([{count:2}]);
});

it('retains gradebook authorization, client grants and row security',async()=>{
 await expect(db.query('select ensure_wld105_gradebook_setup($1)',[id(99)])).rejects.toThrow('access denied');
 for(const name of ['ensure_wld105_gradebook_setup','get_wld105_grade_tower','get_wld105_homework_status']){
  const rows=(await db.query("select has_function_privilege('anon',$1,'execute') anon,has_function_privilege('authenticated',$1,'execute') instructor",[`public.${name}(uuid)`])).rows;
  expect(rows).toEqual([{anon:false,instructor:true}]);
 }
 expect((await db.query("select count(*)::int count from pg_class where relname in ('gradebook_category_weights','wld105_fabrication_attempts','wld105_homework_events') and relrowsecurity")).rows).toEqual([{count:3}]);
});
