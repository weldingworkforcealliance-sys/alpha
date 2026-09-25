begin;
create temp table lab_smoke(role_name text, area text, passed boolean) on commit drop;
do $test$
declare r record; v boolean;
begin
for r in select * from (values ('instructor','11111111-1111-4111-8111-222222222222'),('lead_instructor','11111111-1111-4111-8111-222222222222'),('school_admin','98471f9d-5293-43bc-b328-73777daae587'),('owner','99999999-9999-4999-8999-999999999999')) t(role_name,uid)
loop
if r.role_name in ('instructor','lead_instructor') then
insert into public.school_memberships(school_id,user_id,role,status) values('b8cd53eb-6795-4edd-976c-70a4ed7525b1',r.uid::uuid,r.role_name::public.app_school_role,'active')
on conflict(school_id,user_id) do update set role=excluded.role;
insert into public.section_instructors(school_id,section_id,instructor_id,instructor_role,active)
values('b8cd53eb-6795-4edd-976c-70a4ed7525b1','4a96abdf-1e27-494a-9a01-e973c455ff7a',r.uid::uuid,'instructor',true)
on conflict(section_id,instructor_id) do update set active=true;
end if;
perform set_config('request.jwt.claims',jsonb_build_object('sub',r.uid,'role','authenticated','aal','aal1')::text,true);
execute 'set local role authenticated';
select public.open_tower('90a1ad29-c714-4bee-82b6-b997eb041c47') is not null into v;
execute 'reset role';
insert into lab_smoke values(r.role_name,'Tower',v);
update public.courses set course_code='WLD 110' where id='5bb0b247-0e3e-4222-8997-5bf97c6b4ba4';
execute 'set local role authenticated';
select public.open_wld110_shop('90a1ad29-c714-4bee-82b6-b997eb041c47') is not null into v;
execute 'reset role';
insert into lab_smoke values(r.role_name,'WLD110 Shop (synthetic lab)',v);
update public.courses set course_code='TOWER-LAB' where id='5bb0b247-0e3e-4222-8997-5bf97c6b4ba4';
end loop;
end $test$;
select * from lab_smoke;
rollback;