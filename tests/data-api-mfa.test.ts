import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';

const db = new PGlite();
const enrolled = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create role authenticator; create role unrelated;
    create schema auth; create schema private;
    create table auth.mfa_factors(user_id uuid,status text,factor_type text);
    alter table auth.mfa_factors enable row level security;`);
  await db.exec(readFileSync('supabase/migrations/20261016211928_enforce_enrolled_mfa_data_api.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20261016212848_correct_mfa_denial_response.sql','utf8'));
});
beforeEach(async () => {
  await db.exec(`reset role; truncate auth.mfa_factors;
    insert into auth.mfa_factors values('${enrolled}','verified','totp');`);
});
afterAll(async () => { await db.close(); });
async function request(role: string, claims: unknown) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)",[typeof claims==='string'?claims:JSON.stringify(claims)]);
  await db.exec(`set role ${role}`);
  return db.query('select private.enforce_enrolled_mfa()');
}
const identity = (aal: unknown = 'aal1', sub = enrolled) => ({role:'authenticated',sub,aal});
it('returns the complete PostgREST HTTP denial envelope', async () => {
  const error = await request('authenticated',identity()).catch((error: unknown) => error) as {message:string;detail:string};
  expect(JSON.parse(error.message)).toMatchObject({code:'LTG_MFA_REQUIRED',details:null,hint:'Complete MFA sign-in.'});
  expect(JSON.parse(error.detail)).toEqual({status:403,status_text:'Forbidden',headers:{}});
});
it('denies enrolled password-only sessions, missing AAL and malformed assurance values', async () => {
  for (const aal of ['aal1', null, '', 'aal3', 'AAL2', ['aal2'], {aal:'aal2'}]) {
    await expect(request('authenticated',identity(aal))).rejects.toMatchObject({code:'PGRST'});
  }
  await expect(request('authenticated',{role:'authenticated',sub:enrolled})).rejects.toMatchObject({code:'PGRST'});
});
it('allows AAL2, nonenrolled AAL1, and unverified enrollment without disabling tenant checks', async () => {
  await expect(request('authenticated',identity('aal2'))).resolves.toBeDefined();
  await expect(request('authenticated',identity('aal1',other))).resolves.toBeDefined();
  await db.exec("reset role; update auth.mfa_factors set status='unverified'");
  await expect(request('authenticated',identity())).resolves.toBeDefined();
});
it('uses current verified factors of every type, ignoring editable enrollment claims', async () => {
  const claims = {...identity(),user_metadata:{aal:'aal2',mfa_enabled:false},app_metadata:{factors:[]}};
  for (const type of ['totp','phone','webauthn','recovery_code']) {
    await db.exec('reset role');
    await db.query('update auth.mfa_factors set factor_type=$1',[type]);
    await expect(request('authenticated',claims)).rejects.toMatchObject({code:'PGRST'});
  }
  await db.exec('reset role; delete from auth.mfa_factors');
  await expect(request('authenticated',claims)).resolves.toBeDefined();
  await db.exec(`reset role; insert into auth.mfa_factors values('${enrolled}','verified','totp')`);
  await expect(request('authenticated',claims)).rejects.toMatchObject({code:'PGRST'});
});
it('does not exempt public paths, spoofed headers or owner metadata on authenticated requests', async () => {
  await db.query("select set_config('request.path','/rpc/get_job_card_by_code',false)");
  await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-aal':'aal2',role:'service_role'})]);
  await expect(request('authenticated',{...identity(),user_metadata:{role:'platform_owner'}})).rejects.toMatchObject({code:'PGRST'});
  await expect(request('authenticated',{...identity(),role:'service_role'})).rejects.toMatchObject({code:'42501'});
});
it('fails closed for missing or malformed authenticated identity', async () => {
  for (const claims of ['', 'not json', {}, {role:'authenticated'}, identity('aal2','not-a-uuid')]) {
    await expect(request('authenticated',claims)).rejects.toMatchObject({code:'42501'});
  }
});
it('permits anonymous and trusted service roles after impersonation, without granting factor access', async () => {
  for (const role of ['anon','service_role']) {
    await expect(request(role,{})).resolves.toBeDefined();
  }
  for (const role of ['anon','authenticated']) {
    await request(role,identity('aal2'));
    await expect(db.query('select * from auth.mfa_factors')).rejects.toMatchObject({code:'42501'});
  }
  await expect(request('unrelated',{})).rejects.toMatchObject({code:'42501'});
});
it('runs in GET/HEAD read-only transactions and registers the intended hook', async () => {
  await request('authenticated',identity('aal2'));
  await db.exec('begin read only');
  try { await expect(db.query('select private.enforce_enrolled_mfa()')).resolves.toBeDefined(); }
  finally { await db.exec('rollback; reset role'); }
  const config = await db.query<{rolconfig:string[]}>('select rolconfig from pg_roles where rolname=$1',['authenticator']);
  expect(config.rows[0].rolconfig).toContain('pgrst.db_pre_request=private.enforce_enrolled_mfa');
});
