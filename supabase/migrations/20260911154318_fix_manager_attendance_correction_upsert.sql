-- Follow-up fix for the historical attendance correction RPC.
-- The first migration used the base table name inside an INSERT ... ON CONFLICT
-- clause after aliasing the target as ar. PostgreSQL requires the target alias.

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
    from public.attendance_records ar_existing
    where ar_existing.session_id = p_session_id
      and ar_existing.student_id = p_student_id
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
      else ar.completion_confirmed
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
      select ar_new.id
      from public.attendance_records ar_new
      where ar_new.session_id = p_session_id
        and ar_new.student_id = p_student_id
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
end;
$$;

revoke all on function public.manager_correct_attendance_record(uuid, uuid, text, text, text[], text, text)
  from public, anon;
grant execute on function public.manager_correct_attendance_record(uuid, uuid, text, text, text[], text, text)
  to authenticated;
