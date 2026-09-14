alter table public.attendance_pairs
add column if not exists report_trigger text not null default 'finalization'
check (report_trigger in ('initial_complete','finalization'));

update public.attendance_pairs
set report_trigger = 'initial_complete',
    report_delay_minutes = 10,
    updated_at = now()
where pair_name in (
  'PVHS Level 1 B · WLD 105/110',
  'PVHS Level 1 C · WLD 105/110',
  'PVHS Level 2 A · WLD 205/210'
);

update public.attendance_pairs
set report_trigger = 'finalization',
    report_delay_minutes = 30,
    updated_at = now()
where pair_name = 'PCCC Night · WLD 105/110';

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

  if v_pair.attendance_mode <> 'pvhs' or v_pair.report_trigger <> 'initial_complete' then
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

revoke all on function private.queue_pvhs_attendance_report_if_ready(uuid) from public;
revoke all on function private.queue_pvhs_attendance_report_if_ready(uuid) from anon;
revoke all on function private.queue_pvhs_attendance_report_if_ready(uuid) from authenticated;

create or replace function public.finalize_attendance_session(
  p_session_id uuid,
  p_section_id uuid,
  p_general_notes text default null
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
      instructor_notes=nullif(btrim(coalesce(p_general_notes,'')),''),
      report_recipient=coalesce(report_recipient,v_pair.report_email)
  where id=p_session_id;

  if v_pair.attendance_mode='pvhs' then
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
  end if;

  perform public.write_audit_event(
    v_session.school_id,
    'attendance_finalized',
    'attendance_session',
    p_session_id,
    jsonb_build_object(
      'pair_id',v_pair.id,
      'attendance_date',v_session.attendance_date,
      'mode',v_pair.attendance_mode,
      'report_trigger',v_pair.report_trigger,
      'report_queued_now',v_report_queued,
      'stale_roster_rows_removed',v_removed
    )
  );
end;
$function$;
