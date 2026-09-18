-- LTG class-time watchdog, 30-minute overdue instructor reminder, and end-of-day cleanup.
-- Uses America/New_York because PCCC/PVHS instructional schedules are New Jersey local time.

create table if not exists public.class_watchdog_queue (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  planner_day_id uuid not null references public.planner_days(id) on delete cascade,
  event_type text not null default 'end_overdue'
    check (event_type in ('end_overdue')),
  recipient_user_id uuid null references public.profiles(id) on delete set null,
  recipient_email text not null,
  scheduled_end_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0,
  last_error text null,
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (planner_day_id, event_type, recipient_email)
);

create index if not exists class_watchdog_queue_status_idx
  on public.class_watchdog_queue(status, created_at);

alter table public.class_watchdog_queue enable row level security;

create or replace function public.enqueue_class_watchdog_reminders(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer := 0;
begin
  with candidates as (
    select
      s.school_id,
      s.id as section_id,
      pd.id as planner_day_id,
      pd.planner_day_number,
      pd.scheduled_date,
      s.end_time,
      pdd.instructor_id as started_by,
      ((pd.scheduled_date::timestamp + s.end_time) at time zone 'America/New_York') as scheduled_end_at
    from public.sections s
    join public.section_progress sp on sp.section_id = s.id
    join public.planner_days pd on pd.section_id = s.id
    left join public.planner_day_delivery pdd on pdd.planner_day_id = pd.id
    where s.status = 'active'
      and s.end_time is not null
      and pd.scheduled_date = (p_now at time zone 'America/New_York')::date
      and (((pd.scheduled_date::timestamp + s.end_time) at time zone 'America/New_York')
           + interval '30 minutes') <= p_now
      and not exists (
        select 1
        from public.section_calendar_exceptions sce
        where sce.section_id = s.id
          and sce.exception_date = pd.scheduled_date
          and sce.counts_as_teaching_day = false
      )
      and (
        pdd.delivery_status in ('in_progress','started')
        or (
          sp.current_planner_day_number = pd.planner_day_number
          and coalesce(pdd.delivery_status,'') <> 'completed'
        )
        or exists (
          select 1
          from public.attendance_pairs ap
          left join public.attendance_sessions ats
            on ats.pair_id = ap.id
           and ats.attendance_date = pd.scheduled_date
          where ap.active = true
            and ap.completion_section_id = s.id
            and coalesce(ats.status,'draft') <> 'finalized'
        )
      )
  ),
  started_recipients as (
    select
      c.*,
      p.id as recipient_user_id,
      lower(btrim(p.email)) as recipient_email
    from candidates c
    join public.profiles p on p.id = c.started_by
    where nullif(btrim(coalesce(p.email,'')),'') is not null
  ),
  fallback_recipients as (
    select
      c.*,
      p.id as recipient_user_id,
      lower(btrim(p.email)) as recipient_email
    from candidates c
    join public.section_instructors si
      on si.section_id = c.section_id
     and si.active = true
    join public.profiles p on p.id = si.instructor_id
    where not exists (
      select 1
      from public.profiles started_profile
      where started_profile.id = c.started_by
        and nullif(btrim(coalesce(started_profile.email,'')),'') is not null
    )
      and nullif(btrim(coalesce(p.email,'')),'') is not null
      and (
        (
          exists (
            select 1 from public.section_instructors lead_si
            where lead_si.section_id = c.section_id
              and lead_si.active = true
              and lead_si.instructor_role = 'lead_instructor'
          )
          and si.instructor_role = 'lead_instructor'
        )
        or not exists (
          select 1 from public.section_instructors lead_si
          where lead_si.section_id = c.section_id
            and lead_si.active = true
            and lead_si.instructor_role = 'lead_instructor'
        )
      )
  ),
  recipients as (
    select * from started_recipients
    union
    select * from fallback_recipients
  )
  insert into public.class_watchdog_queue (
    school_id,
    section_id,
    planner_day_id,
    event_type,
    recipient_user_id,
    recipient_email,
    scheduled_end_at,
    status
  )
  select distinct
    r.school_id,
    r.section_id,
    r.planner_day_id,
    'end_overdue',
    r.recipient_user_id,
    r.recipient_email,
    r.scheduled_end_at,
    'pending'
  from recipients r
  where r.recipient_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  on conflict (planner_day_id, event_type, recipient_email) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

create or replace function public.claim_due_class_watchdog_reminders(
  p_limit integer default 25
)
returns table (
  queue_id uuid,
  school_id uuid,
  section_id uuid,
  planner_day_id uuid,
  event_type text,
  recipient_user_id uuid,
  recipient_email text,
  scheduled_end_at timestamptz,
  attempts integer
)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select q.id
    from public.class_watchdog_queue q
    where q.status in ('pending','failed')
      and q.attempts < 5
    order by q.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit,25),100))
  ),
  claimed as (
    update public.class_watchdog_queue q
    set status = 'processing',
        attempts = q.attempts + 1,
        updated_at = now()
    from due
    where q.id = due.id
    returning
      q.id,
      q.school_id,
      q.section_id,
      q.planner_day_id,
      q.event_type,
      q.recipient_user_id,
      q.recipient_email,
      q.scheduled_end_at,
      q.attempts
  )
  select
    id,
    school_id,
    section_id,
    planner_day_id,
    event_type,
    recipient_user_id,
    recipient_email,
    scheduled_end_at,
    attempts
  from claimed;
$$;

create or replace function public.run_class_end_of_day_cleanup(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_local_date date := (p_now at time zone 'America/New_York')::date;
  v_local_time time := (p_now at time zone 'America/New_York')::time;
  v_session record;
  v_delivery record;
  v_attendance_finalized integer := 0;
  v_timers_closed integer := 0;
  v_failures integer := 0;
  v_max_days integer;
  v_completed_at timestamptz;
begin
  -- First close attendance. Existing second-half entries win; blanks copy the
  -- first-half 105/205 status. Sessions with missing first-half attendance are not invented.
  for v_session in
    select
      ats.*,
      ap.completion_section_id,
      ap.report_trigger,
      ap.report_email,
      ap.attendance_mode as pair_attendance_mode
    from public.attendance_sessions ats
    join public.attendance_pairs ap on ap.id = ats.pair_id
    where ats.status <> 'finalized'
      and ats.session_type = 'instructional'
      and ats.counts_toward_attendance = true
      and (
        ats.attendance_date < v_local_date
        or (ats.attendance_date = v_local_date and v_local_time >= time '23:30')
      )
      and not exists (
        select 1
        from public.attendance_pair_enrollments e
        join public.attendance_students stu
          on stu.id = e.student_id
         and stu.active = true
        left join public.attendance_records ar
          on ar.session_id = ats.id
         and ar.student_id = e.student_id
        where e.pair_id = ats.pair_id
          and e.active = true
          and e.created_at::date <= ats.attendance_date
          and (ar.id is null or ar.initial_status is null)
      )
  loop
    begin
      update public.attendance_records ar
      set final_status = coalesce(ar.final_status, ar.initial_status),
          completion_confirmed = true,
          updated_at = p_now
      where ar.session_id = v_session.id
        and ar.initial_status is not null;

      update public.attendance_sessions
      set status = 'finalized',
          finalized_at = p_now,
          finalized_by = null,
          report_recipient = case
            when v_session.attendance_mode = 'pvhs'
             and v_session.pair_attendance_mode = 'pvhs'
              then coalesce(report_recipient, v_session.report_email)
            else report_recipient
          end,
          updated_at = p_now
      where id = v_session.id;

      if v_session.attendance_mode = 'pvhs'
         and v_session.pair_attendance_mode = 'pvhs' then
        if v_session.report_trigger = 'initial_complete' then
          perform private.queue_pvhs_attendance_report_if_ready(v_session.id);
        elsif nullif(btrim(coalesce(v_session.report_email,'')),'') is not null then
          insert into public.attendance_report_queue
            (school_id, session_id, recipient_email, run_after, status)
          values
            (v_session.school_id, v_session.id, v_session.report_email, p_now, 'pending')
          on conflict (session_id) do update
          set recipient_email = excluded.recipient_email,
              run_after = excluded.run_after,
              status = case
                when public.attendance_report_queue.status = 'sent' then 'sent'
                else 'pending'
              end,
              last_error = null,
              updated_at = p_now;
        end if;
      end if;

      perform public.write_audit_event(
        v_session.school_id,
        'automatic_end_of_day_attendance_finalize',
        'attendance_session',
        v_session.id,
        jsonb_build_object(
          'pair_id', v_session.pair_id,
          'attendance_date', v_session.attendance_date,
          'rule', 'copy_first_half_status_when_second_half_blank'
        )
      );

      v_attendance_finalized := v_attendance_finalized + 1;
    exception when others then
      v_failures := v_failures + 1;
      perform public.write_audit_event(
        v_session.school_id,
        'automatic_end_of_day_attendance_finalize_failed',
        'attendance_session',
        v_session.id,
        jsonb_build_object(
          'pair_id', v_session.pair_id,
          'attendance_date', v_session.attendance_date,
          'error', sqlerrm
        )
      );
    end;
  end loop;

  -- Then close only timers that were actually started. A missing class start is
  -- flagged by the visual watchdog; LTG does not fabricate an instructional start.
  for v_delivery in
    select
      pdd.id as delivery_id,
      pdd.school_id,
      pdd.section_id,
      pdd.planner_day_id,
      pdd.actual_date,
      pdd.started_at,
      pd.planner_day_number,
      pd.scheduled_date,
      s.end_time,
      s.planned_minutes_per_day,
      s.planned_instructional_days,
      sp.current_planner_day_number,
      sp.manual_hold
    from public.planner_day_delivery pdd
    join public.planner_days pd on pd.id = pdd.planner_day_id
    join public.sections s on s.id = pdd.section_id
    join public.section_progress sp on sp.section_id = pdd.section_id
    where pdd.delivery_status in ('in_progress','started')
      and pdd.started_at is not null
      and s.end_time is not null
      and (
        coalesce(pdd.actual_date, pd.scheduled_date) < v_local_date
        or (
          coalesce(pdd.actual_date, pd.scheduled_date) = v_local_date
          and v_local_time >= time '23:30'
        )
      )
  loop
    begin
      v_completed_at := greatest(
        v_delivery.started_at + interval '1 minute',
        (
          (coalesce(v_delivery.actual_date, v_delivery.scheduled_date)::timestamp + v_delivery.end_time)
          at time zone 'America/New_York'
        )
      );

      update public.planner_day_delivery
      set delivery_status = 'completed',
          completed_at = v_completed_at,
          actual_minutes = coalesce(
            v_delivery.planned_minutes_per_day,
            greatest(1, round(extract(epoch from (v_completed_at - v_delivery.started_at)) / 60.0)::integer)
          ),
          updated_at = p_now
      where id = v_delivery.delivery_id;

      update public.planner_day_coverage
      set status = 'completed',
          completed_at = v_completed_at,
          updated_at = p_now
      where planner_day_id = v_delivery.planner_day_id
        and status = 'active';

      if v_delivery.current_planner_day_number = v_delivery.planner_day_number then
        v_max_days := coalesce(
          v_delivery.planned_instructional_days,
          (select max(pd2.planner_day_number)
           from public.planner_days pd2
           where pd2.section_id = v_delivery.section_id)
        );

        if v_delivery.planner_day_number >= v_max_days then
          update public.section_progress
          set completed_at = coalesce(completed_at, v_completed_at),
              updated_at = p_now
          where section_id = v_delivery.section_id;
        elsif v_delivery.manual_hold then
          update public.section_progress
          set last_advanced_at = null,
              updated_at = p_now
          where section_id = v_delivery.section_id;
        else
          update public.section_progress
          set current_planner_day_number = v_delivery.planner_day_number + 1,
              last_advanced_at = v_completed_at,
              updated_at = p_now
          where section_id = v_delivery.section_id;
        end if;
      end if;

      perform public.write_audit_event(
        v_delivery.school_id,
        'automatic_end_of_day_timer_close',
        'planner_day',
        v_delivery.planner_day_id,
        jsonb_build_object(
          'section_id', v_delivery.section_id,
          'planner_day_number', v_delivery.planner_day_number,
          'started_at', v_delivery.started_at,
          'completed_at', v_completed_at,
          'actual_minutes', coalesce(v_delivery.planned_minutes_per_day, 1),
          'rule', 'scheduled_class_end'
        )
      );

      v_timers_closed := v_timers_closed + 1;
    exception when others then
      v_failures := v_failures + 1;
      perform public.write_audit_event(
        v_delivery.school_id,
        'automatic_end_of_day_timer_close_failed',
        'planner_day',
        v_delivery.planner_day_id,
        jsonb_build_object(
          'section_id', v_delivery.section_id,
          'planner_day_number', v_delivery.planner_day_number,
          'error', sqlerrm
        )
      );
    end;
  end loop;

  return jsonb_build_object(
    'attendance_finalized', v_attendance_finalized,
    'timers_closed', v_timers_closed,
    'failures', v_failures,
    'local_date', v_local_date,
    'local_time', v_local_time
  );
end;
$$;

-- Exact known PVHS pair times.
update public.sections
set start_time = time '08:30', end_time = time '09:30'
where section_code = 'PVHS-B-WLD105-2627';

update public.sections
set start_time = time '09:30', end_time = time '11:30'
where section_code = 'PVHS-B-WLD110-2627';

update public.sections
set start_time = time '11:30', end_time = time '12:30'
where section_code = 'PVHS-C-WLD105-2627';

update public.sections
set start_time = time '12:30', end_time = time '14:30'
where section_code = 'PVHS-C-WLD110-2627';

update public.sections
set start_time = time '11:30', end_time = time '12:30'
where section_code = 'PVHS-A-WLD205-2627';

update public.sections
set start_time = time '12:30', end_time = time '14:30'
where section_code = 'PVHS-A-WLD210-2627';

update public.section_meeting_blocks smb
set start_time = time '08:30', end_time = time '09:30', flexible_time = false
from public.sections s
where smb.section_id = s.id
  and s.section_code = 'PVHS-B-WLD105-2627'
  and smb.sequence_number = 1;

update public.section_meeting_blocks smb
set start_time = time '11:30', end_time = time '12:30', flexible_time = false
from public.sections s
where smb.section_id = s.id
  and s.section_code = 'PVHS-C-WLD105-2627'
  and smb.sequence_number = 1;

do $$
declare
  v_job record;
begin
  for v_job in select jobid from cron.job where jobname = 'class-watchdog-worker'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;

  for v_job in select jobid from cron.job where jobname = 'class-end-of-day-cleanup'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end
$$;

select cron.schedule(
  'class-watchdog-worker',
  '*/5 * * * *',
  $cron$
    select net.http_post(
      url := 'https://qsmvgyyaemjmklceyikr.supabase.co/functions/v1/send-class-watchdog-reminders',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-attendance-cron-secret',
        (select decrypted_secret from vault.decrypted_secrets where name='attendance_cron_secret' limit 1)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $cron$
);

select cron.schedule(
  'class-end-of-day-cleanup',
  '*/15 * * * *',
  $cron$
    select public.run_class_end_of_day_cleanup(now());
  $cron$
);
