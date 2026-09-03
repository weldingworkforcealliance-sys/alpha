-- Split cross-midnight punches across the correct local calendar days in weekly payroll reports.

create or replace function private.timeclock_refresh_daily_hours_impl(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.timeclock_weekly_reports%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_report
  from public.timeclock_weekly_reports
  where id = p_report_id;

  if not found then raise exception 'Payroll report not found'; end if;
  if not private.timeclock_can_manage_payroll_school(v_report.school_id) then
    raise exception 'School payroll management permission required';
  end if;
  if v_report.status = 'finalized' then
    raise exception 'Finalized payroll snapshots cannot be recalculated';
  end if;

  update public.timeclock_weekly_report_lines l
  set daily_hours = coalesce((
    select jsonb_object_agg(day_rows.work_date::text, day_rows.day_hours order by day_rows.work_date)
    from (
      select
        gs.work_date,
        round(coalesce(sum(
          case
            when re.clock_out_at_snapshot is null then 0
            else greatest(
              0,
              extract(epoch from (
                least(re.clock_out_at_snapshot, ((gs.work_date + 1)::timestamp at time zone v_report.timezone))
                - greatest(re.clock_in_at_snapshot, (gs.work_date::timestamp at time zone v_report.timezone))
              )) / 3600.0
            )
          end
        ), 0)::numeric, 2) as day_hours
      from (
        select generate_series(v_report.week_start, v_report.week_end, interval '1 day')::date as work_date
      ) gs
      left join public.timeclock_weekly_report_entries re
        on re.report_line_id = l.id
       and re.clock_in_at_snapshot < ((gs.work_date + 1)::timestamp at time zone v_report.timezone)
       and coalesce(re.clock_out_at_snapshot, re.clock_in_at_snapshot) > (gs.work_date::timestamp at time zone v_report.timezone)
      group by gs.work_date
    ) day_rows
  ), '{}'::jsonb)
  where l.report_id = p_report_id;
end;
$$;

create or replace function public.timeclock_generate_weekly_report(p_school_id uuid, p_week_start date)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_report_id uuid;
begin
  v_report_id := private.timeclock_generate_weekly_report_impl(p_school_id, p_week_start);
  perform private.timeclock_refresh_daily_hours_impl(v_report_id);
  return v_report_id;
end;
$$;

revoke execute on function private.timeclock_refresh_daily_hours_impl(uuid) from public, anon;
grant execute on function private.timeclock_refresh_daily_hours_impl(uuid) to authenticated;

revoke execute on function public.timeclock_generate_weekly_report(uuid, date) from public, anon;
grant execute on function public.timeclock_generate_weekly_report(uuid, date) to authenticated;
