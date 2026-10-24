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

insert into public.timeclock_entries(id,school_id,employee_id,clock_in_at,clock_out_at,clock_in_method,requires_correction)
values('ffffffff-ffff-4fff-8fff-ffffffffffff','cccccccc-cccc-4ccc-8ccc-cccccccccccc','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','2040-10-02T12:00:00Z','2040-10-02T18:00:00Z','self',true);
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
do $test$
declare r uuid;
begin
 r:=public.timeclock_generate_weekly_report('cccccccc-cccc-4ccc-8ccc-cccccccccccc','2040-10-01');
 if (public.get_ltg_reporting_summary('cccccccc-cccc-4ccc-8ccc-cccccccccccc','2040-10-01','2040-10-07')#>>'{workforce,employee_hours}')::numeric<>0 then raise exception 'FAIL flagged analytics';end if;
 if (select total_hours from public.timeclock_weekly_reports where id=r)<>0 then raise exception 'FAIL flagged payroll total';end if;
 if exists(select 1 from public.timeclock_weekly_report_lines l cross join lateral jsonb_each_text(l.daily_hours) d where l.report_id=r and d.value::numeric<>0) then raise exception 'FAIL flagged daily hours';end if;
 begin perform public.timeclock_finalize_weekly_report(r);raise exception 'FAIL unresolved finalization';
 exception when others then if sqlerrm not like '%Resolve corrections%' then raise;end if;end;
 perform public.timeclock_adjust_entry('ffffffff-ffff-4fff-8fff-ffffffffffff','2040-10-02T12:00:00Z','2040-10-02T18:00:00Z','Synthetic manager confirmation');
 if (select requires_correction from timeclock_entries where id='ffffffff-ffff-4fff-8fff-ffffffffffff') then raise exception 'FAIL flag not cleared';end if;
 if (select count(*) from timeclock_adjustments where entry_id='ffffffff-ffff-4fff-8fff-ffffffffffff')<>1 then raise exception 'FAIL missing history';end if;
 begin perform public.timeclock_finalize_weekly_report(r);raise exception 'FAIL stale snapshot finalization';
 exception when others then if sqlerrm not like '%regenerate%' then raise;end if;end;
 perform public.timeclock_generate_weekly_report('cccccccc-cccc-4ccc-8ccc-cccccccccccc','2040-10-01');
 if (public.get_ltg_reporting_summary('cccccccc-cccc-4ccc-8ccc-cccccccccccc','2040-10-01','2040-10-07')#>>'{workforce,employee_hours}')::numeric<>6 then raise exception 'FAIL reviewed analytics';end if;
 if (select total_hours from timeclock_weekly_reports where id=r)<>6 then raise exception 'FAIL corrected hours';end if;
 perform public.timeclock_finalize_weekly_report(r);
 begin perform public.timeclock_generate_weekly_report('cccccccc-cccc-4ccc-8ccc-cccccccccccc','2040-10-01');raise exception 'FAIL finalized modification';
 exception when others then if sqlerrm not like '%finalized%' then raise;end if;end;
end $test$;
select 'passed: manager confirmation and audit history, flagged weekly/daily exclusion, stale finalization rejection, regeneration=6 hours, finalization, immutable finalized snapshot' as verification;
rollback;
