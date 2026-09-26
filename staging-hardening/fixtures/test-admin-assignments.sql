-- Gltg only: ezlvivmeneefiiwqwgqd. Existing synthetic school administrator.
begin;
set local statement_timeout='15s';
do $guard$ begin
if not exists(select 1 from public.school_memberships where school_id='b8cd53eb-6795-4edd-976c-70a4ed7525b1' and user_id='98471f9d-5293-43bc-b328-73777daae587' and role='school_admin' and status='active') then raise exception 'Staging account identity mismatch'; end if;
if exists(select 1 from public.profiles where id='98471f9d-5293-43bc-b328-73777daae587') then raise exception 'Profile already exists; review before running'; end if;
end $guard$;
insert into public.profiles(id,display_name,email)
select id,'STAGING TEST - School Administrator',email from auth.users where id='98471f9d-5293-43bc-b328-73777daae587';
insert into public.section_instructors(id,school_id,section_id,instructor_id,instructor_role,active) values
('92600000-0000-4000-8000-000000000041','b8cd53eb-6795-4edd-976c-70a4ed7525b1','881d8372-445c-4e1b-bfb3-23c211334bf0','98471f9d-5293-43bc-b328-73777daae587','instructor',true),
('92600000-0000-4000-8000-000000000042','b8cd53eb-6795-4edd-976c-70a4ed7525b1','4a96abdf-1e27-494a-9a01-e973c455ff7a','98471f9d-5293-43bc-b328-73777daae587','instructor',true);
insert into public.timeclock_employees(id,school_id,profile_id,display_name,employee_code,active,clocking_enabled)
values('92600000-0000-4000-8000-000000000043','b8cd53eb-6795-4edd-976c-70a4ed7525b1','98471f9d-5293-43bc-b328-73777daae587','STAGING TEST - School Administrator','STAGING-ADMIN-01',true,true);
do $verify$ begin
if (select count(*) from public.section_instructors where id in ('92600000-0000-4000-8000-000000000041','92600000-0000-4000-8000-000000000042'))<>2 or not exists(select 1 from public.timeclock_employees where id='92600000-0000-4000-8000-000000000043') then raise exception 'Setup verification failed'; end if;
end $verify$;
commit;

