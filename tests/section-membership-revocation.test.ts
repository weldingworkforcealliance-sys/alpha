import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
const db = new PGlite();
const school = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const section = 'aaaaaaaa-0000-4000-8000-000000000003';
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select '98471f9d-5293-43bc-b328-73777daae587'::uuid $$;
    create table public.school_memberships(school_id uuid,user_id uuid,status text);
    create table public.section_instructors(school_id uuid,section_id uuid,instructor_id uuid,active boolean);
    create table public.planner_day_delivery(school_id uuid,section_id uuid,instructor_id uuid,delivery_status text);
    create function public.is_school_member(check_school_id uuid) returns boolean language sql as $$
      select exists(select 1 from public.school_memberships where school_id=check_school_id and user_id=auth.uid() and status='active') $$;
    insert into public.school_memberships values('${school}',auth.uid(),'active');
    insert into public.planner_day_delivery values('${school}','${section}',auth.uid(),'in_progress');`);
  await db.exec(readFileSync('supabase/migrations/20261016193000_require_active_membership_for_section_access.sql','utf8'));
});
afterAll(async () => { await db.close(); });
it('keeps active coverage access but rejects revoked, suspended, and invited memberships', async () => {
  for (const status of ['active','revoked','suspended','invited']) {
    await db.query('update school_memberships set status=$1',[status]);
    const result=await db.query<{allowed:boolean}>('select public.is_section_instructor($1,$2) as allowed',[school,section]);
    expect(result.rows[0].allowed).toBe(status==='active');
  }
});
it('keeps assigned-instructor access and rejects unrelated sections', async () => {
  await db.exec(`update school_memberships set status='active'; update planner_day_delivery set delivery_status='completed';
    insert into section_instructors values('${school}','${section}',auth.uid(),true);`);
  expect((await db.query<{allowed:boolean}>('select public.is_section_instructor($1,$2) as allowed',[school,section])).rows[0].allowed).toBe(true);
  expect((await db.query<{allowed:boolean}>('select public.is_section_instructor($1,$2) as allowed',[school,'aaaaaaaa-0000-4000-8000-000000000004'])).rows[0].allowed).toBe(false);
  await db.exec(`update school_memberships set status='revoked'`);
  expect((await db.query<{allowed:boolean}>('select public.is_section_instructor($1,$2) as allowed',[school,section])).rows[0].allowed).toBe(false);
});
