-- Prevent paired-course date races from creating tomorrow's attendance today.
-- Add a dashboard RPC that distinguishes missing attendance from open/unfinalized attendance.

create or replace function private.school_timezone(p_school_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    (
      select settings.timezone
      from public.timeclock_school_settings settings
      join pg_catalog.pg_timezone_names timezone_names
        on timezone_names.name = settings.timezone
      where settings.school_id = p_school_id
      limit 1
    ),
    'UTC'
  );
$function$;

create or replace function private.school_local_date(p_school_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $function$
  select (now() at time zone private.school_timezone(p_school_id))::date;
$function$;

revoke all on function private.school_timezone(uuid) from public, anon, authenticated;
revoke all on function private.school_local_date(uuid) from public, anon, authenticated;

create or replace function private.guard_attendance_session_not_future()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_school_date date;
begin
  v_school_date := private.school_local_date(new.school_id);

  if new.attendance_date > v_school_date then
    raise sqlstate '22007'
      using message = format(
        'Attendance cannot be opened for %s before that school date begins. Current school date is %s.',
        new.attendance_date,
        v_school_date
      );
  end if;

  return new;
end;
$function$;

revoke all on function private.guard_attendance_session_not_future()
  from public, anon, authenticated;

drop trigger if exists attendance_sessions_reject_future_date
  on public.attendance_sessions;
create trigger attendance_sessions_reject_future_date
before insert or update of attendance_date, school_id
on public.attendance_sessions
for each row
execute function private.guard_attendance_session_not_future();

create or replace function private.queue_pvhs_attendance_report_if_ready(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_session public.attendance_sessions%rowtype;
  v_pair public.attendance_pairs%rowtype;
  v_missing integer := 0;
  v_roster_count integer := 0;
  v_inserted integer := 0;
  v_school_date date;
begin
  select * into v_session
  from public.attendance_sessions
  where id = p_session_id;

  if v_session.id is null then
    raise exception 'Attendance session not found';
  end if;

  select * into v_pair
  from public.attendance_pairs
  where id = v_session.pair_id;

  if v_pair.id is null then
    raise exception 'Attendance pair not found';
  end if;

  v_school_date := private.school_local_date(v_session.school_id);
  if v_session.attendance_date > v_school_date then
    delete from public.attendance_report_queue
    where session_id = p_session_id
      and status in ('pending', 'failed');

    raise sqlstate '22007'
      using message = format(
        'Attendance report blocked because %s is a future school date. Current school date is %s.',
        v_session.attendance_date,
        v_school_date
      );
  end if;

  if not v_session.counts_toward_attendance
     or v_session.session_type <> 'instructional'
     or v_session.attendance_mode <> 'pvhs'
     or v_pair.attendance_mode <> 'pvhs'
     or v_pair.report_trigger <> 'initial_complete' then
    delete from public.attendance_report_queue
    where session_id = p_session_id
      and status in ('pending','failed');
    return false;
  end if;

  if nullif(btrim(coalesce(v_pair.report_email, '')), '') is null then
    raise exception 'PVHS report email is not configured';
  end if;

  select count(*),
         count(*) filter (where ar.id is null or ar.initial_status is null)
  into v_roster_count, v_missing
  from public.attendance_pair_enrollments e
  join public.attendance_students stu
    on stu.id = e.student_id
   and stu.active = true
  left join public.attendance_records ar
    on ar.session_id = p_session_id
   and ar.student_id = e.student_id
  where e.pair_id = v_pair.id
    and e.active = true
    and e.created_at::date <= v_session.attendance_date;

  if v_roster_count = 0 or v_missing > 0 then
    delete from public.attendance_report_queue
    where session_id = p_session_id
      and status in ('pending','failed');
    return false;
  end if;

  update public.attendance_sessions
  set report_recipient = coalesce(report_recipient, v_pair.report_email),
      updated_at = now()
  where id = p_session_id;

  insert into public.attendance_report_queue
    (school_id, session_id, recipient_email, run_after, status)
  values
    (v_session.school_id, p_session_id, v_pair.report_email,
     now() + make_interval(mins => v_pair.report_delay_minutes), 'pending')
  on conflict (session_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    perform public.write_audit_event(
      v_session.school_id,
      'attendance_report_queued_initial',
      'attendance_session',
      p_session_id,
      jsonb_build_object(
        'pair_id', v_pair.id,
        'attendance_date', v_session.attendance_date,
        'delay_minutes', v_pair.report_delay_minutes,
        'trigger', v_pair.report_trigger
      )
    );
    return true;
  end if;

  return false;
end;
$function$;

create or replace function public.get_attendance_action_alerts(
  p_as_of date default current_date
)
returns table(
  alert_type text,
  session_id uuid,
  pair_id uuid,
  pair_name text,
  attendance_date date,
  completion_section_id uuid,
  attendance_mode text,
  marked_count integer,
  student_count integer,
  is_overdue boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return query
  with visible_pairs as (
    select p.*
    from public.attendance_pairs p
    where p.active = true
      and (
        public.is_platform_owner()
        or public.can_review_instruction(p.school_id)
        or exists (
          select 1
          from public.section_instructors si
          where si.instructor_id = auth.uid()
            and si.active = true
            and si.section_id in (p.primary_section_id, p.completion_section_id)
        )
      )
  ),
  unfinalized as (
    select
      'unfinalized'::text as alert_type,
      ses.id as session_id,
      p.id as pair_id,
      p.pair_name,
      ses.attendance_date,
      p.completion_section_id,
      p.attendance_mode,
      (
        select count(*)::integer
        from public.attendance_records ar
        where ar.session_id = ses.id
          and ar.initial_status is not null
      ) as marked_count,
      (
        select count(*)::integer
        from public.attendance_pair_enrollments e
        join public.attendance_students stu
          on stu.id = e.student_id
         and stu.active = true
        where e.pair_id = p.id
          and e.active = true
          and e.created_at::date <= ses.attendance_date
      ) as student_count,
      ses.attendance_date < p_as_of as is_overdue
    from public.attendance_sessions ses
    join visible_pairs p on p.id = ses.pair_id
    where ses.status <> 'finalized'
      and ses.attendance_date <= p_as_of
      and exists (
        select 1
        from public.attendance_records ar
        where ar.session_id = ses.id
          and ar.initial_status is not null
      )
  ),
  delivery_dates as (
    select
      p.id as pair_id,
      p.pair_name,
      p.school_id,
      p.primary_section_id,
      p.completion_section_id,
      p.attendance_mode,
      d.section_id,
      d.delivery_status,
      coalesce(
        d.actual_date,
        (d.started_at at time zone private.school_timezone(p.school_id))::date
      ) as attendance_date
    from visible_pairs p
    join public.planner_day_delivery d
      on d.section_id in (p.primary_section_id, p.completion_section_id)
    where d.delivery_status in ('in_progress', 'started', 'completed')
      and (d.actual_date is not null or d.started_at is not null)
  ),
  activity as (
    select
      d.pair_id,
      d.pair_name,
      d.school_id,
      d.primary_section_id,
      d.completion_section_id,
      d.attendance_mode,
      d.attendance_date,
      bool_or(
        d.section_id = d.primary_section_id
        and d.delivery_status = 'completed'
      ) as primary_completed,
      bool_or(
        d.section_id = d.completion_section_id
        and d.delivery_status in ('in_progress', 'started', 'completed')
      ) as completion_started
    from delivery_dates d
    where d.attendance_date is not null
      and d.attendance_date <= p_as_of
    group by
      d.pair_id,
      d.pair_name,
      d.school_id,
      d.primary_section_id,
      d.completion_section_id,
      d.attendance_mode,
      d.attendance_date
  ),
  missing as (
    select
      'missing'::text as alert_type,
      ses.id as session_id,
      a.pair_id,
      a.pair_name,
      a.attendance_date,
      a.completion_section_id,
      a.attendance_mode,
      0::integer as marked_count,
      (
        select count(*)::integer
        from public.attendance_pair_enrollments e
        join public.attendance_students stu
          on stu.id = e.student_id
         and stu.active = true
        where e.pair_id = a.pair_id
          and e.active = true
          and e.created_at::date <= a.attendance_date
      ) as student_count,
      a.attendance_date < p_as_of as is_overdue
    from activity a
    left join public.attendance_sessions ses
      on ses.pair_id = a.pair_id
     and ses.attendance_date = a.attendance_date
    where (a.primary_completed or a.completion_started)
      and not exists (
        select 1
        from public.attendance_records ar
        where ar.session_id = ses.id
          and ar.initial_status is not null
      )
  )
  select * from unfinalized
  union all
  select * from missing
  order by is_overdue desc, attendance_date asc, pair_name asc, alert_type asc;
end;
$function$;

revoke all on function public.get_attendance_action_alerts(date)
  from public, anon;
grant execute on function public.get_attendance_action_alerts(date)
  to authenticated;

-- Transactional regression check: an active pair must reject a future session.
do $test$
declare
  v_pair public.attendance_pairs%rowtype;
  v_future_date date;
  v_blocked boolean := false;
begin
  select * into v_pair
  from public.attendance_pairs
  where active = true
  order by created_at
  limit 1;

  if v_pair.id is null then
    return;
  end if;

  v_future_date := private.school_local_date(v_pair.school_id) + 1;

  begin
    insert into public.attendance_sessions
      (school_id, pair_id, attendance_date, attendance_mode, status,
       taken_at, session_type, counts_toward_attendance)
    values
      (v_pair.school_id, v_pair.id, v_future_date, v_pair.attendance_mode,
       'draft', now(), 'instructional', true);
  exception when sqlstate '22007' then
    v_blocked := true;
  end;

  if not v_blocked then
    raise exception 'Future attendance regression check failed';
  end if;
end
$test$;
