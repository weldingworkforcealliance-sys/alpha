-- Allow instructors to safely clear an open attendance session back to an unmarked state.
-- Finalized sessions and sessions with already-sent reports remain protected.

create or replace function public.reset_attendance_session(
  p_session_id uuid
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_session public.attendance_sessions%rowtype;
  v_count integer := 0;
begin
  select * into v_session
  from public.attendance_sessions
  where id = p_session_id
  for update;

  if v_session.id is null then
    raise exception 'Attendance session not found';
  end if;

  if not (public.is_platform_owner() or public.is_school_instructional_staff(v_session.school_id)) then
    raise exception 'Active instructional staff access required';
  end if;

  if v_session.status = 'finalized' then
    raise exception 'Finalized attendance cannot be reset from the instructor screen';
  end if;

  if exists (
    select 1
    from public.attendance_report_queue q
    where q.session_id = p_session_id
      and q.status = 'sent'
  ) then
    raise exception 'Attendance cannot be reset after a report has been sent';
  end if;

  update public.attendance_records
  set initial_status = null,
      final_status = null,
      completion_flags = '{}'::text[],
      completion_confirmed = false,
      notes = null,
      updated_by = auth.uid(),
      updated_at = now()
  where session_id = p_session_id;
  get diagnostics v_count = row_count;

  update public.attendance_sessions
  set instructor_notes = null,
      updated_at = now()
  where id = p_session_id;

  delete from public.attendance_report_queue
  where session_id = p_session_id
    and status in ('pending','failed');

  perform public.write_audit_event(
    v_session.school_id,
    'attendance_reset',
    'attendance_session',
    p_session_id,
    jsonb_build_object(
      'pair_id', v_session.pair_id,
      'attendance_date', v_session.attendance_date,
      'records_cleared', v_count,
      'status', 'draft'
    )
  );

  return v_count;
end;
$$;

revoke all on function public.reset_attendance_session(uuid) from public, anon;
grant execute on function public.reset_attendance_session(uuid) to authenticated;
