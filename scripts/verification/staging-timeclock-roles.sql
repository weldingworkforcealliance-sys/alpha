-- STAGING ONLY: uses existing synthetic A/B school identities. Every mutation rolls back.
begin;
set local statement_timeout='25s';
insert into public.schools(id,name) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','LTG rollback-only audit');
insert into public.school_memberships(school_id,user_id,role,status) values
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','school_admin','active'),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-222222222222','instructor','active');
insert into public.timeclock_employees(id,school_id,profile_id,display_name) values
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','cccccccc-cccc-4ccc-8ccc-cccccccccccc',null,'Rollback audit unlinked'),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-222222222222','Rollback audit linked');
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-222222222222","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
do $test$ begin
 begin
  perform public.timeclock_set_pin('dddddddd-dddd-4ddd-8ddd-dddddddddddd','5816');
  raise exception 'FAIL unauthorized PIN accepted';
 exception when others then
  if sqlerrm not like '%permission to set this PIN%' then raise; end if;
 end;
 perform public.timeclock_set_pin('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','5816');
end $test$;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-111111111111","role":"authenticated","aal":"aal2"}',true);
do $test$ begin
 if exists(select 1 from public.timeclock_employees where school_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') then raise exception 'FAIL cross-school RLS'; end if;
 begin
  perform private.timeclock_set_pin_impl('dddddddd-dddd-4ddd-8ddd-dddddddddddd','5816');
  raise exception 'FAIL cross-school PIN accepted';
 exception when others then if sqlerrm not like '%permission to set this PIN%' then raise; end if; end;
end $test$;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',true);
select public.timeclock_set_pin('dddddddd-dddd-4ddd-8ddd-dddddddddddd','5816');
reset role;
insert into public.timeclock_entries(id,school_id,employee_id,clock_in_at,clock_in_method)
values('ffffffff-ffff-4fff-8fff-ffffffffffff','cccccccc-cccc-4ccc-8ccc-cccccccccccc','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',now()-interval '2 days','self');
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-222222222222","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select public.timeclock_clock_in('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',null);
do $test$ begin
 if (select count(*) from public.timeclock_entries where employee_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' and clock_out_at is null and not requires_correction)<>1 then raise exception 'FAIL active punch count';end if;
 if not exists(select 1 from public.timeclock_entries where id='ffffffff-ffff-4fff-8fff-ffffffffffff' and requires_correction and clock_out_at is null) then raise exception 'FAIL old punch preservation';end if;
 begin perform public.timeclock_clock_in('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',null); raise exception 'FAIL double clock-in';
 exception when others then if sqlerrm not like '%already clocked in today%' then raise; end if; end;
end $test$;
select public.timeclock_clock_out('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',null);
select 'passed: actual authenticated grants, own PIN, unauthorized and cross-school PIN denial, RLS, prior-day recovery, duplicate rejection, clock-out' as verification;
rollback;
