-- LTG Reporting & Analytics Center foundation
-- 2026-09-10
-- Backward-compatible additions for historical reporting, analytics event capture,
-- saved report snapshots, and canonical student linkage.

begin;

-- ---------------------------------------------------------------------------
-- 1. Canonical student linkage for Live Classroom and Level II Job Cards
-- ---------------------------------------------------------------------------

create unique index if not exists attendance_students_school_external_id_uidx
  on public.attendance_students (school_id, external_student_id)
  where external_student_id is not null and btrim(external_student_id) <> '';

alter table public.classroom_submissions
  add column if not exists student_uuid uuid null references public.attendance_students(id) on delete set null;

alter table public.job_card_submissions
  add column if not exists student_uuid uuid null references public.attendance_students(id) on delete set null;

create index if not exists classroom_submissions_student_uuid_idx
  on public.classroom_submissions(student_uuid);

create index if not exists job_card_submissions_student_uuid_idx
  on public.job_card_submissions(student_uuid);

create or replace function public.resolve_classroom_submission_student_uuid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
begin
  select cs.school_id
    into v_school_id
  from public.classroom_sessions cs
  where cs.id = new.classroom_session_id;

  if v_school_id is not null and nullif(btrim(new.student_id), '') is not null then
    select s.id
      into new.student_uuid
    from public.attendance_students s
    where s.school_id = v_school_id
      and s.external_student_id = btrim(new.student_id)
    limit 1;
  else
    new.student_uuid := null;
  end if;

  return new;
end;
$$;

revoke all on function public.resolve_classroom_submission_student_uuid() from public, anon, authenticated;

drop trigger if exists trg_resolve_classroom_submission_student_uuid on public.classroom_submissions;
create trigger trg_resolve_classroom_submission_student_uuid
before insert or update of student_id, classroom_session_id
on public.classroom_submissions
for each row execute function public.resolve_classroom_submission_student_uuid();

create or replace function public.resolve_job_card_submission_student_uuid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.school_id is not null and nullif(btrim(new.student_id), '') is not null then
    select s.id
      into new.student_uuid
    from public.attendance_students s
    where s.school_id = new.school_id
      and s.external_student_id = btrim(new.student_id)
    limit 1;
  else
    new.student_uuid := null;
  end if;

  return new;
end;
$$;

revoke all on function public.resolve_job_card_submission_student_uuid() from public, anon, authenticated;

drop trigger if exists trg_resolve_job_card_submission_student_uuid on public.job_card_submissions;
create trigger trg_resolve_job_card_submission_student_uuid
before insert or update of student_id, school_id
on public.job_card_submissions
for each row execute function public.resolve_job_card_submission_student_uuid();

update public.classroom_submissions sub
set student_uuid = s.id
from public.classroom_sessions cs,
     public.attendance_students s
where sub.classroom_session_id = cs.id
  and s.school_id = cs.school_id
  and s.external_student_id = btrim(sub.student_id)
  and nullif(btrim(sub.student_id), '') is not null
  and sub.student_uuid is null;

update public.job_card_submissions sub
set student_uuid = s.id
from public.attendance_students s
where s.school_id = sub.school_id
  and s.external_student_id = btrim(sub.student_id)
  and nullif(btrim(sub.student_id), '') is not null
  and sub.student_uuid is null;

-- ---------------------------------------------------------------------------
-- 2. Turn the existing analytics_events table into a live event stream by
--    mirroring the authoritative audit log. Existing audit history is backfilled.
-- ---------------------------------------------------------------------------

create unique index if not exists analytics_events_audit_log_id_uidx
  on public.analytics_events ((metadata->>'audit_log_id'))
  where metadata ? 'audit_log_id';

create index if not exists analytics_events_school_created_idx
  on public.analytics_events (school_id, created_at desc);

create index if not exists analytics_events_event_created_idx
  on public.analytics_events (event_type, created_at desc);

create or replace function public.mirror_audit_log_to_analytics_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.analytics_events (
    school_id,
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    data_scope,
    metadata,
    created_at
  ) values (
    new.school_id,
    new.user_id,
    new.action,
    new.entity_type,
    new.entity_id,
    'operational',
    coalesce(new.details, '{}'::jsonb)
      || jsonb_build_object('audit_log_id', new.id::text, 'source', 'audit_log'),
    new.created_at
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.mirror_audit_log_to_analytics_events() from public, anon, authenticated;

drop trigger if exists trg_mirror_audit_log_to_analytics_events on public.audit_log;
create trigger trg_mirror_audit_log_to_analytics_events
after insert on public.audit_log
for each row execute function public.mirror_audit_log_to_analytics_events();

insert into public.analytics_events (
  school_id,
  actor_user_id,
  event_type,
  entity_type,
  entity_id,
  data_scope,
  metadata,
  created_at
)
select
  a.school_id,
  a.user_id,
  a.action,
  a.entity_type,
  a.entity_id,
  'operational',
  coalesce(a.details, '{}'::jsonb)
    || jsonb_build_object('audit_log_id', a.id::text, 'source', 'audit_log'),
  a.created_at
from public.audit_log a
where not exists (
  select 1
  from public.analytics_events e
  where e.metadata->>'audit_log_id' = a.id::text
);

-- ---------------------------------------------------------------------------
-- 3. Shared report access helper
-- ---------------------------------------------------------------------------

create or replace function public.can_view_ltg_reports(check_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_owner()
    or public.has_school_role(
      check_school_id,
      array[
        'school_admin'::public.app_school_role,
        'program_lead'::public.app_school_role,
        'lead_instructor'::public.app_school_role,
        'viewer'::public.app_school_role
      ]
    );
$$;

revoke all on function public.can_view_ltg_reports(uuid) from public, anon;
grant execute on function public.can_view_ltg_reports(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Immutable report snapshot archive
-- ---------------------------------------------------------------------------

create table if not exists public.ltg_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid null references public.schools(id) on delete restrict,
  report_scope text not null check (report_scope in ('school', 'platform')),
  period_type text not null,
  period_label text not null,
  period_start date not null,
  period_end date not null,
  revision integer not null default 1 check (revision > 0),
  status text not null default 'draft' check (status in ('draft', 'finalized')),
  payload jsonb not null default '{}'::jsonb,
  generated_by uuid null references auth.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  finalized_by uuid null references auth.users(id) on delete set null,
  finalized_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ltg_report_period_check check (period_end >= period_start),
  constraint ltg_report_scope_school_check check (
    (report_scope = 'school' and school_id is not null)
    or (report_scope = 'platform' and school_id is null)
  )
);

create index if not exists ltg_report_snapshots_school_period_idx
  on public.ltg_report_snapshots (school_id, period_start desc, period_end desc);

create index if not exists ltg_report_snapshots_scope_period_idx
  on public.ltg_report_snapshots (report_scope, period_start desc, period_end desc);

create unique index if not exists ltg_report_snapshots_revision_uidx
  on public.ltg_report_snapshots (
    report_scope,
    coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid),
    period_type,
    period_start,
    period_end,
    revision
  );

alter table public.ltg_report_snapshots enable row level security;

drop policy if exists ltg_report_snapshots_select on public.ltg_report_snapshots;
create policy ltg_report_snapshots_select
on public.ltg_report_snapshots
for select
to authenticated
using (
  (school_id is null and public.is_platform_owner())
  or (school_id is not null and public.can_view_ltg_reports(school_id))
);

-- No direct insert/update/delete policies. Saved reports are written through
-- guarded SECURITY DEFINER RPCs below.

-- ---------------------------------------------------------------------------
-- 5. Single-school reporting summary. This function is intentionally private
--    to database-side callers. The authenticated wrapper enforces scope.
-- ---------------------------------------------------------------------------

create or replace function public.ltg_reporting_summary_internal(
  check_school_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_school_name text;
  v_timezone text := 'America/New_York';
  v_scheduled_days integer := 0;
  v_completed_days integer := 0;
  v_instruction_minutes numeric := 0;
  v_followups integer := 0;
  v_sections integer := 0;
  v_students integer := 0;
  v_attendance_sessions integer := 0;
  v_attendance_finalized integer := 0;
  v_attendance_records integer := 0;
  v_attendance_present integer := 0;
  v_attendance_absent integer := 0;
  v_attendance_left_early integer := 0;
  v_attendance_statuses jsonb := '{}'::jsonb;
  v_classroom_sessions integer := 0;
  v_classroom_submissions integer := 0;
  v_classroom_students integer := 0;
  v_assessment_avg numeric := null;
  v_unlinked_classroom integer := 0;
  v_job_card_sessions integer := 0;
  v_job_card_submissions integer := 0;
  v_job_card_accepted integer := 0;
  v_job_card_recheck integer := 0;
  v_unlinked_job_cards integer := 0;
  v_instructor_notes integer := 0;
  v_agenda_reviews integer := 0;
  v_agenda_approved integer := 0;
  v_audit_events integer := 0;
  v_employee_hours numeric := 0;
  v_open_punches integer := 0;
  v_adjusted_entries integer := 0;
  v_missing_deliveries integer := 0;
  v_archived_delivery_rows integer := 0;
begin
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Invalid reporting period.';
  end if;

  select s.name into v_school_name
  from public.schools s
  where s.id = check_school_id;

  if v_school_name is null then
    raise exception 'School not found.';
  end if;

  select coalesce(t.timezone, 'America/New_York')
    into v_timezone
  from public.timeclock_school_settings t
  where t.school_id = check_school_id;

  v_timezone := coalesce(v_timezone, 'America/New_York');

  select count(*) into v_sections
  from public.sections s
  where s.school_id = check_school_id
    and coalesce(s.status, '') <> 'archived';

  select count(*) into v_students
  from public.attendance_students s
  where s.school_id = check_school_id
    and s.active = true;

  select count(*) into v_scheduled_days
  from public.planner_days d
  where d.school_id = check_school_id
    and d.scheduled_date between p_start_date and p_end_date;

  select
    count(*) filter (where d.delivery_status = 'completed'),
    coalesce(sum(d.actual_minutes) filter (where d.delivery_status = 'completed'), 0),
    count(*) filter (where d.follow_up_needed = true)
  into v_completed_days, v_instruction_minutes, v_followups
  from public.planner_day_delivery d
  where d.school_id = check_school_id
    and coalesce(d.actual_date, (d.completed_at at time zone v_timezone)::date)
        between p_start_date and p_end_date;

  select count(*) into v_missing_deliveries
  from public.planner_days pd
  where pd.school_id = check_school_id
    and pd.scheduled_date between p_start_date and p_end_date
    and not exists (
      select 1
      from public.planner_day_delivery dd
      where dd.planner_day_id = pd.id
        and dd.delivery_status = 'completed'
    );

  select count(*) into v_archived_delivery_rows
  from public.planner_day_delivery_archive a
  where a.school_id = check_school_id
    and coalesce(a.actual_date, (a.archived_at at time zone v_timezone)::date)
        between p_start_date and p_end_date;

  select
    count(*),
    count(*) filter (where s.status = 'finalized')
  into v_attendance_sessions, v_attendance_finalized
  from public.attendance_sessions s
  where s.school_id = check_school_id
    and s.attendance_date between p_start_date and p_end_date;

  select
    count(*),
    count(*) filter (where r.final_status = 'present'),
    count(*) filter (where r.final_status = 'absent'),
    count(*) filter (where r.final_status = 'left_early')
  into
    v_attendance_records,
    v_attendance_present,
    v_attendance_absent,
    v_attendance_left_early
  from public.attendance_records r
  join public.attendance_sessions s on s.id = r.session_id
  where s.school_id = check_school_id
    and s.attendance_date between p_start_date and p_end_date;

  select coalesce(jsonb_object_agg(status_key, n), '{}'::jsonb)
    into v_attendance_statuses
  from (
    select coalesce(r.final_status, 'not_recorded') as status_key, count(*) as n
    from public.attendance_records r
    join public.attendance_sessions s on s.id = r.session_id
    where s.school_id = check_school_id
      and s.attendance_date between p_start_date and p_end_date
    group by coalesce(r.final_status, 'not_recorded')
  ) q;

  select count(*) into v_classroom_sessions
  from public.classroom_sessions cs
  where cs.school_id = check_school_id
    and (cs.started_at at time zone v_timezone)::date between p_start_date and p_end_date;

  select
    count(*),
    count(distinct coalesce(sub.student_uuid::text, nullif(btrim(sub.student_id), ''))),
    round(avg(
      case when sub.possible_score > 0
        then (sub.score::numeric * 100.0 / sub.possible_score::numeric)
      end
    ), 1),
    count(*) filter (where sub.student_uuid is null)
  into
    v_classroom_submissions,
    v_classroom_students,
    v_assessment_avg,
    v_unlinked_classroom
  from public.classroom_submissions sub
  join public.classroom_sessions cs on cs.id = sub.classroom_session_id
  where cs.school_id = check_school_id
    and (cs.started_at at time zone v_timezone)::date between p_start_date and p_end_date;

  select count(*) into v_job_card_sessions
  from public.job_card_sessions js
  where js.school_id = check_school_id
    and (js.started_at at time zone v_timezone)::date between p_start_date and p_end_date;

  select
    count(*),
    count(*) filter (where lower(coalesce(sub.review_decision, '')) in ('accepted', 'pass', 'approved')),
    count(*) filter (where lower(coalesce(sub.review_decision, '')) in ('recheck', 'revise', 'retry')),
    count(*) filter (where sub.student_uuid is null)
  into
    v_job_card_submissions,
    v_job_card_accepted,
    v_job_card_recheck,
    v_unlinked_job_cards
  from public.job_card_submissions sub
  join public.job_card_sessions js on js.id = sub.job_card_session_id
  where sub.school_id = check_school_id
    and (js.started_at at time zone v_timezone)::date between p_start_date and p_end_date;

  select count(*) into v_instructor_notes
  from public.instructor_notes n
  where n.school_id = check_school_id
    and (n.created_at at time zone v_timezone)::date between p_start_date and p_end_date;

  select
    count(*),
    count(*) filter (
      where lower(coalesce(r.school_decision, '')) in ('approved', 'accept', 'accepted')
         or lower(coalesce(r.owner_status, '')) in ('approved', 'accept', 'accepted')
    )
  into v_agenda_reviews, v_agenda_approved
  from public.agenda_change_reviews r
  where r.school_id = check_school_id
    and (r.created_at at time zone v_timezone)::date between p_start_date and p_end_date;

  select count(*) into v_audit_events
  from public.audit_log a
  where a.school_id = check_school_id
    and (a.created_at at time zone v_timezone)::date between p_start_date and p_end_date;

  select coalesce(round(sum(extract(epoch from (e.clock_out_at - e.clock_in_at)) / 3600.0)::numeric, 2), 0)
    into v_employee_hours
  from public.timeclock_entries e
  where e.school_id = check_school_id
    and e.clock_out_at is not null
    and (e.clock_in_at at time zone v_timezone)::date between p_start_date and p_end_date;

  select count(*) into v_open_punches
  from public.timeclock_entries e
  where e.school_id = check_school_id
    and e.clock_out_at is null
    and (e.clock_in_at at time zone v_timezone)::date <= p_end_date;

  select count(distinct a.entry_id) into v_adjusted_entries
  from public.timeclock_adjustments a
  where a.school_id = check_school_id
    and (a.adjusted_at at time zone v_timezone)::date between p_start_date and p_end_date;

  return jsonb_build_object(
    'scope', 'school',
    'school_id', check_school_id,
    'school_name', v_school_name,
    'timezone', v_timezone,
    'period', jsonb_build_object('start', p_start_date, 'end', p_end_date),
    'instruction', jsonb_build_object(
      'sections', v_sections,
      'scheduled_days', v_scheduled_days,
      'completed_days', v_completed_days,
      'instruction_minutes', v_instruction_minutes,
      'instruction_hours', round(v_instruction_minutes / 60.0, 2),
      'followups', v_followups,
      'missing_completed_days', v_missing_deliveries,
      'archived_delivery_rows', v_archived_delivery_rows
    ),
    'students', jsonb_build_object(
      'active_students', v_students,
      'attendance_sessions', v_attendance_sessions,
      'attendance_finalized_sessions', v_attendance_finalized,
      'attendance_records', v_attendance_records,
      'present', v_attendance_present,
      'absent', v_attendance_absent,
      'left_early', v_attendance_left_early,
      'attendance_statuses', v_attendance_statuses,
      'attendance_rate_pct', case
        when (v_attendance_present + v_attendance_absent + v_attendance_left_early) > 0
          then round(
            v_attendance_present::numeric * 100.0 /
            (v_attendance_present + v_attendance_absent + v_attendance_left_early)::numeric,
            1
          )
        else null
      end
    ),
    'learning', jsonb_build_object(
      'classroom_sessions', v_classroom_sessions,
      'classroom_submissions', v_classroom_submissions,
      'students_assessed', v_classroom_students,
      'assessment_average_pct', v_assessment_avg,
      'job_card_sessions', v_job_card_sessions,
      'job_card_submissions', v_job_card_submissions,
      'job_card_accepted', v_job_card_accepted,
      'job_card_recheck', v_job_card_recheck
    ),
    'instructional_improvement', jsonb_build_object(
      'instructor_notes', v_instructor_notes,
      'agenda_reviews', v_agenda_reviews,
      'approved_changes', v_agenda_approved
    ),
    'workforce', jsonb_build_object(
      'employee_hours', v_employee_hours,
      'open_punches', v_open_punches,
      'adjusted_entries', v_adjusted_entries
    ),
    'usage', jsonb_build_object(
      'audit_events', v_audit_events
    ),
    'data_quality', jsonb_build_object(
      'unfinalized_attendance_sessions', greatest(v_attendance_sessions - v_attendance_finalized, 0),
      'unlinked_classroom_submissions', v_unlinked_classroom,
      'unlinked_job_card_submissions', v_unlinked_job_cards,
      'open_timeclock_punches', v_open_punches,
      'scheduled_days_without_completion', v_missing_deliveries,
      'archived_delivery_rows_excluded_from_totals', v_archived_delivery_rows
    )
  );
end;
$$;

revoke all on function public.ltg_reporting_summary_internal(uuid, date, date)
  from public, anon, authenticated;

create or replace function public.get_ltg_reporting_summary(
  p_school_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_view_ltg_reports(p_school_id) then
    raise exception 'Not authorized to view this school report.';
  end if;

  return public.ltg_reporting_summary_internal(p_school_id, p_start_date, p_end_date);
end;
$$;

revoke all on function public.get_ltg_reporting_summary(uuid, date, date) from public, anon;
grant execute on function public.get_ltg_reporting_summary(uuid, date, date) to authenticated;

create or replace function public.get_ltg_platform_reporting_summary(
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_schools jsonb;
begin
  if not public.is_platform_owner() then
    raise exception 'Platform owner access required.';
  end if;

  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Invalid reporting period.';
  end if;

  select coalesce(
    jsonb_agg(public.ltg_reporting_summary_internal(s.id, p_start_date, p_end_date) order by s.name),
    '[]'::jsonb
  )
  into v_schools
  from public.schools s
  where coalesce(s.status, 'active') <> 'archived';

  return jsonb_build_object(
    'scope', 'platform',
    'period', jsonb_build_object('start', p_start_date, 'end', p_end_date),
    'school_count', jsonb_array_length(v_schools),
    'schools', v_schools
  );
end;
$$;

revoke all on function public.get_ltg_platform_reporting_summary(date, date) from public, anon;
grant execute on function public.get_ltg_platform_reporting_summary(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Generate/finalize frozen report snapshots with revisions.
-- ---------------------------------------------------------------------------

create or replace function public.generate_ltg_report_snapshot(
  p_school_id uuid,
  p_period_type text,
  p_period_label text,
  p_start_date date,
  p_end_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope text;
  v_payload jsonb;
  v_revision integer;
  v_report_id uuid;
begin
  if nullif(btrim(p_period_type), '') is null
     or nullif(btrim(p_period_label), '') is null
     or p_start_date is null
     or p_end_date is null
     or p_end_date < p_start_date then
    raise exception 'Reporting period and labels are required.';
  end if;

  if p_school_id is null then
    if not public.is_platform_owner() then
      raise exception 'Platform owner access required.';
    end if;
    v_scope := 'platform';
    v_payload := public.get_ltg_platform_reporting_summary(p_start_date, p_end_date);
  else
    if not public.can_manage_school(p_school_id) then
      raise exception 'School administrator or program lead access required to save reports.';
    end if;
    v_scope := 'school';
    v_payload := public.ltg_reporting_summary_internal(p_school_id, p_start_date, p_end_date);
  end if;

  select coalesce(max(r.revision), 0) + 1
    into v_revision
  from public.ltg_report_snapshots r
  where r.report_scope = v_scope
    and r.school_id is not distinct from p_school_id
    and r.period_type = btrim(p_period_type)
    and r.period_start = p_start_date
    and r.period_end = p_end_date;

  insert into public.ltg_report_snapshots (
    school_id,
    report_scope,
    period_type,
    period_label,
    period_start,
    period_end,
    revision,
    status,
    payload,
    generated_by
  ) values (
    p_school_id,
    v_scope,
    btrim(p_period_type),
    btrim(p_period_label),
    p_start_date,
    p_end_date,
    v_revision,
    'draft',
    v_payload,
    auth.uid()
  )
  returning id into v_report_id;

  insert into public.audit_log (
    school_id, user_id, action, entity_type, entity_id, details
  ) values (
    p_school_id,
    auth.uid(),
    'ltg_report_snapshot_generated',
    'ltg_report_snapshot',
    v_report_id,
    jsonb_build_object(
      'scope', v_scope,
      'period_type', btrim(p_period_type),
      'period_label', btrim(p_period_label),
      'period_start', p_start_date,
      'period_end', p_end_date,
      'revision', v_revision
    )
  );

  return v_report_id;
end;
$$;

revoke all on function public.generate_ltg_report_snapshot(uuid, text, text, date, date)
  from public, anon;
grant execute on function public.generate_ltg_report_snapshot(uuid, text, text, date, date)
  to authenticated;

create or replace function public.finalize_ltg_report_snapshot(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.ltg_report_snapshots%rowtype;
begin
  select * into v_report
  from public.ltg_report_snapshots
  where id = p_report_id;

  if not found then
    raise exception 'Report snapshot not found.';
  end if;

  if v_report.school_id is null then
    if not public.is_platform_owner() then
      raise exception 'Platform owner access required.';
    end if;
  else
    if not public.can_manage_school(v_report.school_id) then
      raise exception 'School administrator or program lead access required.';
    end if;
  end if;

  if v_report.status = 'finalized' then
    return;
  end if;

  update public.ltg_report_snapshots
  set status = 'finalized',
      finalized_by = auth.uid(),
      finalized_at = now(),
      updated_at = now()
  where id = p_report_id;

  insert into public.audit_log (
    school_id, user_id, action, entity_type, entity_id, details
  ) values (
    v_report.school_id,
    auth.uid(),
    'ltg_report_snapshot_finalized',
    'ltg_report_snapshot',
    p_report_id,
    jsonb_build_object(
      'scope', v_report.report_scope,
      'period_type', v_report.period_type,
      'period_label', v_report.period_label,
      'period_start', v_report.period_start,
      'period_end', v_report.period_end,
      'revision', v_report.revision
    )
  );
end;
$$;

revoke all on function public.finalize_ltg_report_snapshot(uuid) from public, anon;
grant execute on function public.finalize_ltg_report_snapshot(uuid) to authenticated;

commit;
