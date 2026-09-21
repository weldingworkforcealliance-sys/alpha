-- Watchdog only: no curriculum, attendance, delivery, or planner progress mutations.
set local lock_timeout='3s';
set local statement_timeout='30s';
alter table public.class_watchdog_queue drop constraint class_watchdog_queue_status_check;
alter table public.class_watchdog_queue add constraint class_watchdog_queue_status_check
  check(status in ('pending','processing','sent','failed','cancelled'));
alter table public.class_watchdog_queue drop constraint class_watchdog_queue_planner_day_id_event_type_recipient_em_key;
alter table public.class_watchdog_queue add constraint class_watchdog_queue_section_end_recipient_key
  unique(section_id,scheduled_end_at,event_type,recipient_email);

-- Resolve closeout work by the actual Eastern class date, independently of a stale planner counter.
-- A reminder is eligible from 30 through 90 minutes after class end; expired work is cancelled.
create or replace function private.class_watchdog_candidates(p_now timestamptz)
returns table(school_id uuid,section_id uuid,planner_day_id uuid,scheduled_end_at timestamptz,started_by uuid)
language sql stable security invoker set search_path=''
as $function$
  with scheduled as (
    select s.school_id,s.id section_id,pd.id calendar_day_id,pd.planner_day_number,
      pd.scheduled_date,sp.current_planner_day_number,sp.manual_hold,
      ((pd.scheduled_date::timestamp+s.end_time) at time zone 'America/New_York') scheduled_end_at
    from public.sections s
    join public.section_progress sp on sp.section_id=s.id and sp.school_id=s.school_id
    join public.planner_days pd on pd.section_id=s.id and pd.school_id=s.school_id
    where s.status='active' and s.end_time is not null
      and pd.scheduled_date=(p_now at time zone 'America/New_York')::date
      and not exists(select 1 from public.section_calendar_exceptions x
        where x.section_id=s.id and x.exception_date=pd.scheduled_date and not x.counts_as_teaching_day)
  )
  select c.school_id,c.section_id,coalesce(active_day.planner_day_id,c.calendar_day_id),
    c.scheduled_end_at,active_day.instructor_id
  from scheduled c
  left join public.planner_day_delivery calendar_delivery on calendar_delivery.planner_day_id=c.calendar_day_id
  left join lateral (
    select d.planner_day_id,d.instructor_id
    from public.planner_day_delivery d
    where d.section_id=c.section_id and d.school_id=c.school_id
      and d.delivery_status in ('in_progress','started') and d.started_at is not null
      and coalesce(d.actual_date,(d.started_at at time zone 'America/New_York')::date)=c.scheduled_date
    order by d.started_at desc,d.id limit 1
  ) active_day on true
  where p_now>=c.scheduled_end_at+interval '30 minutes'
    and p_now<c.scheduled_end_at+interval '90 minutes'
    and (
      active_day.planner_day_id is not null
      or (
        not coalesce(c.manual_hold,false)
        and c.current_planner_day_number<=c.planner_day_number
        and coalesce(calendar_delivery.delivery_status,'planned') not in ('completed','skipped','rescheduled')
        and not exists(select 1 from public.planner_day_delivery done
          where done.section_id=c.section_id and done.school_id=c.school_id and done.delivery_status='completed'
            and coalesce(done.actual_date,(done.started_at at time zone 'America/New_York')::date)=c.scheduled_date)
      )
      or exists (
        select 1 from public.attendance_pairs ap
        left join public.attendance_sessions a on a.pair_id=ap.id and a.attendance_date=c.scheduled_date
        where ap.active and ap.school_id=c.school_id and ap.completion_section_id=c.section_id
          and (a.id is null or (a.session_type='instructional' and a.counts_toward_attendance and a.status<>'finalized'))
      )
    );
$function$;
revoke all on function private.class_watchdog_candidates(timestamptz) from public,anon,authenticated;
grant execute on function private.class_watchdog_candidates(timestamptz) to service_role;

CREATE OR REPLACE FUNCTION public.enqueue_class_watchdog_reminders(p_now timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_inserted integer := 0;
begin
  with candidates as (
    select * from private.class_watchdog_candidates(p_now)
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
  on conflict (section_id, scheduled_end_at, event_type, recipient_email) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$function$
;

create or replace function public.claim_due_class_watchdog_reminders(p_limit integer default 25)
returns table(queue_id uuid,school_id uuid,section_id uuid,planner_day_id uuid,event_type text,
  recipient_user_id uuid,recipient_email text,scheduled_end_at timestamptz,attempts integer)
language plpgsql security definer set search_path=''
as $function$
begin
  -- Recheck before claim: retries and a delayed worker must not send resolved or expired reminders.
  update public.class_watchdog_queue q
  set status='cancelled',last_error='Closeout resolved, class date changed, or 90-minute reminder window expired.',updated_at=now()
  where q.status in ('pending','failed')
    and not exists(select 1 from private.class_watchdog_candidates(now()) c
      where c.school_id=q.school_id and c.section_id=q.section_id
        and c.planner_day_id=q.planner_day_id and c.scheduled_end_at=q.scheduled_end_at);
  return query
  with due as (
    select q.id from public.class_watchdog_queue q
    where q.status in ('pending','failed') and q.attempts<5
      and exists(select 1 from private.class_watchdog_candidates(now()) c
        where c.school_id=q.school_id and c.section_id=q.section_id
          and c.planner_day_id=q.planner_day_id and c.scheduled_end_at=q.scheduled_end_at)
    order by q.created_at
    for update of q skip locked
    limit greatest(1,least(coalesce(p_limit,25),100))
  ),claimed as (
    update public.class_watchdog_queue q set status='processing',attempts=q.attempts+1,updated_at=now()
    from due where q.id=due.id returning q.*
  )
  select q.id,q.school_id,q.section_id,q.planner_day_id,q.event_type,q.recipient_user_id,
    q.recipient_email,q.scheduled_end_at,q.attempts from claimed q;
end;
$function$;
create or replace function public.class_watchdog_reminder_is_due(p_queue_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
  select exists (
    select 1 from public.class_watchdog_queue q
    join private.class_watchdog_candidates(now()) c
      on c.school_id=q.school_id and c.section_id=q.section_id
      and c.planner_day_id=q.planner_day_id and c.scheduled_end_at=q.scheduled_end_at
    where q.id=p_queue_id and q.status='processing'
  );
$function$;
revoke all on function public.enqueue_class_watchdog_reminders(timestamptz),
  public.claim_due_class_watchdog_reminders(integer),public.class_watchdog_reminder_is_due(uuid)
  from public,anon,authenticated;
grant execute on function public.enqueue_class_watchdog_reminders(timestamptz),
  public.claim_due_class_watchdog_reminders(integer),public.class_watchdog_reminder_is_due(uuid) to service_role;
