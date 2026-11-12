import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseContact } from '../lib/contact';

const db=new PGlite();
const lead=parseContact({name:'Test Contact',institution:'Test School',email:'test@example.com',inquiry_type:'LTG demonstration'});
let id:string;
beforeAll(async()=>{
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to authenticated,service_role;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    create function public.is_platform_owner() returns boolean language sql as $$ select auth.uid()='11111111-1111-1111-1111-111111111111'::uuid $$;`);
  await db.exec(readFileSync(new URL('../supabase/migrations/20261112181727_contact_leads.sql',import.meta.url),'utf8'));
},30000);
afterAll(async()=>{await db.close();});
describe('contact persistence and actual database permissions',()=>{
  it('persists once and deduplicates retries',async()=>{
    await db.exec('set role service_role');
    const query='select public.submit_contact_lead($1::jsonb,$2,$3::uuid) result';
    const args=[JSON.stringify(lead),'a'.repeat(64),'22222222-2222-2222-2222-222222222222'];
    const first=await db.query<{result:{id:string;duplicate:boolean}}>(query,args);id=first.rows[0].result.id;
    expect(first.rows[0].result.duplicate).toBe(false);
    const second=await db.query<{result:{id:string;duplicate:boolean}}>(query,args);
    expect(second.rows[0].result).toEqual({id,duplicate:true});await db.exec('reset role');
  });
  it('enforces the durable five-per-hour limit',async()=>{
    await db.exec('set role service_role');
    for(let i=0;i<5;i++){
      const r=await db.query<{result:{rate_limited?:boolean}}>('select public.submit_contact_lead($1::jsonb,$2,gen_random_uuid()) result',[JSON.stringify(lead),'a'.repeat(64)]);
      expect(Boolean(r.rows[0].result.rate_limited)).toBe(i===4);
    }await db.exec('reset role');
  });
  it('denies anonymous reads and direct submissions',async()=>{
    await db.exec('set role anon');
    await expect(db.query('select * from public.contact_leads')).rejects.toThrow(/permission denied/);
    await expect(db.query("select public.submit_contact_lead('{}'::jsonb,'x',gen_random_uuid())")).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
  });
  it('hides leads from a signed-in non-owner and denies updates',async()=>{
    await db.exec("set role authenticated; select set_config('test.uid','33333333-3333-3333-3333-333333333333',false)");
    expect((await db.query('select * from public.contact_leads')).rows).toHaveLength(0);
    expect((await db.query("update public.contact_leads set status='Partner' returning id")).rows).toHaveLength(0);
    await expect(db.query("select public.submit_contact_lead('{}'::jsonb,'x',gen_random_uuid())")).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
  });
  it('allows owner status/notes updates and records history, but forbids contact edits',async()=>{
    await db.exec("set role authenticated; select set_config('test.uid','11111111-1111-1111-1111-111111111111',false)");
    expect((await db.query('select * from public.contact_leads')).rows).toHaveLength(5);
    await db.query("update public.contact_leads set status='Demo Scheduled',notes='Follow up Friday' where id=$1",[id]);
    expect((await db.query('select new_status from public.contact_lead_history where lead_id=$1',[id])).rows).toEqual([{new_status:'Demo Scheduled'}]);
    await expect(db.query("update public.contact_leads set email='changed@example.com' where id=$1",[id])).rejects.toThrow(/permission denied/);
    await expect(db.query("update public.contact_leads set status='invalid' where id=$1",[id])).rejects.toThrow(/check constraint/);
    await expect(db.query('delete from public.contact_leads')).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
  });
});
