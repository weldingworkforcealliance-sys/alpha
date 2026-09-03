-- Weekly time reports are used as a clean reference for manual payroll entry.
-- Rename ADP-specific export fields/functions to generic report-download tracking.

alter table public.timeclock_weekly_reports
  rename column adp_exported_by to report_downloaded_by;

alter table public.timeclock_weekly_reports
  rename column adp_exported_at to report_downloaded_at;

alter index if exists public.timeclock_weekly_reports_adp_exported_by_idx
  rename to timeclock_weekly_reports_downloaded_by_idx;

create or replace function private.timeclock_mark_weekly_report_downloaded_impl(p_report_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_report public.timeclock_weekly_reports%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_report
  from public.timeclock_weekly_reports
  where id = p_report_id
  for update;

  if not found then raise exception 'Weekly time report not found'; end if;
  if not private.timeclock_can_manage_payroll_school(v_report.school_id) then
    raise exception 'School time-report management permission required';
  end if;
  if v_report.status <> 'finalized' then
    raise exception 'Finalize the weekly time report before downloading it';
  end if;

  update public.timeclock_weekly_reports
  set report_downloaded_by = v_uid,
      report_downloaded_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where id = p_report_id;

  insert into public.audit_log(school_id, user_id, action, entity_type, entity_id, details)
  values (
    v_report.school_id,
    v_uid,
    'timeclock_weekly_report_downloaded',
    'timeclock_weekly_report',
    p_report_id,
    jsonb_build_object('week_start', v_report.week_start, 'week_end', v_report.week_end)
  );

  return p_report_id;
end;
$$;

create or replace function public.timeclock_mark_weekly_report_downloaded(p_report_id uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.timeclock_mark_weekly_report_downloaded_impl(p_report_id);
$$;

revoke all on function private.timeclock_mark_weekly_report_downloaded_impl(uuid) from public, anon;
grant execute on function private.timeclock_mark_weekly_report_downloaded_impl(uuid) to authenticated;
revoke all on function public.timeclock_mark_weekly_report_downloaded(uuid) from public, anon;
grant execute on function public.timeclock_mark_weekly_report_downloaded(uuid) to authenticated;

drop function if exists public.timeclock_mark_weekly_report_exported(uuid);
drop function if exists private.timeclock_mark_weekly_report_exported_impl(uuid);
