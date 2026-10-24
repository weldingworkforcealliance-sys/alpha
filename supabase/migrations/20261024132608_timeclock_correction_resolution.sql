-- Explicit manager review resolves a completed flagged entry without inventing time changes.
-- New snapshots exclude unresolved corrections. Existing finalized snapshots remain untouched.
alter table public.timeclock_weekly_report_entries
  add column if not exists requires_correction_snapshot boolean not null default false;

CREATE OR REPLACE FUNCTION private.timeclock_adjust_entry_impl(p_entry_id uuid, p_new_clock_in_at timestamp with time zone, p_new_clock_out_at timestamp with time zone, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_entry public.timeclock_entries%rowtype;
  v_uid uuid := auth.uid();
  v_in_changed boolean;
  v_out_changed boolean;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_entry
  from public.timeclock_entries
  where id = p_entry_id
  for update;

  if not found then raise exception 'Time entry not found'; end if;
  if not private.timeclock_is_manager(v_entry.school_id) then raise exception 'Manager permission required'; end if;
  if p_new_clock_in_at is null then raise exception 'Clock-in time is required'; end if;
  if p_new_clock_out_at is not null and p_new_clock_out_at <= p_new_clock_in_at then
    raise exception 'Clock-out must be later than clock-in';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'A correction reason is required';
  end if;

  v_in_changed := p_new_clock_in_at is distinct from v_entry.clock_in_at;
  v_out_changed := p_new_clock_out_at is distinct from v_entry.clock_out_at;

  if not v_in_changed and not v_out_changed and not (v_entry.requires_correction and p_new_clock_out_at is not null) then
    raise exception 'No time changes were provided';
  end if;

  if exists (
    select 1 from public.timeclock_entries e
    where e.employee_id = v_entry.employee_id
      and e.id <> p_entry_id
      and tstzrange(e.clock_in_at, coalesce(e.clock_out_at, 'infinity'::timestamptz), '[)')
          && tstzrange(p_new_clock_in_at, coalesce(p_new_clock_out_at, 'infinity'::timestamptz), '[)')
  ) then
    raise exception 'Adjusted entry overlaps another shift';
  end if;

  insert into public.timeclock_adjustments(
    school_id, entry_id, employee_id, adjusted_by,
    old_clock_in_at, new_clock_in_at, old_clock_out_at, new_clock_out_at,
    old_clock_in_method, old_clock_out_method, old_clock_in_actor, old_clock_out_actor,
    reason
  ) values (
    v_entry.school_id, v_entry.id, v_entry.employee_id, v_uid,
    v_entry.clock_in_at, p_new_clock_in_at, v_entry.clock_out_at, p_new_clock_out_at,
    v_entry.clock_in_method, v_entry.clock_out_method, v_entry.clock_in_actor, v_entry.clock_out_actor,
    btrim(p_reason)
  );

  update public.timeclock_entries
  set clock_in_at = p_new_clock_in_at,
      clock_out_at = p_new_clock_out_at,
      clock_in_method = case when v_in_changed then 'manager' else v_entry.clock_in_method end,
      clock_out_method = case
        when p_new_clock_out_at is null then null
        when v_out_changed then 'manager'
        else v_entry.clock_out_method
      end,
      clock_in_actor = case when v_in_changed then v_uid else v_entry.clock_in_actor end,
      clock_out_actor = case
        when p_new_clock_out_at is null then null
        when v_out_changed then v_uid
        else v_entry.clock_out_actor
      end,
      requires_correction = v_entry.requires_correction and p_new_clock_out_at is null,
      updated_at = clock_timestamp()
  where id = p_entry_id;

  insert into public.audit_log(school_id, user_id, action, entity_type, entity_id, details)
  values (
    v_entry.school_id, v_uid, 'timeclock_entry_adjusted', 'timeclock_entry', p_entry_id,
    jsonb_build_object(
      'employee_id', v_entry.employee_id,
      'reason', btrim(p_reason),
      'old_requires_correction', v_entry.requires_correction,
      'new_requires_correction', v_entry.requires_correction and p_new_clock_out_at is null,
      'clock_in_changed', v_in_changed,
      'clock_out_changed', v_out_changed,
      'old_clock_in_at', v_entry.clock_in_at,
      'new_clock_in_at', p_new_clock_in_at,
      'old_clock_out_at', v_entry.clock_out_at,
      'new_clock_out_at', p_new_clock_out_at,
      'old_clock_in_method', v_entry.clock_in_method,
      'old_clock_out_method', v_entry.clock_out_method,
      'old_clock_in_actor', v_entry.clock_in_actor,
      'old_clock_out_actor', v_entry.clock_out_actor
    )
  );

  return p_entry_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.timeclock_finalize_weekly_report_impl(p_report_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_report public.timeclock_weekly_reports%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_report from public.timeclock_weekly_reports where id = p_report_id for update;
  if not found then raise exception 'Payroll report not found'; end if;
  if not private.timeclock_can_manage_payroll_school(v_report.school_id) then raise exception 'School payroll management permission required'; end if;
  if v_report.status = 'finalized' then return v_report.id; end if;
  if exists (
    select 1 from public.timeclock_weekly_report_entries re
    join public.timeclock_entries e on e.id = re.source_entry_id
    where re.report_id = p_report_id
      and (re.requires_correction_snapshot or e.requires_correction
        or e.clock_in_at is distinct from re.clock_in_at_snapshot
        or e.clock_out_at is distinct from re.clock_out_at_snapshot)
  ) then raise exception 'Resolve corrections and regenerate payroll before finalizing'; end if;
  if v_report.open_shift_count > 0 then raise exception 'Resolve all open shifts before finalizing payroll'; end if;
  if v_report.long_shift_count > 0 then raise exception 'Correct overlong shifts and regenerate payroll before finalizing'; end if;

  update public.timeclock_weekly_reports
  set status = 'finalized', finalized_by = v_uid, finalized_at = clock_timestamp(), updated_at = clock_timestamp()
  where id = p_report_id;

  insert into public.audit_log(school_id, user_id, action, entity_type, entity_id, details)
  values (v_report.school_id, v_uid, 'timeclock_weekly_report_finalized', 'timeclock_weekly_report', p_report_id,
          jsonb_build_object('week_start', v_report.week_start, 'week_end', v_report.week_end, 'total_hours', v_report.total_hours, 'adjusted_entry_count', v_report.adjusted_entry_count, 'long_shift_count', v_report.long_shift_count));
  return p_report_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.timeclock_generate_weekly_report_impl(p_school_id uuid, p_week_start date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_report_id uuid;
  v_timezone text;
  v_ot_threshold numeric(6,2);
  v_long_threshold numeric(6,2);
  v_start_at timestamptz;
  v_end_at timestamptz;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not private.timeclock_can_manage_payroll_school(p_school_id) then
    raise exception 'School payroll management permission required';
  end if;
  if p_week_start is null then raise exception 'Week start is required'; end if;

  select s.timezone, s.overtime_threshold_hours, s.long_shift_threshold_hours
  into v_timezone, v_ot_threshold, v_long_threshold
  from public.timeclock_school_settings s
  where s.school_id = p_school_id;

  if not found then
    v_timezone := 'America/New_York';
    v_ot_threshold := 40.00;
    v_long_threshold := 16.00;
  end if;

  v_start_at := p_week_start::timestamp at time zone v_timezone;
  v_end_at := (p_week_start + 7)::timestamp at time zone v_timezone;

  select r.id into v_report_id
  from public.timeclock_weekly_reports r
  where r.school_id = p_school_id and r.week_start = p_week_start
  for update;

  if found then
    if exists (select 1 from public.timeclock_weekly_reports r where r.id = v_report_id and r.status = 'finalized') then
      raise exception 'This payroll week is finalized and cannot be regenerated';
    end if;

    delete from public.timeclock_weekly_report_entries where report_id = v_report_id;
    delete from public.timeclock_weekly_report_lines where report_id = v_report_id;

    update public.timeclock_weekly_reports
    set week_end = p_week_start + 6,
        timezone = v_timezone,
        employee_count = 0,
        total_regular_hours = 0,
        total_overtime_hours = 0,
        total_hours = 0,
        open_shift_count = 0,
        adjusted_entry_count = 0,
        long_shift_count = 0,
        generated_by = v_uid,
        generated_at = clock_timestamp(),
        report_downloaded_by = null,
        report_downloaded_at = null,
        updated_at = clock_timestamp()
    where id = v_report_id;
  else
    insert into public.timeclock_weekly_reports(school_id, week_start, week_end, timezone, generated_by)
    values (p_school_id, p_week_start, p_week_start + 6, v_timezone, v_uid)
    returning id into v_report_id;
  end if;

  insert into public.timeclock_weekly_report_lines(
    report_id, school_id, employee_id, employee_name_snapshot, employee_code_snapshot, profile_id_snapshot
  )
  select v_report_id, e.school_id, e.id, e.display_name, e.employee_code, e.profile_id
  from public.timeclock_employees e
  where e.school_id = p_school_id
    and (
      e.active
      or exists (
        select 1 from public.timeclock_entries te
        where te.employee_id = e.id
          and te.clock_in_at < v_end_at
          and coalesce(te.clock_out_at, v_end_at) > v_start_at
      )
    )
  order by e.display_name;

  insert into public.timeclock_weekly_report_entries(
    report_id, report_line_id, school_id, employee_id, source_entry_id,
    clock_in_at_snapshot, clock_out_at_snapshot, clock_in_method_snapshot, clock_out_method_snapshot,
    hours_snapshot, adjustment_count, open_shift, long_shift, cross_midnight, requires_correction_snapshot
  )
  select
    v_report_id, l.id, te.school_id, te.employee_id, te.id,
    te.clock_in_at, te.clock_out_at, te.clock_in_method, te.clock_out_method,
    case when te.clock_out_at is null then 0 else round((extract(epoch from (least(te.clock_out_at, v_end_at) - greatest(te.clock_in_at, v_start_at))) / 3600.0)::numeric, 4) end,
    (select count(*)::int from public.timeclock_adjustments a where a.entry_id = te.id),
    te.clock_out_at is null,
    case when te.clock_out_at is null then false else (extract(epoch from (te.clock_out_at - te.clock_in_at)) / 3600.0) > v_long_threshold end,
    case when te.clock_out_at is null then false else (te.clock_in_at at time zone v_timezone)::date <> (te.clock_out_at at time zone v_timezone)::date end
, te.requires_correction
  from public.timeclock_entries te
  join public.timeclock_weekly_report_lines l on l.report_id = v_report_id and l.employee_id = te.employee_id
  where te.school_id = p_school_id
    and te.clock_in_at < v_end_at
    and coalesce(te.clock_out_at, v_end_at) > v_start_at;

  update public.timeclock_weekly_report_lines l
  set daily_hours = coalesce((
        select jsonb_object_agg(d.work_date::text, d.day_hours order by d.work_date)
        from (
          select (re.clock_in_at_snapshot at time zone v_timezone)::date as work_date,
                 round(sum(re.hours_snapshot) filter (where not re.open_shift and not re.long_shift and not re.requires_correction_snapshot), 2) as day_hours
          from public.timeclock_weekly_report_entries re
          where re.report_line_id = l.id
          group by (re.clock_in_at_snapshot at time zone v_timezone)::date
        ) d
      ), '{}'::jsonb),
      total_hours = coalesce((select round(sum(re.hours_snapshot) filter (where not re.open_shift and not re.long_shift and not re.requires_correction_snapshot), 2) from public.timeclock_weekly_report_entries re where re.report_line_id = l.id), 0),
      regular_hours = least(coalesce((select round(sum(re.hours_snapshot) filter (where not re.open_shift and not re.long_shift and not re.requires_correction_snapshot), 2) from public.timeclock_weekly_report_entries re where re.report_line_id = l.id), 0), v_ot_threshold),
      overtime_hours = greatest(coalesce((select round(sum(re.hours_snapshot) filter (where not re.open_shift and not re.long_shift and not re.requires_correction_snapshot), 2) from public.timeclock_weekly_report_entries re where re.report_line_id = l.id), 0) - v_ot_threshold, 0),
      open_shift_count = coalesce((select count(*)::int from public.timeclock_weekly_report_entries re where re.report_line_id = l.id and re.open_shift), 0),
      adjusted_entry_count = coalesce((select count(*)::int from public.timeclock_weekly_report_entries re where re.report_line_id = l.id and re.adjustment_count > 0), 0),
      long_shift_count = coalesce((select count(*)::int from public.timeclock_weekly_report_entries re where re.report_line_id = l.id and re.long_shift), 0)
  where l.report_id = v_report_id;

  update public.timeclock_weekly_reports r
  set employee_count = (select count(*)::int from public.timeclock_weekly_report_lines l where l.report_id = v_report_id),
      total_regular_hours = coalesce((select round(sum(l.regular_hours), 2) from public.timeclock_weekly_report_lines l where l.report_id = v_report_id), 0),
      total_overtime_hours = coalesce((select round(sum(l.overtime_hours), 2) from public.timeclock_weekly_report_lines l where l.report_id = v_report_id), 0),
      total_hours = coalesce((select round(sum(l.total_hours), 2) from public.timeclock_weekly_report_lines l where l.report_id = v_report_id), 0),
      open_shift_count = coalesce((select sum(l.open_shift_count)::int from public.timeclock_weekly_report_lines l where l.report_id = v_report_id), 0),
      adjusted_entry_count = coalesce((select sum(l.adjusted_entry_count)::int from public.timeclock_weekly_report_lines l where l.report_id = v_report_id), 0),
      long_shift_count = coalesce((select sum(l.long_shift_count)::int from public.timeclock_weekly_report_lines l where l.report_id = v_report_id), 0),
      updated_at = clock_timestamp()
  where r.id = v_report_id;

  insert into public.audit_log(school_id, user_id, action, entity_type, entity_id, details)
  select p_school_id, v_uid, 'timeclock_weekly_report_generated', 'timeclock_weekly_report', v_report_id,
         jsonb_build_object('week_start', p_week_start, 'week_end', p_week_start + 6, 'employee_count', r.employee_count, 'total_hours', r.total_hours, 'open_shift_count', r.open_shift_count)
  from public.timeclock_weekly_reports r where r.id = v_report_id;

  return v_report_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.timeclock_refresh_daily_hours_impl(p_report_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
            when re.clock_out_at_snapshot is null or re.long_shift or re.requires_correction_snapshot then 0
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
$function$
;

