import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';

const db = new PGlite();
const instructor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const owner = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const unrelated = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const trainingTables = ['training_activity','training_day_delivery','training_notes','training_section_state','training_session_members','training_sessions'];
const tables = ['classroom_submissions', 'job_card_submissions', ...trainingTables];
const identity = (aal: unknown = 'aal1', sub = instructor) => ({role:'authenticated', sub, aal});
beforeAll(async () => {
  await db.exec(`create role authenticated; create role anon; create schema auth; create schema private;
    create table auth.mfa_factors(user_id uuid, status text, factor_type text);
    alter table auth.mfa_factors enable row level security;
    create function public.fixture_uid() returns uuid language sql stable as
      $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
    create table public.training_report_outbox(id int primary key);`);
  for (const table of tables) await db.exec(`
    create table public.${table}(id int primary key, instructor_id uuid);
    insert into public.${table} values(1,'${instructor}');
    alter table public.${table} enable row level security;
    grant select on public.${table} to authenticated;
    create policy fixture_instructor_or_owner on public.${table} for select to authenticated
      using (instructor_id = public.fixture_uid() or public.fixture_uid() = '${owner}'::uuid);`);
  await db.exec('create publication supabase_realtime for table public.classroom_submissions, public.job_card_submissions');
  await db.exec(readFileSync('supabase/migrations/20261017122536_enforce_realtime_enrolled_mfa.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20261017134838_complete_training_realtime_mfa.sql','utf8'));
});
beforeEach(async () => {
  await db.exec(`reset role; truncate auth.mfa_factors;
    insert into auth.mfa_factors values('${instructor}','verified','totp'), ('${owner}','verified','totp');`);
});
afterAll(async () => { await db.close(); });
async function request(claims: unknown, role = 'authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)",[typeof claims === 'string' ? claims : JSON.stringify(claims)]);
  await db.exec(`set role ${role}`);
}
async function expectRows(count: number) {
  // Deliberately no PostgREST pre-request hook: exercise the Realtime boundary.
  for (const table of tables) expect((await db.query(`select * from public.${table}`)).rows).toHaveLength(count);
}
it('blocks enrolled AAL1 through both instructor and owner authorization, allowing AAL2', async () => {
  for (const sub of [instructor, owner]) {
    await request(identity('aal1',sub)); await expectRows(0);
    await request(identity('aal2',sub)); await expectRows(1);
  }
  await request(identity('aal2',unrelated)); await expectRows(0);
});
it('preserves unenrolled and unverified-factor access, and checks enrollment against an unchanged JWT', async () => {
  await db.exec('delete from auth.mfa_factors');
  await request(identity()); await expectRows(1);
  await db.exec(`reset role; insert into auth.mfa_factors values('${instructor}','unverified','totp')`);
  await db.exec('set role authenticated'); await expectRows(1);
  await db.exec("reset role; update auth.mfa_factors set status='verified'");
  await db.exec('set role authenticated'); await expectRows(0);
  await db.exec('reset role; delete from auth.mfa_factors');
  await db.exec('set role authenticated'); await expectRows(1);
});
it('requires exact AAL2 for every verified factor type and ignores editable metadata', async () => {
  for (const type of ['totp','phone','webauthn','recovery_code']) {
    await db.exec('reset role'); await db.query('update auth.mfa_factors set factor_type=$1',[type]);
    for (const aal of ['aal1', null, '', 'AAL2', 'aal3', ['aal2'], {aal:'aal2'}]) {
      await request({...identity(aal), user_metadata:{aal:'aal2',mfa_enabled:false,role:'platform_owner'}, app_metadata:{factors:[]}});
      await expectRows(0);
    }
  }
  await request({role:'authenticated',sub:instructor}); await expectRows(0);
});
it('fails closed on malformed identity without exposing factor data', async () => {
  for (const claims of ['', 'not json', {}, [], {role:'authenticated'}, identity('aal2','invalid'), {...identity('aal2'),role:'service_role'}]) {
    await request(claims);
    expect((await db.query<{allowed:boolean}>('select private.meets_enrolled_mfa() as allowed')).rows[0].allowed).toBeFalsy();
  }
  await request(identity('aal2'));
  await expect(db.query('select * from auth.mfa_factors')).rejects.toMatchObject({code:'42501'});
  await request({}, 'anon');
  await expect(db.query('select private.meets_enrolled_mfa()')).rejects.toMatchObject({code:'42501'});
  await expect(db.query('select * from public.classroom_submissions')).rejects.toMatchObject({code:'42501'});
});
it('cannot be bypassed by another permissive owner policy', async () => {
  await db.exec('create policy fixture_extra_owner on public.job_card_submissions for select to authenticated using (true)');
  try { await request(identity()); await expectRows(0); }
  finally { await db.exec('reset role; drop policy fixture_extra_owner on public.job_card_submissions'); }
});
it('retains INSERT/UPDATE publication while suppressing DELETE and TRUNCATE payloads that bypass row checks', async () => {
  const result = await db.query('select pubinsert,pubupdate,pubdelete,pubtruncate from pg_publication where pubname=$1',['supabase_realtime']);
  expect(result.rows).toEqual([{pubinsert:true,pubupdate:true,pubdelete:false,pubtruncate:false}]);
  const members = await db.query<{tablename:string}>("select tablename from pg_publication_tables where pubname='supabase_realtime'");
  expect(members.rows.map(row=>row.tablename).sort()).toEqual([...tables,'training_report_outbox'].sort());
  const helpers = await db.query('select prosecdef,provolatile,proconfig from pg_proc where oid=$1::regprocedure',['private.meets_enrolled_mfa()']);
  expect(helpers.rows).toEqual([{prosecdef:true,provolatile:'s',proconfig:['search_path=""']}]);
});
it.each(['production', 'unexpected'])('checks the %s publication layout before changing event semantics', async layout => {
  const isolated = new PGlite();
  try {
    await isolated.exec(`create role authenticated; create schema auth; create schema private;
      create table auth.mfa_factors(user_id uuid,status text);`);
    const members = [...tables,'training_report_outbox', ...(layout === 'unexpected' ? ['unreviewed_table'] : [])];
    for (const table of members) await isolated.exec(`create table public.${table}(id int primary key);`);
    await isolated.exec(`create publication supabase_realtime for table ${members.map(table=>'public.'+table).join(',')}`);
    const migration = readFileSync('supabase/migrations/20261017122536_enforce_realtime_enrolled_mfa.sql','utf8');
    if (layout === 'unexpected') {
      await expect(isolated.exec(migration)).rejects.toThrow('Review Realtime publication membership');
      await isolated.exec('rollback');
      expect((await isolated.query('select pubdelete from pg_publication')).rows).toEqual([{pubdelete:true}]);
    } else {
      await isolated.exec(migration);
      await isolated.exec(readFileSync('supabase/migrations/20261017134838_complete_training_realtime_mfa.sql','utf8'));
      expect((await isolated.query("select count(*)::int n from pg_publication_tables where pubname='supabase_realtime'")).rows).toEqual([{n:9}]);
    }
  } finally { await isolated.close(); }
});
