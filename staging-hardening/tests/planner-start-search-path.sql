begin;
create temp table start_results(role_name text, check_name text, passed boolean) on commit drop;
do $test$ declare r record; v integer; begin
for r in select * from (values ('instructor','11111111-1111-4111-8111-222222222222'),('lead_instructor','11111111-1111-4111-8111-222222222222'),('school_admin','11111111-1111-4111-8111-111111111111'),('owner','99999999-9999-4999-8999-999999999999')) x(role_name,uid) loop
if r.role_name<>'owner' then
insert into public.school_memberships(school_id,user_id,role,status) values('b8cd53eb-6795-4edd-976c-70a4ed7525b1',r.uid::uuid,r.role_name::public.app_school_role,'active') on conflict(school_id,user_id) do update set role=excluded.role,status='active';
insert into public.section_instructors(school_id,section_id,instructor_id,active) values('b8cd53eb-6795-4edd-976c-70a4ed7525b1','881d8372-445c-4e1b-bfb3-23c211334bf0',r.uid::uuid,true) on conflict(section_id,instructor_id) do update set active=true;
end if;
perform set_config('request.jwt.claims',jsonb_build_object('sub',r.uid,'role','authenticated','aal','aal1')::text,true);
begin
execute 'set local role authenticated';
perform public.start_current_planner_day('881d8372-445c-4e1b-bfb3-23c211334bf0',date '2026-09-27');
raise exception using errcode='Z0002',message='Unexpected early start';
exception when sqlstate 'P0001' then
execute 'reset role';
if SQLERRM not like 'This planner day is scheduled for%' then raise; end if;
insert into start_results values(r.role_name,'reject_early_start',true);
end;
begin
execute 'set local role authenticated';
v:=public.start_current_planner_day('881d8372-445c-4e1b-bfb3-23c211334bf0',date '2026-09-28');
if v<>1 or not exists(select 1 from public.planner_day_delivery where planner_day_id='92600000-0000-4000-8000-000000000031' and delivery_status='in_progress' and instructor_id=r.uid::uuid) then raise exception 'Start postcondition failed'; end if;
raise exception using errcode='Z0001',message='Revert successful test start';
exception when sqlstate 'Z0001' then
execute 'reset role';
insert into start_results values(r.role_name,'start_and_persist_delivery',true);
end;
end loop;
end $test$;
select * from start_results;
rollback;