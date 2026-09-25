begin;
create temp table smoke_results(role_name text, area text, result jsonb) on commit drop;
do $smoke$
declare r record; t record; v jsonb;
begin
for r in select * from (values
('instructor','11111111-1111-4111-8111-222222222222'),
('school_admin','11111111-1111-4111-8111-111111111111'),
('owner','99999999-9999-4999-8999-999999999999'),
('lead_instructor','11111111-1111-4111-8111-222222222222')) x(role_name,uid)
loop
if r.role_name='lead_instructor' then update public.school_memberships set role='lead_instructor' where user_id=r.uid::uuid and school_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; end if;
perform set_config('request.jwt.claims',jsonb_build_object('sub',r.uid,'role','authenticated','aal','aal1')::text,true);
for t in select * from (values
('Planner','select jsonb_build_object(''rows'',count(*)) from public.current_teaching_sections'),
('Attendance','select jsonb_build_object(''rows'',count(*)) from public.attendance_pairs'),
('Time Clock','select jsonb_build_object(''rows'',count(*)) from public.timeclock_employees'),
('Gradebook','select jsonb_build_object(''rows'',count(*)) from public.gradebook_directory'),
('Classroom','select jsonb_build_object(''rows'',count(*)) from public.classroom_sessions'),
('Job Cards','select jsonb_build_object(''rows'',count(*)) from public.job_card_sessions'),
('Reports','select jsonb_build_object(''allowed'',public.can_view_ltg_reports(''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa''::uuid))'),
('Account management','select jsonb_build_object(''allowed'',public.can_manage_memberships(''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa''::uuid))'),
('WLD110 Shop','select jsonb_build_object(''returned'',public.open_wld110_shop(''4efad4b6-a3a0-47ea-9669-f0b549fa6b7c''::uuid) is not null)'),
('Tower','select jsonb_build_object(''returned'',public.open_tower(''4efad4b6-a3a0-47ea-9669-f0b549fa6b7c''::uuid) is not null)'),
('Cross-school sections','select jsonb_build_object(''rows'',count(*)) from public.sections where school_id=''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb''::uuid')
) x(area,sql_text)
loop
begin
execute 'set local role authenticated';
execute t.sql_text into v;
execute 'reset role';
insert into smoke_results values(r.role_name,t.area,v);
exception when others then
execute 'reset role';
insert into smoke_results values(r.role_name,t.area,jsonb_build_object('error',SQLERRM,'sqlstate',SQLSTATE));
end;
end loop;
end loop;
end $smoke$;
select * from smoke_results order by role_name,area;
rollback;