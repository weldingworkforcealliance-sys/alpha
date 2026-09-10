-- Keep open/finalized attendance tied to the roster that existed by the attendance date.
-- Students enrolled later must not block an older attendance session from finalizing.

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
set search_path to ''
as $function$
declare
  v_pair public.attendance_pairs%rowtype;
  v_session_id uuid;
  v_status text;
  v_calendar_start date;
  v_calendar_end date;
begin
  select * into v_pair
  from public.attendance_pairs
  where active=true
    and (primary_section_id=p_section_id or completion_section_id=p_section_id)
  order by created_at limit 1;

  if v_pair.id is null then
    raise exception 'No attendance pair is configured for this section';
  end if;

  if not (public.is_platform_owner() or public.is_school_instructional_staff(v_pair.school_id)) then
    raise exception 'Active instructional staff access required';
  end if;

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

  insert into public.attendance_sessions as ses
    (school_id,pair_id,attendance_date,attendance_mode,status,taken_at,taken_by,report_recipient)
  values
    (v_pair.school_id,v_pair.id,p_attendance_date,v_pair.attendance_mode,'draft',now(),auth.uid(),v_pair.report_email)
  on conflict on constraint attendance_sessions_pair_id_attendance_date_key
  do update set updated_at=now()
  returning ses.id,ses.status into v_session_id,v_status;

  if v_status<>'finalized' then
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

  return query select v_session_id,v_pair.id,v_pair.pair_name,v_pair.attendance_mode,
    p_section_id=v_pair.completion_section_id,v_status='finalized';
end;
$function$;

create or replace function public.finalize_attendance_session(
  p_session_id uuid,
  p_section_id uuid,
  p_general_notes text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_session public.attendance_sessions%rowtype;
  v_pair public.attendance_pairs%rowtype;
  v_missing integer;
  v_removed integer:=0;
begin
  select * into v_session from public.attendance_sessions where id=p_session_id for update;
  if v_session.id is null then raise exception 'Attendance session not found'; end if;
  select * into v_pair from public.attendance_pairs where id=v_session.pair_id;
  if v_pair.id is null then raise exception 'Attendance pair not found'; end if;
  if p_section_id<>v_pair.completion_section_id then raise exception 'Attendance is finalized at the end of the configured completion course'; end if;
  if not (public.is_platform_owner() or public.is_school_instructional_staff(v_session.school_id)) then raise exception 'Active instructional staff access required'; end if;
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
    insert into public.attendance_report_queue (school_id,session_id,recipient_email,run_after,status)
    values (v_session.school_id,p_session_id,v_pair.report_email,now()+make_interval(mins=>v_pair.report_delay_minutes),'pending')
    on conflict (session_id) do update
      set recipient_email=excluded.recipient_email,
          run_after=excluded.run_after,
          status=case when public.attendance_report_queue.status='sent' then 'sent' else 'pending' end,
          last_error=null;
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
      'report_queued',v_pair.attendance_mode='pvhs',
      'stale_roster_rows_removed',v_removed
    )
  );
end;
$function$;
