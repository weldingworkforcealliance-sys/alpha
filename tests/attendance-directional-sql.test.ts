import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = 'supabase/migrations/';
const base = readFileSync(root + '20260905143000_student_attendance_module.sql', 'utf8');
const authority = readFileSync(root + '20260910202000_scope_attendance_to_pair_authority.sql', 'utf8');
const fix = readFileSync(root + '20260924211144_directional_attendance_session_scope.sql', 'utf8');
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
let db: PGlite;
const day = '2026-09-24';
const functions = ['open_attendance_session', 'set_attendance_record', 'mark_all_attendance', 'reset_attendance_session', 'finalize_attendance_session'];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    create table auth.users(id uuid primary key);
    create table public.schools(id uuid primary key);
    create table public.sections(id uuid primary key);
    create table public.section_calendars(section_id uuid, start_date date, end_date date, created_at timestamptz);
    create function auth.uid() returns uuid language sql as $$ select '${id(1)}'::uuid $$;
    create function private.attendance_can_manage_pair(uuid,uuid) returns boolean language sql as $$ select $2 is not null $$;
    create function public.write_audit_event(uuid,text,text,uuid,jsonb) returns void language plpgsql as $$ begin end $$;
    insert into auth.users values ('${id(1)}'); insert into schools values ('${id(2)}');
    insert into sections values ('${id(105)}'),('${id(110)}'),('${id(205)}'),('${id(210)}');
  `);
  // Use the repository's real attendance tables and pre-fix RPCs; only surrounding
  // school/auth/audit infrastructure is stubbed. No network or student data.
  await db.exec(base.slice(base.indexOf('create table'), base.indexOf('create index if not exists attendance_pairs_primary')));
  for (const name of functions) {
    const declaration = authority.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?^\\$\\$;`, 'm'))?.[0];
    if (!declaration) throw Error(name);
    await db.exec(declaration);
  }
  // Mirror grants so tests prove that the old mutation endpoints are closed.
  await db.exec(`grant execute on all functions in schema public to authenticated;`);
  await db.exec(fix);
  for (const n of [105,205]) {
    await db.query(`insert into attendance_pairs(id,school_id,pair_name,primary_section_id,completion_section_id)
      values($1,$2,$3,$4,$5)`, [id(n+1000),id(2),`WLD ${n}/${n+5}`,id(n),id(n+5)]);
    await db.query(`insert into attendance_students(id,school_id,display_name) values($1,$2,$3)`,[id(n+2000),id(2),`Synthetic ${n}`]);
    await db.query(`insert into attendance_pair_enrollments(school_id,pair_id,student_id,created_at)
      values($1,$2,$3,'2026-09-01')`,[id(2),id(n+1000),id(n+2000)]);
  }
}, 30000);
afterAll(async () => { await db?.close(); });

async function open(section: number, date = day) {
  const result = await db.query<{session_id:string}>(`select * from open_attendance_session($1,$2)`, [id(section),date]);
  return result.rows[0].session_id;
}
async function record(session: string) {
  return (await db.query<{initial_status:string|null;final_status:string|null;notes:string|null}>(
    'select initial_status,final_status,notes from attendance_records where session_id=$1',[session])).rows[0];
}
async function mark(session: string, section: number, date = day) {
  return db.query('select mark_all_section_attendance($1,$2,$3)',[session,id(section),date]);
}
async function save(session:string,section:number,initial:string|null,final:string|null=null,notes:string|null=null,date=day) {
  return db.query('select set_section_attendance_record($1,$2,$3,$4,$5,$6,$7,$8)',
    [session,id(section),date,id((section===110||section===210?section-5:section)+2000),initial,final,[],notes]);
}

describe.each([105,205])('directional WLD %i attendance', (primary) => {
  const completion=primary+5;
  it('opens a fresh primary roster unmarked and does not mark on repeated open', async()=>{
    const session=await open(primary);
    expect(await record(session)).toEqual({initial_status:null,final_status:null,notes:null});
    expect(await open(primary)).toBe(session);
    expect((await record(session)).initial_status).toBeNull();
  });
  it('opening completion first cannot populate primary attendance',async()=>{
    const date='2026-09-25';
    const session=await open(completion,date);
    await expect(mark(session,completion,date)).rejects.toThrow('primary course');
    await expect(save(session,completion,'present','present',null,date)).rejects.toThrow('primary course');
    await expect(db.query('select reset_section_attendance($1,$2,$3)',[session,id(completion),date])).rejects.toThrow('primary course');
    expect(await open(primary,date)).toBe(session);
    expect((await record(session)).initial_status).toBeNull();
  });
  it('reopens explicitly saved primary attendance and shares it with same-day completion',async()=>{
    const session=await open(primary);
    await save(session,primary,'late');
    expect((await record(await open(primary))).initial_status).toBe('late');
    expect((await record(await open(completion))).initial_status).toBe('late');
  });
  it('completion saves and stale initial copies cannot overwrite primary marks',async()=>{
    const session=await open(completion);
    await save(session,completion,'present','left_early','Saved completion');
    expect(await record(await open(primary))).toEqual({initial_status:'late',final_status:'left_early',notes:'Saved completion'});
    await save(session,primary,'excused');
    expect(await record(session)).toEqual({initial_status:'excused',final_status:'left_early',notes:'Saved completion'});
  });
  it('does not inherit prior-day attendance',async()=>{
    const fresh=await open(primary,'2026-09-28');
    expect((await record(fresh)).initial_status).toBeNull();
    expect((await record(await open(completion,'2026-09-28'))).initial_status).toBeNull();
  });
  it('rejects stale session IDs paired with another date or another class',async()=>{
    const old=await open(primary);
    await expect(mark(old,primary,'2026-09-28')).rejects.toThrow('class or date changed');
    await expect(mark(old,primary===105?205:105)).rejects.toThrow('class or date changed');
    await expect(save(old,primary,'present',null,null,'2026-09-28')).rejects.toThrow('class or date changed');
    await expect(db.query('select reset_section_attendance($1,$2,$3)',[old,id(primary),'2026-09-28'])).rejects.toThrow('class or date changed');
    await expect(db.query('select finalize_section_attendance($1,$2,$3)',[old,id(completion),'2026-09-28'])).rejects.toThrow('class or date changed');
    expect((await record(old)).initial_status).toBe('excused');
  });
  it('preserves finalized attendance on reopen and rejects further instructor edits',async()=>{
    const session=await open(completion);
    await db.query('select finalize_section_attendance($1,$2,$3)',[session,id(completion),day]);
    expect(await record(await open(primary))).toEqual({initial_status:'excused',final_status:'left_early',notes:'Saved completion'});
    await expect(mark(session,primary)).rejects.toThrow('Finalized');
  });
});

it('rejects null context and removes access to unscoped mutations for old tabs',async()=>{
  const session=await open(105);
  await expect(db.query('select mark_all_section_attendance($1,null,$2)',[session,day])).rejects.toThrow('class or date changed');
  await expect(db.query('select mark_all_section_attendance($1,$2,null)',[session,id(105)])).rejects.toThrow('class or date changed');
  for(const signature of ['set_attendance_record(uuid,uuid,text,text,text[],text)','mark_all_attendance(uuid,text)','reset_attendance_session(uuid)','finalize_attendance_session(uuid,uuid,text)']) {
    const result=await db.query<{allowed:boolean}>('select has_function_privilege(\'authenticated\',$1,\'execute\') as allowed',[signature]);
    expect(result.rows[0].allowed).toBe(false);
  }
});
it('allows explicit primary bulk save/reset without touching other dates',async()=>{
  const session=await open(105,'2026-09-29');
  await mark(session,105,'2026-09-29');
  expect((await record(await open(110,'2026-09-29'))).initial_status).toBe('present');
  await db.query('select reset_section_attendance($1,$2,$3)',[session,id(105),'2026-09-29']);
  expect((await record(await open(105,'2026-09-29'))).initial_status).toBeNull();
  expect((await record(await open(105))).initial_status).toBe('excused');
});
it('preserves existing saved and finalized records when installing the migration',async()=>{
  const session=await open(105);
  const before=await db.query('select * from attendance_records where session_id=$1',[session]);
  await db.exec(fix);
  expect((await db.query('select * from attendance_records where session_id=$1',[session])).rows).toEqual(before.rows);
  const grants=await db.query<{allowed:boolean;anonymous:boolean}>(`select
    has_function_privilege('authenticated','set_section_attendance_record(uuid,uuid,date,uuid,text,text,text[],text)','execute') as allowed,
    has_function_privilege('anon','set_section_attendance_record(uuid,uuid,date,uuid,text,text,text[],text)','execute') as anonymous`);
  expect(grants.rows[0]).toEqual({allowed:true,anonymous:false});
});
