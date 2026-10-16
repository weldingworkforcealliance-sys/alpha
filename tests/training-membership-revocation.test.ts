import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';

const db = new PGlite();
const user = '98471f9d-5293-43bc-b328-73777daae587';
const school = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const session = 'aaaaaaaa-0000-4000-8000-000000000003';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
beforeAll(async () => {
  await db.exec(`create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('test.uid',true),'')::uuid $$;
    create table school_memberships(school_id uuid,user_id uuid,status text,role text);
    create table platform_owners(user_id uuid);
    create table training_sessions(id uuid,school_id uuid,created_by uuid,status text);
    create table training_session_members(training_session_id uuid,user_id uuid,connected boolean);
    create table training_notes(training_session_id uuid,body text);
    create function is_school_member(s uuid) returns boolean language sql security definer as $$
      select exists(select 1 from public.school_memberships where school_id=s and user_id=auth.uid() and status='active') $$;
    create function is_platform_owner() returns boolean language sql security definer as $$
      select exists(select 1 from public.platform_owners where user_id=auth.uid()) $$;
    create function can_manage_school(s uuid) returns boolean language sql security definer as $$
      select public.is_platform_owner() or exists(select 1 from public.school_memberships where school_id=s and user_id=auth.uid() and status='active' and role='school_admin') $$;`);
  await db.exec(readFileSync('supabase/migrations/20261016204359_require_active_training_membership.sql','utf8'));
  // Exercise the deployed training-note SELECT policy through the actual predicates.
  await db.exec(`alter table training_notes enable row level security;
    grant usage on schema public,auth to authenticated;
    grant select on training_notes to authenticated;
    create policy training_notes_select on training_notes for select to authenticated
      using (is_training_session_member(training_session_id) or can_manage_training_session(training_session_id));`);
});
beforeEach(async () => {
  await db.exec(`reset role; truncate school_memberships,platform_owners,training_sessions,training_session_members,training_notes;
    select set_config('test.uid','${user}',false);
    insert into school_memberships values('${school}','${user}','active','instructor');
    insert into training_sessions values('${session}','${school}','${user}','active');
    insert into training_session_members values('${session}','${user}',true);
    insert into training_notes values('${session}','Private training note');`);
});
afterAll(async () => { await db.close(); });
async function permissions() {
  return (await db.query<{member:boolean;manager:boolean}>(
    'select is_training_session_member($1) as member,can_manage_training_session($1) as manager',[session])).rows[0];
}
it('revokes stale connected-member and creator access for all inactive membership states', async () => {
  expect(await permissions()).toEqual({member:true,manager:true});
  for (const status of ['revoked','suspended','invited']) {
    await db.query('update school_memberships set status=$1',[status]);
    expect(await permissions()).toEqual({member:false,manager:false});
  }
  await db.exec('delete from school_memberships');
  expect(await permissions()).toEqual({member:false,manager:false});
});
it('does not accept active membership in a different school', async () => {
  await db.query('update school_memberships set school_id=$1',[other]);
  expect(await permissions()).toEqual({member:false,manager:false});
});
it('preserves active participant, creator, manager, and platform-owner behavior', async () => {
  expect(await permissions()).toEqual({member:true,manager:true});
  await db.query('update training_sessions set created_by=$1',[other]);
  expect(await permissions()).toEqual({member:true,manager:false});
  await db.exec("update school_memberships set role='school_admin'; update training_session_members set connected=false");
  expect(await permissions()).toEqual({member:false,manager:true});
  await db.exec(`delete from school_memberships; insert into platform_owners values('${user}'); update training_session_members set connected=true`);
  expect(await permissions()).toEqual({member:true,manager:true});
});
it('retains connection/status gates and rejects anonymous or missing-session membership', async () => {
  await db.exec('update training_session_members set connected=false');
  expect((await permissions()).member).toBe(false);
  await db.exec("update training_session_members set connected=true; update training_sessions set status='ended'");
  expect((await permissions()).member).toBe(false);
  await db.exec("select set_config('test.uid','',false)");
  expect(await permissions()).toEqual({member:false,manager:false});
  await db.exec(`select set_config('test.uid','${user}',false); delete from training_sessions`);
  expect(await permissions()).toEqual({member:false,manager:false});
});
it('hides previously readable training notes immediately after revocation', async () => {
  await db.exec('set role authenticated');
  expect((await db.query('select * from training_notes')).rows).toHaveLength(1);
  await db.exec("reset role; update school_memberships set status='revoked'; set role authenticated");
  expect((await db.query('select * from training_notes')).rows).toHaveLength(0);
  await db.exec('reset role');
});

