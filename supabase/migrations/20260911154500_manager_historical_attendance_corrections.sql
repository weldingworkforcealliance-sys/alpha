-- Allow Platform Owners and school-level managers to correct attendance on any
-- existing class date, including finalized historical sessions, without reopening
-- the instructor workflow or silently resending an already-delivered PVHS report.

begin;

create or replace function public.manager_create_attendance_session(
  p_pair_id uuid,
  p_attendance_date date
)
returns table(
  session_id uuid,
  session_status text,
  pair_name text,
  attendance_mode text,
  completion_section_id uuid,
  report_sent boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pair public.attendance_pairs%rowtype;
  v_session_id uuid;
  v_session_status text;
  v_calendar_start date;
  v_calendar_end date;
  v_created boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_pair
  from public.attendance_pairs
  where id = p_pair_id;

  if v_pair.id is null then
    raise exception 'Attendance pair not found';
  end if;

  if not public.can_manage_school(v_pair.school_id) then
    raise exception 'School administration or Platform Owner access required';
  end if;

  if p_attendance_date is null then
    raise exception 'Attendance date is required';
  end if;

  if p_attendance_date > current_date then
    raise exception 'Historical attendance cannot be created for a future date';
  end if;

  select sc.start_date, sc.end_date
    into v_calendar_start, v_calendar_end
  from public.section_calendars sc
  where sc.section_id in (v_pair.primary_section_id, v_pair.completion_section_id)
  order by case when sc.section_id = v_pair.completion_section_id then 0 else 1 end,
           sc.created_at desc
  limit 1;

  if v_calendar_start is not null and p_attendance_date < v_calendar_start then
    raise exception 'Attendance cannot be created before the class start date (%)', v_calendar_start;
  end if;

  if v_calendar_end is not null and p_attendance_date > v_calendar_end then
    raise exception 'Attendance cannot be created after the class end date (%)', v_calendar_end;
  end if;

  insert into public.attendance_sessions as ses
    (school_id, pair_id, attendance_date, attendance_mode, status, taken_at, taken_by, report_recipient)
  values
    (v_pair.school_id, v_pair.id, p_attendance_date, v_pair.attendance_mode, 'draft', now(), auth.uid(), v_pair.report_email)
  on conflict on constraint attendance_sessions_pair_id_attendance_date_key do nothing
  returning ses.id, ses.status into v_session_id, v_session_status;

  if v_session_id is not null then
    v_created := true;
  else
    select ses.id, ses.status
      into v_session_id, v_session_status
    from public.attendance_sessions ses
    where ses.pair_id = v_pair.id
      and ses.attendance_date = p_attendance_date;
  end if;

  if v_session_id is null then
    raise exception 'Attendance session could not be created';
  end if;

  if v_session_status <> 'finalized' then
    insert into public.attendance_records (school_id, session_id, student_id)
    select e.school_id, v_session_id, e.student_id
    from public.attendance_pair_enrollments e
    join public.attendance_students stu on stu.id = e.student_id
    where e.pair_id = v_pair.id
      and e.active = true
      and stu.active = true
    on conflict on constraint attendance_records_session_id_student_id_key do nothing;
  end if;

  if v_created then
    perform public.write_audit_event(
      v_pair.school_id,
      'attendance_manager_session_created',
      'attendance_session',
      v_session_id,
      jsonb_build_object(
        'pair_id', v_pair.id,
        'attendance_date', p_attendance_date,
        'mode', v_pair.attendance_mode,
        'created_by', auth.uid()
      )
    );
  end if;

  return query
  select
    v_session_id,
    v_session_status,
    v_pair.pair_name,
    v_pair.attendance_mode,
    v_pair.completion_section_id,
    exists (
      select 1
      from public.attendance_report_queue q
      where q.session_id = v_session_id
        and q.status = 'sent'
    );
end;
$$;

create or replace function public.manager_correct_attendance_record(
  p_session_id uuid,
  p_student_id uuid,
  p_initial_status text,
  p_final_status text default null,
  p_completion_flags text[] default '{}'::text[],
  p_notes text default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.attendance_sessions%rowtype;
  v_pair public.attendance_pairs%rowtype;
  v_old public.attendance_records%rowtype;
  v_effective_final text;
  v_report_sent boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_session
  from public.attendance_sessions
  where id = p_session_id
  for update;

  if v_session.id is null then
    raise exception 'Attendance session not found';
  end if;

  select * into v_pair
  from public.attendance_pairs
  where id = v_session.pair_id;

  if v_pair.id is null then
    raise exception 'Attendance pair not found';
  end if;

  if not public.can_manage_school(v_session.school_id) then
    raise exception 'School administration or Platform Owner access required';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A correction reason is required';
  end if;

  if char_length(btrim(p_reason)) < 3 then
    raise exception 'Correction reason must be at least 3 characters';
  end if;

  if p_initial_status is null or p_initial_status not in ('present','absent','late','excused') then
    raise exception 'A supported daily attendance status is required';
  end if;

  if p_final_status is not null and p_final_status not in ('present','absent','late','excused','left_early','partial') then
    raise exception 'Unsupported final attendance status';
  end if;

  if not coalesce(p_completion_flags, '{}'::text[]) <@ array['unprepared','left_early','disappeared','other']::text[] then
    raise exception 'Unsupported completion flag';
  end if;

  if not exists (
    select 1
    from public.attendance_pair_enrollments e
    where e.pair_id = v_pair.id
      and e.student_id = p_student_id
  ) and not exists (
    select 1
    from public.attendance_records ar
    where ar.session_id = p_session_id
      and ar.student_id = p_student_id
  ) then
    raise exception 'Student is not associated with this attendance pair';
  end if;

  select * into v_old
  from public.attendance_records
  where session_id = p_session_id
    and student_id = p_student_id;

  v_effective_final := case
    when v_session.status = 'finalized' then coalesce(p_final_status, p_initial_status)
    else p_final_status
  end;

  insert into public.attendance_records as ar
    (school_id, session_id, student_id, initial_status, final_status,
     completion_flags, completion_confirmed, notes, updated_by)
  values
    (v_session.school_id, p_session_id, p_student_id, p_initial_status,
     v_effective_final, coalesce(p_completion_flags, '{}'::text[]),
     v_session.status = 'finalized', nullif(btrim(coalesce(p_notes, '')), ''), auth.uid())
  on conflict on constraint attendance_records_session_id_student_id_key
  do update set
    initial_status = excluded.initial_status,
    final_status = excluded.final_status,
    completion_flags = excluded.completion_flags,
    completion_confirmed = case
      when v_session.status = 'finalized' then true
      else public.attendance_records.completion_confirmed
    end,
    notes = excluded.notes,
    updated_by = auth.uid(),
    updated_at = now();

  select exists (
    select 1
    from public.attendance_report_queue q
    where q.session_id = p_session_id
      and q.status = 'sent'
  ) into v_report_sent;

  perform public.write_audit_event(
    v_session.school_id,
    'attendance_record_corrected',
    'attendance_record',
    coalesce(v_old.id, (
      select ar.id
      from public.attendance_records ar
      where ar.session_id = p_session_id
        and ar.student_id = p_student_id
    )),
    jsonb_build_object(
      'session_id', p_session_id,
      'pair_id', v_pair.id,
      'attendance_date', v_session.attendance_date,
      'student_id', p_student_id,
      'reason', btrim(p_reason),
      'session_finalized', v_session.status = 'finalized',
      'report_already_sent', v_report_sent,
      'old', case when v_old.id is null then null else jsonb_build_object(
        'initial_status', v_old.initial_status,
        'final_status', v_old.final_status,
        'completion_flags', v_old.completion_flags,
        'notes', v_old.notes
      ) end,
      'new', jsonb_build_object(
        'initial_status', p_initial_status,
        'final_status', v_effective_final,
        'completion_flags', coalesce(p_completion_flags, '{}'::text[]),
        'notes', nullif(btrim(coalesce(p_notes, '')), '')
      )
    )
  );

  -- Intentionally do not alter a sent PVHS report queue row. The live LTG history
  -- is corrected immediately, while any corrected report resend remains an explicit
  -- administrative action rather than an automatic duplicate email.
end;
$$;

revoke all on function public.manager_create_attendance_session(uuid, date)
  from public, anon;
revoke all on function public.manager_correct_attendance_record(uuid, uuid, text, text, text[], text, text)
  from public, anon;

grant execute on function public.manager_create_attendance_session(uuid, date)
  to authenticated;
grant execute on function public.manager_correct_attendance_record(uuid, uuid, text, text, text[], text, text)
  to authenticated;

commit;
