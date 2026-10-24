import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, expect, it } from 'vitest';
let db: PGlite;
const uid='00000000-0000-0000-0000-000000000001';
const school='00000000-0000-0000-0000-000000000002';
const employee='00000000-0000-0000-0000-000000000003';
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create schema private; create schema auth;
 create table schools(id uuid primary key); create table profiles(id uuid primary key);
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
 create function private.timeclock_is_manager(uuid) returns boolean language sql as $$ select current_setting('test.manager',true)='yes' $$;
 create function private.timeclock_can_manage_payroll_school(uuid) returns boolean language sql as $$ select private.timeclock_is_manager($1) $$;
 create table audit_log(school_id uuid,user_id uuid,action text,entity_type text,entity_id uuid,details jsonb);
 insert into schools values ('${school}'); insert into profiles values ('${uid}');
 select set_config('test.uid','${uid}',false),set_config('test.manager','yes',false);`);
 for(const file of ['202609030003_timeclock_module.sql','202609030006_timeclock_weekly_payroll_reporting.sql']){
  const source=readFileSync('supabase/migrations/'+file,'utf8');
  for(const table of source.matchAll(/create table (?:if not exists )?(?:public|private)\.timeclock_[\s\S]*?\n\);/gi)) await db.exec(table[0]);
 }
 await db.exec(`alter table timeclock_entries add column requires_correction boolean not null default false;
 alter table timeclock_adjustments add column old_clock_in_method text, add column old_clock_out_method text, add column old_clock_in_actor uuid, add column old_clock_out_actor uuid;
 alter table timeclock_weekly_reports rename column adp_exported_by to report_downloaded_by;
 alter table timeclock_weekly_reports rename column adp_exported_at to report_downloaded_at;
 insert into timeclock_employees(id,school_id,profile_id,display_name) values ('${employee}','${school}','${uid}','Synthetic audit employee');`);
 await db.exec(readFileSync('tests/fixtures/timeclock-production-functions.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261024132608_timeclock_correction_resolution.sql','utf8'));
},30000);
afterAll(async()=>{await db?.close();});
async function entry(start:string,end:string|null,flag=true){
 const r=await db.query<{id:string}>('insert into timeclock_entries(school_id,employee_id,clock_in_at,clock_out_at,clock_in_method,requires_correction) values ($1,$2,$3,$4,\'self\',$5) returning id',[school,employee,start,end,flag]);
 return r.rows[0].id;
}
it('requires manager review, permits confirmation without changing timestamps and preserves audit evidence',async()=>{
 const start='2026-10-05T12:00:00Z',end='2026-10-05T18:00:00Z',id=await entry(start,end);
 await db.exec("select set_config('test.manager','no',false)");
 await expect(db.query('select private.timeclock_adjust_entry_impl($1,$2,$3,$4)',[id,start,end,'Confirmed actual times'])).rejects.toThrow('Manager permission');
 await db.exec("select set_config('test.manager','yes',false)");
 await db.query('select private.timeclock_adjust_entry_impl($1,$2,$3,$4)',[id,start,end,'Confirmed actual times']);
 expect((await db.query('select requires_correction,clock_in_method from timeclock_entries where id=$1',[id])).rows[0]).toEqual({requires_correction:false,clock_in_method:'self'});
 expect((await db.query('select count(*)::int n from timeclock_adjustments where entry_id=$1',[id])).rows[0]).toEqual({n:1});
 await expect(db.query('select private.timeclock_adjust_entry_impl($1,$2,$3,$4)',[id,start,end,'Redundant review'])).rejects.toThrow('No time changes');
});
it('retains unresolved open status and rejects overlapping corrections',async()=>{
 const id=await entry('2026-10-06T12:00:00Z',null);
 await db.query('select private.timeclock_adjust_entry_impl($1,$2,$3,$4)',[id,'2026-10-06T13:00:00Z',null,'Corrected start only']);
 expect((await db.query('select requires_correction from timeclock_entries where id=$1',[id])).rows[0]).toEqual({requires_correction:true});
 await expect(db.query('select private.timeclock_adjust_entry_impl($1,$2,$3,$4)',[id,'2026-10-05T13:00:00Z','2026-10-05T17:00:00Z','Overlap denied'])).rejects.toThrow('overlaps');
 await db.query('select private.timeclock_adjust_entry_impl($1,$2,$3,$4)',[id,'2026-10-06T13:00:00Z','2026-10-06T15:00:00Z','Actual finish confirmed']);
});
it('excludes flagged completed punches from totals and daily splits, blocks finalization until reviewed and regenerated',async()=>{
 const start='2026-10-07T12:00:00Z',end='2026-10-07T18:00:00Z',id=await entry(start,end);
 const generated=await db.query<{id:string}>('select private.timeclock_generate_weekly_report_impl($1,$2) id',[school,'2026-10-05']);
 const report=generated.rows[0].id;
 await db.query('select private.timeclock_refresh_daily_hours_impl($1)',[report]);
 expect((await db.query('select total_hours::float8 hours,daily_hours from timeclock_weekly_report_lines where report_id=$1',[report])).rows[0]).toMatchObject({hours:8,daily_hours:{'2026-10-07':0}});
 await expect(db.query('select private.timeclock_finalize_weekly_report_impl($1)',[report])).rejects.toThrow('Resolve corrections');
 await db.query('select private.timeclock_adjust_entry_impl($1,$2,$3,$4)',[id,start,end,'Manager confirmed']);
 await expect(db.query('select private.timeclock_finalize_weekly_report_impl($1)',[report])).rejects.toThrow('regenerate');
 await db.query('select private.timeclock_generate_weekly_report_impl($1,$2)',[school,'2026-10-05']);
 await db.query('select private.timeclock_refresh_daily_hours_impl($1)',[report]);
 expect((await db.query('select total_hours::float8 hours from timeclock_weekly_reports where id=$1',[report])).rows[0]).toEqual({hours:14});
 await db.query('select private.timeclock_finalize_weekly_report_impl($1)',[report]);
 await expect(db.query('select private.timeclock_generate_weekly_report_impl($1,$2)',[school,'2026-10-05'])).rejects.toThrow('finalized');
});

