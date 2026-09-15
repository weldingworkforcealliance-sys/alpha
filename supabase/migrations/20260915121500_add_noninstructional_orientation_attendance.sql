-- Allow attendance events such as orientation to use the normal attendance roster
-- without becoming official instructional attendance.

alter table public.attendance_sessions
  add column if not exists session_type text not null default 'instructional',
  add column if not exists counts_toward_attendance boolean not null default true;

do $constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.attendance_sessions'::regclass
      and conname = 'attendance_sessions_session_type_check'
  ) then
    alter table public.attendance_sessions
      add constraint attendance_sessions_session_type_check
      check (session_type in ('instructional','orientation'));
  end if;
end;
$constraint$;

create or replace function public.open_attendance_session(
  p_section_id uuid,
  p_attendance_date date default current_date
)
returns table(
  session_id uuid,
  pair_id uuid,
  pair_name text,
  attendance_mode text,
  is_completion_section boolean,
  finalized boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pair public.attendance_pairs%rowtype;
  v_session_id uuid;
  v_status text;
  v_session_type text;
  v_session_mode text;
  v_calendar_start date;
  v_calendar_end date;
begin
  select * into v_pair
  from public.attendance_pairs
  where active = true
    and (primary_section_id = p_section_id or completion_section_id = p_section_id)
  order by created_at
  limit 1;

  if v_pair.id is null then
    raise exception 'No attendance pair is configured for this section';
  end if;

  if not private.attendance_can_manage_pair(v_pair.id, auth.uid()) then
    raise exception 'Assigned instructor, active coverage, or school management access required';
  end if;

  select ses.id, ses.status, ses.session_type, ses.attendance_mode
    into v_session_id, v_status, v_session_type, v_session_mode
  from public.attendance_sessions ses
  where ses.pair_id = v_pair.id
    and ses.attendance_date = p_attendance_date;

  -- An existing orientation is allowed before the official section start date.
  -- Normal instructional attendance remains calendar-bound.
  if v_session_id is null or coalesce(v_session_type, 'instructional') = 'instructional' then
    select sc.start_date, sc.end_date
      into v_calendar_start, v_calendar_end
    from public.section_calendars sc
    where sc.section_id = p_section_id
    order by sc.created_at desc
    limit 1;

    if v_calendar_start is not null and p_attendance_date < v_calendar_start then
      raise exception 'Attendance cannot be opened before the class start date (%)', v_calendar_start;
    end if;

    if v_calendar_end is not null and p_attendance_date > v_calendar_end then
      raise exception 'Attendance cannot be opened after the class end date (%)', v_calendar_end;
    end if;
  end if;

  if v_session_id is null then
    insert into public.attendance_sessions as ses
      (school_id,pair_id,attendance_date,attendance_mode,status,taken_at,taken_by,
       report_recipient,session_type,counts_toward_attendance)
    values
      (v_pair.school_id,v_pair.id,p_attendance_date,v_pair.attendance_mode,'draft',now(),
       auth.uid(),v_pair.report_email,'instructional',true)
    on conflict on constraint attendance_sessions_pair_id_attendance_date_key
    do update set updated_at = now()
    returning ses.id,ses.status,ses.session_type,ses.attendance_mode
      into v_session_id,v_status,v_session_type,v_session_mode;
  end if;

  if v_status <> 'finalized' then
    insert into public.attendance_records (school_id,session_id,student_id)
    select e.school_id,v_session_id,e.student_id
    from public.attendance_pair_enrollments e
    join public.attendance_students stu on stu.id=e.student_id
    where e.pair_id=v_pair.id
      and e.active=true
      and stu.active=true
      and e.created_at::date <= p_attendance_date
    on conflict on constraint attendance_records_session_id_student_id_key do nothing;

    update public.attendance_records ar
    set completion_confirmed=false
    where ar.session_id=v_session_id
      and ar.initial_status is null
      and not exists (
        select 1
        from public.attendance_pair_enrollments e
        join public.attendance_students stu on stu.id=e.student_id
        where e.pair_id=v_pair.id
          and e.student_id=ar.student_id
          and e.active=true
          and stu.active=true
          and e.created_at::date <= p_attendance_date
      );
  end if;

  return query select
    v_session_id,
    v_pair.id,
    case when v_session_type = 'orientation'
      then v_pair.pair_name || ' · Orientation'
      else v_pair.pair_name
    end,
    coalesce(v_session_mode, v_pair.attendance_mode),
    p_section_id=v_pair.completion_section_id,
    v_status='finalized';
end;
$function$;

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

create or replace function public.finalize_attendance_session(
  p_session_id uuid,
  p_section_id uuid,
  p_general_notes text default null::text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_session public.attendance_sessions%rowtype;
  v_pair public.attendance_pairs%rowtype;
  v_missing integer;
  v_removed integer:=0;
  v_report_queued boolean:=false;
  v_inserted integer:=0;
begin
  select * into v_session
  from public.attendance_sessions
  where id=p_session_id
  for update;
  if v_session.id is null then raise exception 'Attendance session not found'; end if;

  select * into v_pair
  from public.attendance_pairs
  where id=v_session.pair_id;
  if v_pair.id is null then raise exception 'Attendance pair not found'; end if;

  if p_section_id<>v_pair.completion_section_id then
    raise exception 'Attendance is finalized at the end of the configured completion course';
  end if;
  if not private.attendance_can_manage_pair(v_pair.id, auth.uid()) then
    raise exception 'Assigned instructor, active coverage, or school management access required';
  end if;
  if v_session.status='finalized' then return; end if;

  select count(*) into v_missing
  from public.attendance_pair_enrollments e
  join public.attendance_students stu on stu.id=e.student_id and stu.active=true
  left join public.attendance_records ar on ar.session_id=p_session_id and ar.student_id=e.student_id
  where e.pair_id=v_pair.id
    and e.active=true
    and e.created_at::date <= v_session.attendance_date
    and (ar.id is null or ar.initial_status is null);

  if v_missing>0 then
    raise exception 'Attendance status is required for every student enrolled by the attendance date before finalizing';
  end if;

  delete from public.attendance_records ar
  where ar.session_id=p_session_id
    and ar.initial_status is null
    and not exists (
      select 1
      from public.attendance_pair_enrollments e
      join public.attendance_students stu on stu.id=e.student_id
      where e.pair_id=v_pair.id
        and e.student_id=ar.student_id
        and e.active=true
        and stu.active=true
        and e.created_at::date <= v_session.attendance_date
    );
  get diagnostics v_removed=row_count;

  update public.attendance_records ar
  set final_status=coalesce(ar.final_status,ar.initial_status),
      completion_confirmed=true,
      updated_by=auth.uid()
  where ar.session_id=p_session_id
    and ar.initial_status is not null;

  update public.attendance_sessions
  set status='finalized',
      finalized_at=now(),
      finalized_by=auth.uid(),
      instructor_notes=coalesce(
        nullif(btrim(coalesce(p_general_notes,'')),''),
        case when v_session.session_type='orientation'
          then 'Orientation attendance — non-instructional. Does not count toward course attendance.'
          else null
        end
      ),
      report_recipient=case
        when v_session.counts_toward_attendance and v_session.session_type='instructional'
          then coalesce(report_recipient,v_pair.report_email)
        else null
      end
  where id=p_session_id;

  if v_session.counts_toward_attendance
     and v_session.session_type='instructional'
     and v_session.attendance_mode='pvhs'
     and v_pair.attendance_mode='pvhs' then
    if nullif(btrim(coalesce(v_pair.report_email,'')),'') is null then
      raise exception 'PVHS report email is not configured';
    end if;

    if v_pair.report_trigger='initial_complete' then
      v_report_queued := private.queue_pvhs_attendance_report_if_ready(p_session_id);
    else
      insert into public.attendance_report_queue
        (school_id,session_id,recipient_email,run_after,status)
      values
        (v_session.school_id,p_session_id,v_pair.report_email,
         now()+make_interval(mins=>v_pair.report_delay_minutes),'pending')
      on conflict (session_id) do update
        set recipient_email=excluded.recipient_email,
            run_after=excluded.run_after,
            status=case when public.attendance_report_queue.status='sent' then 'sent' else 'pending' end,
            last_error=null;
      get diagnostics v_inserted=row_count;
      v_report_queued := v_inserted > 0;
    end if;
  else
    delete from public.attendance_report_queue
    where session_id=p_session_id
      and status in ('pending','failed');
  end if;

  perform public.write_audit_event(
    v_session.school_id,
    'attendance_finalized',
    'attendance_session',
    p_session_id,
    jsonb_build_object(
      'pair_id',v_pair.id,
      'attendance_date',v_session.attendance_date,
      'mode',v_session.attendance_mode,
      'session_type',v_session.session_type,
      'counts_toward_attendance',v_session.counts_toward_attendance,
      'report_trigger',v_pair.report_trigger,
      'report_queued_now',v_report_queued,
      'stale_roster_rows_removed',v_removed
    )
  );
end;
$function$;

-- Preserve whatever the current reporting implementation is, including later
-- instructional-day fixes, while excluding non-instructional attendance.
do $report_patch$
declare
  v_def text;
  v_original text;
begin
  select pg_get_functiondef('public.ltg_reporting_summary_internal(uuid,date,date)'::regprocedure)
    into v_def;

  if position('counts_toward_attendance' in v_def) = 0 then
    v_original := v_def;

    -- Session totals: patch the attendance-session query whose date predicate
    -- ends the statement. This works with both formatted and compact versions.
    v_def := regexp_replace(
      v_def,
      's\.attendance_date[[:space:]]+between[[:space:]]+p_start_date[[:space:]]+and[[:space:]]+p_end_date;',
      's.attendance_date between p_start_date and p_end_date and s.counts_toward_attendance=true;',
      'g'
    );

    -- Finalized-session references are used only for official attendance metrics
    -- in this reporting function. Add the exclusion to each occurrence.
    v_def := regexp_replace(
      v_def,
      's\.status[[:space:]]*=[[:space:]]*''finalized''',
      's.status=''finalized'' and s.counts_toward_attendance=true',
      'g'
    );

    if v_def = v_original or position('counts_toward_attendance' in v_def) = 0 then
      raise exception 'Could not patch LTG reporting function for non-instructional attendance';
    end if;

    execute v_def;
  end if;
end;
$report_patch$;
