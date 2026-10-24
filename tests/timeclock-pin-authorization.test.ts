import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, expect, it } from 'vitest';

let db: PGlite;
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
beforeAll(async () => {
 db = new PGlite();
 await db.exec(`create schema private; create schema auth; create schema extensions;
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
 create function private.timeclock_is_manager(uuid) returns boolean language sql as $$ select current_setting('test.manager',true)=$1::text $$;
 -- Hashing is stubbed: these tests verify authorization and state, not cryptography.
 create function extensions.gen_salt(text) returns text language sql as $$ select 'test'::text $$;
 create function extensions.crypt(text,text) returns text language sql as $$ select 'test-hash:'||$1 $$;
 create table public.timeclock_employees(id uuid primary key,school_id uuid,profile_id uuid,pin_configured boolean default false,updated_at timestamptz);
 create table private.timeclock_employee_credentials(employee_id uuid primary key,pin_hash text,pin_updated_at timestamptz,set_by uuid);
 create table public.audit_log(school_id uuid,user_id uuid,action text,entity_type text,entity_id uuid,details jsonb);
 insert into public.timeclock_employees(id,school_id,profile_id) values ('${id(10)}','${id(20)}',null),('${id(11)}','${id(20)}','${id(1)}');`);
 await db.exec(readFileSync('supabase/migrations/20261024131438_timeclock_pin_null_authorization.sql', 'utf8'));
 await db.exec('create function public.timeclock_set_pin(uuid,text) returns boolean language sql as $$ select private.timeclock_set_pin_impl($1,$2) $$;');
}, 30000);
afterAll(async () => { await db?.close(); });
async function identity(uid: string, managedSchool = 'none') {
 await db.query("select set_config('test.uid',$1,false),set_config('test.manager',$2,false)", [uid, managedSchool]);
}
async function state() {
 return (await db.query(`select (select jsonb_agg(e) from timeclock_employees e) employees,
 (select jsonb_agg(c) from private.timeclock_employee_credentials c) credentials,
 (select jsonb_agg(a) from audit_log a) audit`)).rows;
}
it('rejects unlinked credential creation and overwrite through both entry points without side effects', async () => {
 for (const existing of [false, true]) {
  if (existing) { await identity(id(1),id(20)); await db.query('select public.timeclock_set_pin($1,$2)',[id(10),'1234']); }
  for (const manager of ['none',id(99)]) {
   await identity(id(2),manager);
   const before = await state();
   for (const fn of ['public.timeclock_set_pin','private.timeclock_set_pin_impl']) {
    await expect(db.query(`select ${fn}($1,$2)`,[id(10),'5678'])).rejects.toThrow('permission');
   }
   expect(await state()).toEqual(before);
  }
 }
});
it('preserves linked self-service and management of unlinked employees', async () => {
 await identity(id(1));
 await db.query('select public.timeclock_set_pin($1,$2)',[id(11),'1234']);
 await identity(id(2),id(20));
 await db.query('select public.timeclock_set_pin($1,$2)',[id(10),'5678']);
 expect((await db.query('select pin_configured from timeclock_employees where id=$1',[id(10)])).rows[0]).toEqual({pin_configured:true});
});
it('rejects linked-other, missing identity, and invalid PIN without changing state', async () => {
 await identity(id(2)); const before = await state();
 await expect(db.query('select public.timeclock_set_pin($1,$2)',[id(11),'1234'])).rejects.toThrow('permission');
 await identity('');
 await expect(db.query('select public.timeclock_set_pin($1,$2)',[id(10),'1234'])).rejects.toThrow('Authentication');
 await identity(id(1));
 await expect(db.query('select public.timeclock_set_pin($1,$2)',[id(11),'x'])).rejects.toThrow('PIN must');
 expect(await state()).toEqual(before);
});
