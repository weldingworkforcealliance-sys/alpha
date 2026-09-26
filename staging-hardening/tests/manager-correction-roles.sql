begin;
create temp table manager_results(role_name text,result text);
do $test$
declare r record; s uuid; student uuid; denied boolean;
begin
select id into strict s from public.attendance_sessions where school_id='b8cd53eb-6795-4edd-976c-70a4ed7525b1' and attendance_date='2026-09-28';
select student_id into student from public.attendance_records where session_id=s limit 1;
for r in select * from (values ('instructor','98471f9d-5293-43bc-b328-73777daae587',false),('lead_instructor','98471f9d-5293-43bc-b328-73777daae587',false),('school_admin','98471f9d-5293-43bc-b328-73777daae587',true),('owner','99999999-9999-4999-8999-999999999999',true)) x(role_name,uid,allowed)
loop
if r.role_name<>'owner' then update public.school_memberships set role=r.role_name::public.app_school_role where school_id='b8cd53eb-6795-4edd-976c-70a4ed7525b1' and user_id=r.uid::uuid; end if;
perform set_config('request.jwt.claims',jsonb_build_object('sub',r.uid,'role','authenticated')::text,true);
execute 'set local role authenticated';
denied:=false;
begin
perform public.manager_correct_attendance_record(s,student,'present','present','{}',null,'STAGING TEST - rolled back authorization check');
exception when others then
if sqlerrm<>'School administration or Platform Owner access required' then raise; end if;
denied:=true;
end;
execute 'reset role';
if denied=r.allowed then raise exception 'Unexpected authority result for %',r.role_name; end if;
insert into manager_results values(r.role_name,case when denied then 'denied as expected' else 'correction passed' end);
end loop;
end $test$;
select * from manager_results;
rollback;

