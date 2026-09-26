begin;
create temp table attendance_grant_results(test text,result text);
do $test$
declare r record; v_session uuid; v_student uuid; n integer;
begin
select id into strict v_session from public.attendance_sessions where school_id='b8cd53eb-6795-4edd-976c-70a4ed7525b1' and attendance_date='2026-09-28';
update public.attendance_sessions set status='draft',finalized_at=null,finalized_by=null where id=v_session;
select student_id into v_student from public.attendance_records where session_id=v_session limit 1;
for r in select * from (values
('instructor','98471f9d-5293-43bc-b328-73777daae587'),
('lead_instructor','98471f9d-5293-43bc-b328-73777daae587'),
('school_admin','98471f9d-5293-43bc-b328-73777daae587'),
('owner','99999999-9999-4999-8999-999999999999')
) x(role_name,uid)
loop
if r.role_name <> 'owner' then
update public.school_memberships set role=r.role_name::public.app_school_role where school_id='b8cd53eb-6795-4edd-976c-70a4ed7525b1' and user_id=r.uid::uuid;
end if;
perform set_config('request.jwt.claims',jsonb_build_object('sub',r.uid,'role','authenticated')::text,true);
execute 'set local role authenticated';
perform public.reset_section_attendance(v_session,'881d8372-445c-4e1b-bfb3-23c211334bf0','2026-09-28');
n:=public.mark_all_section_attendance(v_session,'881d8372-445c-4e1b-bfb3-23c211334bf0','2026-09-28','present');
if n<>2 then raise exception 'Expected 2 updated rows, got %',n; end if;
perform public.set_section_attendance_record(v_session,'881d8372-445c-4e1b-bfb3-23c211334bf0','2026-09-28',v_student,'absent');
execute 'reset role';
if (select count(*) from public.attendance_records where session_id=v_session and initial_status='present')<>1 then raise exception 'Correction failed'; end if;
execute 'set local role authenticated';
perform public.finalize_section_attendance(v_session,'4a96abdf-1e27-494a-9a01-e973c455ff7a','2026-09-28','STAGING TEST - rolled back finalization');
execute 'reset role';
if not exists(select 1 from public.attendance_sessions where id=v_session and status='finalized') then raise exception 'Finalization failed'; end if;
if exists(select 1 from public.attendance_report_queue where session_id=v_session) then raise exception 'Unexpected report queue'; end if;
update public.attendance_sessions set status='draft',finalized_at=null,finalized_by=null where id=v_session;
insert into attendance_grant_results values(r.role_name,'scoped reset, mark all, correction, finalization; no report queued');
end loop;
perform set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-222222222222","role":"authenticated"}',true);
execute 'set local role authenticated';
begin
perform public.mark_all_section_attendance(v_session,'881d8372-445c-4e1b-bfb3-23c211334bf0','2026-09-28','present');
raise exception 'SECURITY TEST FAILED: unrelated instructor allowed';
exception when others then
if sqlerrm not like 'Assigned instructor%' then raise; end if;
end;
execute 'reset role';
insert into attendance_grant_results values('unrelated school instructor','denied by pair authorization');
if has_function_privilege('anon','public.mark_all_section_attendance(uuid,uuid,date,text)','EXECUTE')
or has_function_privilege('anon','public.set_section_attendance_record(uuid,uuid,date,uuid,text,text,text[],text)','EXECUTE')
or has_function_privilege('anon','public.reset_section_attendance(uuid,uuid,date)','EXECUTE') then raise exception 'Anonymous callable'; end if;
if has_function_privilege('authenticated','public.mark_all_attendance(uuid,text)','EXECUTE')
or has_function_privilege('authenticated','public.set_attendance_record(uuid,uuid,text,text,text[],text)','EXECUTE')
or has_function_privilege('authenticated','public.reset_attendance_session(uuid)','EXECUTE') then raise exception 'Legacy edit RPC remains callable'; end if;
insert into attendance_grant_results values('API grants','anonymous wrappers and authenticated legacy RPCs denied');
perform set_config('request.jwt.claims','{"sub":"98471f9d-5293-43bc-b328-73777daae587","role":"authenticated"}',true);
execute 'set local role authenticated';
begin
perform public.mark_all_section_attendance(v_session,'881d8372-445c-4e1b-bfb3-23c211334bf0','2026-09-29','present');
raise exception 'SECURITY TEST FAILED: stale date allowed';
exception when others then if sqlerrm not like 'Attendance class or date changed%' then raise; end if; end;
begin
perform public.mark_all_section_attendance(v_session,'4a96abdf-1e27-494a-9a01-e973c455ff7a','2026-09-28','present');
raise exception 'SECURITY TEST FAILED: completion bulk allowed';
exception when others then if sqlerrm not like 'Initial attendance must%' then raise; end if; end;
execute 'reset role';
insert into attendance_grant_results values('scope guards','wrong date and completion bulk denied');
update public.attendance_sessions set status='finalized' where id=v_session;
perform set_config('request.jwt.claims','{"sub":"98471f9d-5293-43bc-b328-73777daae587","role":"authenticated"}',true);
execute 'set local role authenticated';
begin
perform public.mark_all_section_attendance(v_session,'881d8372-445c-4e1b-bfb3-23c211334bf0','2026-09-28','present');
raise exception 'SECURITY TEST FAILED: finalized allowed';
exception when others then
if sqlerrm not like 'Finalized attendance%' then raise; end if;
end;
execute 'reset role';
insert into attendance_grant_results values('finalized session','edit denied');
end $test$;
select * from attendance_grant_results;
rollback;



