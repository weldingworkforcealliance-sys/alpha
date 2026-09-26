begin;
create temp table attendance_grant_results(test text,result text);
do $test$
declare r record; v_session uuid; v_student uuid; n integer;
begin
select id into strict v_session from public.attendance_sessions where school_id='b8cd53eb-6795-4edd-976c-70a4ed7525b1' and attendance_date='2026-09-28';
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
perform public.reset_attendance_session(v_session);
n:=public.mark_all_attendance(v_session,'present');
if n<>2 then raise exception 'Expected 2 updated rows, got %',n; end if;
perform public.set_attendance_record(v_session,v_student,'absent');
execute 'reset role';
if (select count(*) from public.attendance_records where session_id=v_session and initial_status='present')<>1 then raise exception 'Correction failed'; end if;
insert into attendance_grant_results values(r.role_name,'reset, mark all, correction passed');
end loop;
perform set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-222222222222","role":"authenticated"}',true);
execute 'set local role authenticated';
begin
perform public.mark_all_attendance(v_session,'present');
raise exception 'SECURITY TEST FAILED: unrelated instructor allowed';
exception when others then
if sqlerrm not like 'Assigned instructor%' then raise; end if;
end;
execute 'reset role';
insert into attendance_grant_results values('unrelated school instructor','denied by pair authorization');
if has_function_privilege('anon','public.mark_all_attendance(uuid,text)','EXECUTE')
or has_function_privilege('anon','public.set_attendance_record(uuid,uuid,text,text,text[],text)','EXECUTE')
or has_function_privilege('anon','public.reset_attendance_session(uuid)','EXECUTE') then raise exception 'Anonymous callable'; end if;
insert into attendance_grant_results values('anonymous','all three RPCs denied');
update public.attendance_sessions set status='finalized' where id=v_session;
perform set_config('request.jwt.claims','{"sub":"98471f9d-5293-43bc-b328-73777daae587","role":"authenticated"}',true);
execute 'set local role authenticated';
begin
perform public.mark_all_attendance(v_session,'present');
raise exception 'SECURITY TEST FAILED: finalized allowed';
exception when others then
if sqlerrm not like 'Finalized attendance%' then raise; end if;
end;
execute 'reset role';
insert into attendance_grant_results values('finalized session','edit denied');
end $test$;
select * from attendance_grant_results;
rollback;

