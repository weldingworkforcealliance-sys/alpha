-- LTG weekly payroll reporting.
-- Safe to apply after the base time-clock migrations.

create table if not exists public.timeclock_school_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  timezone text not null default 'America/New_York',
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  overtime_threshold_hours numeric(6,2) not null default 40.00 check (overtime_threshold_hours >= 0),
  long_shift_threshold_hours numeric(6,2) not null default 16.00 check (long_shift_threshold_hours > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.timeclock_school_settings(school_id)
select s.id from public.schools s
on conflict (school_id) do nothing;

create table if not exists public.timeclock_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  week_start date not null,
  week_end date not null,
  timezone text not null,
  status text not null default 'draft' check (status in ('draft','finalized')),
  employee_count integer not null default 0 check (employee_count >= 0),
  total_regular_hours numeric(10,2) not null default 0 check (total_regular_hours >= 0),
  total_overtime_hours numeric(10,2) not null default 0 check (total_overtime_hours >= 0),
  total_hours numeric(10,2) not null default 0 check (total_hours >= 0),
  open_shift_count integer not null default 0 check (open_shift_count >= 0),
  adjusted_entry_count integer not null default 0 check (adjusted_entry_count >= 0),
  long_shift_count integer not null default 0 check (long_shift_count >= 0),
  generated_by uuid not null references public.profiles(id) on delete restrict,
  generated_at timestamptz not null default now(),
  finalized_by uuid null references public.profiles(id) on delete restrict,
  finalized_at timestamptz null,
  adp_exported_by uuid null references public.profiles(id) on delete set null,
  adp_exported_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timeclock_weekly_report_seven_days check (week_end = week_start + 6),
  constraint timeclock_weekly_report_finalize_state check (
    (status = 'draft' and finalized_at is null and finalized_by is null)
    or
    (status = 'finalized' and finalized_at is not null and finalized_by is not null)
  ),
  unique (school_id, week_start)
);

create table if not exists public.timeclock_weekly_report_lines (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.timeclock_weekly_reports(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete restrict,
  employee_id uuid not null references public.timeclock_employees(id) on delete restrict,
  employee_name_snapshot text not null,
  employee_code_snapshot text null,
  profile_id_snapshot uuid null references public.profiles(id) on delete set null,
  daily_hours jsonb not null default '{}'::jsonb,
  regular_hours numeric(10,2) not null default 0 check (regular_hours >= 0),
  overtime_hours numeric(10,2) not null default 0 check (overtime_hours >= 0),
  total_hours numeric(10,2) not null default 0 check (total_hours >= 0),
  open_shift_count integer not null default 0 check (open_shift_count >= 0),
  adjusted_entry_count integer not null default 0 check (adjusted_entry_count >= 0),
  long_shift_count integer not null default 0 check (long_shift_count >= 0),
  created_at timestamptz not null default now(),
  unique (report_id, employee_id)
);

create table if not exists public.timeclock_weekly_report_entries (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.timeclock_weekly_reports(id) on delete cascade,
  report_line_id uuid not null references public.timeclock_weekly_report_lines(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete restrict,
  employee_id uuid not null references public.timeclock_employees(id) on delete restrict,
  source_entry_id uuid not null references public.timeclock_entries(id) on delete restrict,
  clock_in_at_snapshot timestamptz not null,
  clock_out_at_snapshot timestamptz null,
  clock_in_method_snapshot text not null,
  clock_out_method_snapshot text null,
  hours_snapshot numeric(10,4) not null default 0 check (hours_snapshot >= 0),
  adjustment_count integer not null default 0 check (adjustment_count >= 0),
  open_shift boolean not null default false,
  long_shift boolean not null default false,
  cross_midnight boolean not null default false,
  created_at timestamptz not null default now(),
  unique (report_id, source_entry_id)
);

create index if not exists timeclock_weekly_reports_school_week_idx on public.timeclock_weekly_reports(school_id, week_start desc);
create index if not exists timeclock_weekly_reports_status_idx on public.timeclock_weekly_reports(status, week_start desc);
create index if not exists timeclock_weekly_reports_generated_by_idx on public.timeclock_weekly_reports(generated_by);
create index if not exists timeclock_weekly_reports_finalized_by_idx on public.timeclock_weekly_reports(finalized_by) where finalized_by is not null;
create index if not exists timeclock_weekly_reports_adp_exported_by_idx on public.timeclock_weekly_reports(adp_exported_by) where adp_exported_by is not null;
create index if not exists timeclock_weekly_lines_school_idx on public.timeclock_weekly_report_lines(school_id, report_id);
create index if not exists timeclock_weekly_lines_employee_idx on public.timeclock_weekly_report_lines(employee_id, report_id);
create index if not exists timeclock_weekly_lines_profile_idx on public.timeclock_weekly_report_lines(profile_id_snapshot) where profile_id_snapshot is not null;
create index if not exists timeclock_weekly_entries_report_idx on public.timeclock_weekly_report_entries(report_id, employee_id);
create index if not exists timeclock_weekly_entries_line_idx on public.timeclock_weekly_report_entries(report_line_id);
create index if not exists timeclock_weekly_entries_school_idx on public.timeclock_weekly_report_entries(school_id, report_id);
create index if not exists timeclock_weekly_entries_employee_idx on public.timeclock_weekly_report_entries(employee_id, report_id);
create index if not exists timeclock_weekly_entries_source_idx on public.timeclock_weekly_report_entries(source_entry_id);

create or replace function private.timeclock_can_manage_payroll_school(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.school_memberships sm
    where sm.school_id = p_school_id
      and sm.user_id = (select auth.uid())
      and sm.status = 'active'
      and sm.role in (
        'school_admin'::public.app_school_role,
        'program_lead'::public.app_school_role,
        'lead_instructor'::public.app_school_role
      )
  );
$$;

create or replace function private.timeclock_can_payroll_school(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.timeclock_can_manage_payroll_school(p_school_id)
      or exists (
        select 1 from public.platform_owners po
        where po.user_id = (select auth.uid())
      );
$$;

create or replace function private.timeclock_can_view_school(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.timeclock_can_payroll_school(p_school_id);
$$;

create or replace function private.timeclock_generate_weekly_report_impl(p_school_id uuid, p_week_start date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
        adp_exported_by = null,
        adp_exported_at = null,
        updated_at = clock_timestamp()
    where id = v_report_id;
  else
    insert into public.timeclock_weekly_reports(school_id, week_start, week_end, timezone, generated_by)
    values (p_school_id, p_week_start, p_week_start + 6, v_timezone, v_uid)
    returning id into v_report_id;
  end if;

  insert into public.timeclock_weekly_report_lines(report_id, school_id, employee_id, employee_name_snapshot, employee_code_snapshot, profile_id_snapshot)
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
    hours_snapshot, adjustment_count, open_shift, long_shift, cross_midnight
  )
  select
    v_report_id, l.id, te.school_id, te.employee_id, te.id,
    te.clock_in_at, te.clock_out_at, te.clock_in_method, te.clock_out_method,
    case when te.clock_out_at is null then 0 else round((extract(epoch from (least(te.clock_out_at, v_end_at) - greatest(te.clock_in_at, v_start_at))) / 3600.0)::numeric, 4) end,
    (select count(*)::int from public.timeclock_adjustments a where a.entry_id = te.id),
    te.clock_out_at is null,
    case when te.clock_out_at is null then false else (extract(epoch from (te.clock_out_at - te.clock_in_at)) / 3600.0) > v_long_threshold end,
    case when te.clock_out_at is null then false else (te.clock_in_at at time zone v_timezone)::date <> (te.clock_out_at at time zone v_timezone)::date end
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
                 round(sum(re.hours_snapshot), 2) as day_hours
          from public.timeclock_weekly_report_entries re
          where re.report_line_id = l.id
          group by (re.clock_in_at_snapshot at time zone v_timezone)::date
        ) d
      ), '{}'::jsonb),
      total_hours = coalesce((select round(sum(re.hours_snapshot), 2) from public.timeclock_weekly_report_entries re where re.report_line_id = l.id), 0),
      regular_hours = least(coalesce((select round(sum(re.hours_snapshot), 2) from public.timeclock_weekly_report_entries re where re.report_line_id = l.id), 0), v_ot_threshold),
      overtime_hours = greatest(coalesce((select round(sum(re.hours_snapshot), 2) from public.timeclock_weekly_report_entries re where re.report_line_id = l.id), 0) - v_ot_threshold, 0),
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
$$;

create or replace function private.timeclock_finalize_weekly_report_impl(p_report_id uuid)
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
  select * into v_report from public.timeclock_weekly_reports where id = p_report_id for update;
  if not found then raise exception 'Payroll report not found'; end if;
  if not private.timeclock_can_manage_payroll_school(v_report.school_id) then raise exception 'School payroll management permission required'; end if;
  if v_report.status = 'finalized' then return v_report.id; end if;
  if v_report.open_shift_count > 0 then raise exception 'Resolve all open shifts before finalizing payroll'; end if;

  update public.timeclock_weekly_reports
  set status = 'finalized', finalized_by = v_uid, finalized_at = clock_timestamp(), updated_at = clock_timestamp()
  where id = p_report_id;

  insert into public.audit_log(school_id, user_id, action, entity_type, entity_id, details)
  values (v_report.school_id, v_uid, 'timeclock_weekly_report_finalized', 'timeclock_weekly_report', p_report_id,
          jsonb_build_object('week_start', v_report.week_start, 'week_end', v_report.week_end, 'total_hours', v_report.total_hours, 'adjusted_entry_count', v_report.adjusted_entry_count, 'long_shift_count', v_report.long_shift_count));
  return p_report_id;
end;
$$;

create or replace function private.timeclock_mark_weekly_report_exported_impl(p_report_id uuid)
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
  select * into v_report from public.timeclock_weekly_reports where id = p_report_id for update;
  if not found then raise exception 'Payroll report not found'; end if;
  if not private.timeclock_can_manage_payroll_school(v_report.school_id) then raise exception 'School payroll management permission required'; end if;
  if v_report.status <> 'finalized' then raise exception 'Finalize the payroll report before exporting it for ADP'; end if;

  update public.timeclock_weekly_reports
  set adp_exported_by = v_uid, adp_exported_at = clock_timestamp(), updated_at = clock_timestamp()
  where id = p_report_id;

  insert into public.audit_log(school_id, user_id, action, entity_type, entity_id, details)
  values (v_report.school_id, v_uid, 'timeclock_weekly_report_exported', 'timeclock_weekly_report', p_report_id,
          jsonb_build_object('week_start', v_report.week_start, 'week_end', v_report.week_end));
  return p_report_id;
end;
$$;

create or replace function public.timeclock_generate_weekly_report(p_school_id uuid, p_week_start date)
returns uuid language sql security invoker set search_path = ''
as $$ select private.timeclock_generate_weekly_report_impl(p_school_id, p_week_start); $$;

create or replace function public.timeclock_finalize_weekly_report(p_report_id uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.timeclock_finalize_weekly_report_impl(p_report_id); $$;

create or replace function public.timeclock_mark_weekly_report_exported(p_report_id uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.timeclock_mark_weekly_report_exported_impl(p_report_id); $$;

create or replace function private.timeclock_can_view_weekly_report(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.timeclock_weekly_reports r
    where r.id = p_report_id
      and (
        private.timeclock_can_manage_payroll_school(r.school_id)
        or (
          r.status = 'finalized'
          and exists (
            select 1 from public.platform_owners po
            where po.user_id = (select auth.uid())
          )
        )
      )
  );
$$;

alter table public.timeclock_school_settings enable row level security;
alter table public.timeclock_weekly_reports enable row level security;
alter table public.timeclock_weekly_report_lines enable row level security;
alter table public.timeclock_weekly_report_entries enable row level security;

revoke all on public.timeclock_school_settings from anon, authenticated;
revoke all on public.timeclock_weekly_reports from anon, authenticated;
revoke all on public.timeclock_weekly_report_lines from anon, authenticated;
revoke all on public.timeclock_weekly_report_entries from anon, authenticated;
grant select on public.timeclock_school_settings to authenticated;
grant select on public.timeclock_weekly_reports to authenticated;
grant select on public.timeclock_weekly_report_lines to authenticated;
grant select on public.timeclock_weekly_report_entries to authenticated;

drop policy if exists timeclock_school_settings_select on public.timeclock_school_settings;
create policy timeclock_school_settings_select on public.timeclock_school_settings for select to authenticated
using (private.timeclock_can_payroll_school(school_id));

drop policy if exists timeclock_weekly_reports_select on public.timeclock_weekly_reports;
create policy timeclock_weekly_reports_select on public.timeclock_weekly_reports for select to authenticated
using (
  private.timeclock_can_manage_payroll_school(school_id)
  or (
    status = 'finalized'
    and exists (
      select 1 from public.platform_owners po
      where po.user_id = (select auth.uid())
    )
  )
);

drop policy if exists timeclock_weekly_report_lines_select on public.timeclock_weekly_report_lines;
create policy timeclock_weekly_report_lines_select on public.timeclock_weekly_report_lines for select to authenticated
using (private.timeclock_can_view_weekly_report(report_id));

drop policy if exists timeclock_weekly_report_entries_select on public.timeclock_weekly_report_entries;
create policy timeclock_weekly_report_entries_select on public.timeclock_weekly_report_entries for select to authenticated
using (private.timeclock_can_view_weekly_report(report_id));

revoke execute on function private.timeclock_can_manage_payroll_school(uuid) from public, anon;
revoke execute on function private.timeclock_can_payroll_school(uuid) from public, anon;
revoke execute on function private.timeclock_can_view_weekly_report(uuid) from public, anon;
revoke execute on function private.timeclock_generate_weekly_report_impl(uuid, date) from public, anon;
revoke execute on function private.timeclock_finalize_weekly_report_impl(uuid) from public, anon;
revoke execute on function private.timeclock_mark_weekly_report_exported_impl(uuid) from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.timeclock_can_manage_payroll_school(uuid) to authenticated;
grant execute on function private.timeclock_can_payroll_school(uuid) to authenticated;
grant execute on function private.timeclock_can_view_weekly_report(uuid) to authenticated;
grant execute on function private.timeclock_generate_weekly_report_impl(uuid, date) to authenticated;
grant execute on function private.timeclock_finalize_weekly_report_impl(uuid) to authenticated;
grant execute on function private.timeclock_mark_weekly_report_exported_impl(uuid) to authenticated;

revoke execute on function public.timeclock_generate_weekly_report(uuid, date) from public, anon;
revoke execute on function public.timeclock_finalize_weekly_report(uuid) from public, anon;
revoke execute on function public.timeclock_mark_weekly_report_exported(uuid) from public, anon;
grant execute on function public.timeclock_generate_weekly_report(uuid, date) to authenticated;
grant execute on function public.timeclock_finalize_weekly_report(uuid) to authenticated;
grant execute on function public.timeclock_mark_weekly_report_exported(uuid) to authenticated;
