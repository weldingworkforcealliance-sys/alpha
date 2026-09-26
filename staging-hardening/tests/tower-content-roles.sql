begin;
create temp table content_checks(role_name text, guide_days bigint, resources bigint, segments bigint, planner_days bigint) on commit drop;
do $test$ declare r record; d bigint; x bigint; s bigint; p bigint; begin
for r in select * from (values ('instructor','11111111-1111-4111-8111-222222222222'),('lead_instructor','11111111-1111-4111-8111-222222222222'),('school_admin','11111111-1111-4111-8111-111111111111'),('owner','99999999-9999-4999-8999-999999999999')) t(role_name,uid) loop
if r.role_name<>'owner' then
insert into public.school_memberships(school_id,user_id,role,status) values('b8cd53eb-6795-4edd-976c-70a4ed7525b1',r.uid::uuid,r.role_name::public.app_school_role,'active') on conflict(school_id,user_id) do update set role=excluded.role,status='active';
insert into public.section_instructors(school_id,section_id,instructor_id,instructor_role,active) values('b8cd53eb-6795-4edd-976c-70a4ed7525b1','881d8372-445c-4e1b-bfb3-23c211334bf0',r.uid::uuid,'instructor',true) on conflict(section_id,instructor_id) do update set active=true;
end if;
perform set_config('request.jwt.claims',jsonb_build_object('sub',r.uid,'role','authenticated','aal','aal1')::text,true);
execute 'set local role authenticated';
select count(*) into d from public.course_guide_days where guide_id='92600000-0000-4000-8000-000000000001';
select count(*) into x from public.course_guide_day_resources where source_id='92600000-0000-4000-8000-000000000002';
select count(*) into s from public.course_guide_day_segments where guide_day_id in ('92600000-0000-4000-8000-000000000011','92600000-0000-4000-8000-000000000012');
select count(*) into p from public.planner_days where section_id='881d8372-445c-4e1b-bfb3-23c211334bf0';
execute 'reset role';
if d<>2 or x<>2 or s<>4 or p<>2 then raise exception 'Content visibility failed for %',r.role_name; end if;
insert into content_checks values(r.role_name,d,x,s,p);
end loop;
end $test$;
select * from content_checks;
rollback;