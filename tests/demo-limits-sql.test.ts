import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';

let db:PGlite;
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema extensions;
 -- Synthetic code-generation substitute; production keeps extensions.gen_random_bytes.
 create function extensions.gen_random_bytes(integer) returns bytea language sql as $$ select decode(replace(gen_random_uuid()::text,'-',''),'hex') $$;
 create table assessment_modules(slug text primary key,active boolean,title text);
 create table assessment_questions(id uuid default gen_random_uuid(),assessment_slug text,question_key text,question_number int,question_type text,question_text text,domain text,options jsonb,correct_answer text,accepted_answers jsonb,explanation text);
 insert into assessment_modules values('preclass_math',true,'Math'),('blueprint_day1',true,'Blueprint');
 insert into assessment_questions(assessment_slug,question_key,question_number,question_type,domain,correct_answer,accepted_answers)
 values('preclass_math','q1',1,'text','Math','2','["2"]'),('blueprint_day1','q1',1,'mc','Blueprint','A','[]');`);
 await db.exec(readFileSync('supabase/migrations/20260913171000_demo_classroom_ephemeral.sql','utf8'));
 await db.exec(`insert into demo_classroom_sessions(join_code,activity_key,title,course_code,day_number,created_at,expires_at)
 values('LEGACY','preclass_math','Demo','DEMO',1,now()-interval '3 hours',now()+interval '30 minutes');`);
 await db.exec(readFileSync('supabase/migrations/20261011134243_demo_classroom_resource_limits.sql','utf8'));
 expect((await db.query<{expired:boolean}>('select expires_at<now() expired from demo_classroom_sessions')).rows[0].expired).toBe(true);
},30000);
beforeEach(async()=>{await db.exec("delete from demo_classroom_sessions; update private.demo_creation_budget set writes=0,window_started_at=clock_timestamp();");});
afterAll(async()=>{await db?.close();});
async function create(activity='preclass_math'){
 return (await db.query<{s:{session_id:string;join_code:string;instructor_token:string}}>('select create_demo_classroom_session($1,$2,$3,1) s',[activity,'Demo','DEMO'])).rows[0].s;
}
const connect=(code:string,name:string)=>db.query('select connect_demo_classroom_student($1,$2)',[code,name]);
const submit=(code:string,name:string,answers:unknown)=>db.query<{result:{score:number}}>('select submit_demo_classroom_assessment($1,$2,$3::jsonb) result',[code,name,JSON.stringify(answers)]);

describe('public demo resource boundaries',()=>{
 it.each(['preclass_math','blueprint_day1'])('preserves cross-device scoring and instructor-only results for %s',async activity=>{
  const s=await create(activity);
  await connect(s.join_code,'Demo Student');
  expect((await submit(s.join_code,'Demo Student',{q1:activity==='preclass_math'?'2':'A'})).rows[0].result.score).toBe(1);
  await expect(db.query('select get_demo_classroom_results($1,$2)',[s.session_id,s.instructor_token])).resolves.toBeDefined();
  await expect(db.query('select get_demo_classroom_results($1,gen_random_uuid())',[s.session_id])).rejects.toThrow('not found');
 });
 it('bounds both participant entry points but preserves existing participants at capacity',async()=>{
  const s=await create();
  await db.query("insert into demo_classroom_participants(session_id,student_name) select $1,'Student '||n from generate_series(1,60) n",[s.session_id]);
  await expect(connect(s.join_code,'Extra student')).rejects.toThrow('capacity');
  await expect(submit(s.join_code,'Direct submission',{q1:'2'})).rejects.toThrow('capacity');
  await connect(s.join_code,'Student 1');
  await submit(s.join_code,'Student 1',{q1:'2'});
  await submit(s.join_code,'Student 1',{q1:'1'});
  expect((await db.query('select count(*)::int n from demo_classroom_submissions')).rows[0]).toEqual({n:1});
 });
 it.each([null,[],{q1:{nested:'2'}},{q1:2},{q1:'x'.repeat(2001)}, {q1:'2',extra:'x'.repeat(65536)}])('rejects malformed or oversized answers %#',async answers=>{
  const s=await create();
  await expect(submit(s.join_code,'Student',answers)).rejects.toThrow();
  expect((await db.query('select count(*)::int n from demo_classroom_submissions')).rows[0]).toEqual({n:0});
 });
 it('rejects SQL-null answers',async()=>{const s=await create();await expect(db.query('select submit_demo_classroom_assessment($1,$2,null)',[s.join_code,'Student'])).rejects.toThrow('answered');});
 it('caps renewal at two hours and rejects further access after expiry',async()=>{
  const s=await create();
  await db.query("update demo_classroom_sessions set created_at=clock_timestamp()-interval '110 minutes' where id=$1",[s.session_id]);
  await connect(s.join_code,'Student');
  expect((await db.query('select expires_at<=created_at+interval \'2 hours\' bounded from demo_classroom_sessions')).rows[0]).toEqual({bounded:true});
  await db.query("update demo_classroom_sessions set created_at=clock_timestamp()-interval '3 hours' where id=$1",[s.session_id]);
  await expect(connect(s.join_code,'Student')).rejects.toThrow('expired');
  await expect(submit(s.join_code,'Student',{q1:'2'})).rejects.toThrow('expired');
 });
 it('limits create churn even after a session is ended',async()=>{
  const s=await create();
  await db.query('select end_demo_classroom_session($1,$2)',[s.session_id,s.instructor_token]);
  await db.exec('update private.demo_creation_budget set writes=20');
  await expect(create()).rejects.toThrow('busy');
  await db.exec("update private.demo_creation_budget set window_started_at=clock_timestamp()-interval '2 minutes'");
  await expect(create()).resolves.toBeDefined();
 });
 it('bounds active sessions and frees expired slots',async()=>{
  await db.exec("insert into demo_classroom_sessions(join_code,activity_key,title,course_code,day_number) select 'CODE'||n,'preclass_math','Demo','DEMO',1 from generate_series(1,100) n");
  await expect(create()).rejects.toThrow('capacity');
  await db.exec("update demo_classroom_sessions set expires_at=clock_timestamp()-interval '1 second'");
  await expect(create()).resolves.toBeDefined();
 });
 it('limits both connect and submit writes and resets the window',async()=>{
  const s=await create();
  await db.exec('update demo_classroom_sessions set writes_in_window=600');
  await expect(connect(s.join_code,'Student')).rejects.toThrow('busy');
  await expect(submit(s.join_code,'Student',{q1:'2'})).rejects.toThrow('busy');
  await db.exec("update demo_classroom_sessions set write_window_started_at=clock_timestamp()-interval '2 minutes'");
  await connect(s.join_code,'Student');
  expect((await db.query('select writes_in_window from demo_classroom_sessions')).rows[0]).toEqual({writes_in_window:1});
 });
 it('allows 60 participants to join, heartbeat every 15 seconds and submit in the same minute',async()=>{
  const s=await create();
  await db.query("select connect_demo_classroom_student($1,'Student '||n) from generate_series(1,60) n,generate_series(1,5) heartbeat",[s.join_code]);
  await db.query("select submit_demo_classroom_assessment($1,'Student '||n,'{\"q1\":\"2\"}'::jsonb) from generate_series(1,60) n",[s.join_code]);
  expect((await db.query('select count(*)::int n from demo_classroom_submissions')).rows[0]).toEqual({n:60});
 });
 it('keeps the limiter private and existing anonymous RPC access',async()=>{
  expect((await db.query("select has_function_privilege('anon','private.reserve_demo_participant_write(uuid,text)','execute') allowed")).rows[0]).toEqual({allowed:false});
  expect((await db.query("select has_table_privilege('anon','private.demo_creation_budget','update') allowed")).rows[0]).toEqual({allowed:false});
  await db.exec('set role anon');
  try{await expect(create()).resolves.toBeDefined();}finally{await db.exec('reset role');}
 });
});
