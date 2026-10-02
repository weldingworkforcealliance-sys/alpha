-- Initial attendance belongs to the primary course (105/205); completion
-- attendance belongs to the completion course (110/210). Keep the existing
-- pair/date session and saved records, including orientation and reporting rules.
begin;

create or replace function private.check_attendance_session_scope(
  p_session_id uuid, p_section_id uuid, p_attendance_date date
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.attendance_sessions%rowtype;
  v_pair public.attendance_pairs%rowtype;
begin
  select * into v_session from public.attendance_sessions
  where id = p_session_id for update;
  if v_session.id is null then raise exception 'Attendance session not found'; end if;
  select * into v_pair from public.attendance_pairs where id = v_session.pair_id;
  if p_section_id is null or p_attendance_date is null
     or p_attendance_date is distinct from v_session.attendance_date
     or p_section_id not in (v_pair.primary_section_id, v_pair.completion_section_id)
     or v_pair.id is null or not v_pair.active then
    raise exception 'Attendance class or date changed. Reopen attendance before saving.';
  end if;
  if not private.attendance_can_manage_pair(v_pair.id, auth.uid()) then
    raise exception 'Assigned instructor, active coverage, or school management access required';
  end if;
  return p_section_id = v_pair.completion_section_id;
end;
$$;
revoke all on function private.check_attendance_session_scope(uuid,uuid,date)
  from public, anon, authenticated;

create or replace function public.set_section_attendance_record(
  p_session_id uuid, p_section_id uuid, p_attendance_date date,
  p_student_id uuid, p_initial_status text default null,
  p_final_status text default null, p_completion_flags text[] default '{}',
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_completion boolean;
  v_record public.attendance_records%rowtype;
begin
  v_completion := private.check_attendance_session_scope(p_session_id,p_section_id,p_attendance_date);
  select * into v_record from public.attendance_records
  where session_id = p_session_id and student_id = p_student_id;
  if v_record.id is null then raise exception 'Attendance record not found'; end if;
  if v_completion then
    if v_record.initial_status is null then
      raise exception 'Save attendance in the primary course before completing the paired course';
    end if;
    -- Never accept a completion screen's copy of initial_status. It may be stale.
    perform public.set_attendance_record(p_session_id,p_student_id,
      v_record.initial_status,p_final_status,p_completion_flags,p_notes);
  else
    -- Conversely a primary-course save cannot erase saved completion notes/status.
    perform public.set_attendance_record(p_session_id,p_student_id,
      p_initial_status,v_record.final_status,v_record.completion_flags,v_record.notes);
  end if;
end;
$$;

create or replace function public.mark_all_section_attendance(
  p_session_id uuid, p_section_id uuid, p_attendance_date date,
  p_status text default 'present'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.check_attendance_session_scope(p_session_id,p_section_id,p_attendance_date) then
    raise exception 'Initial attendance must be saved in the primary course';
  end if;
  return public.mark_all_attendance(p_session_id,p_status);
end;
$$;

create or replace function public.reset_section_attendance(
  p_session_id uuid, p_section_id uuid, p_attendance_date date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.check_attendance_session_scope(p_session_id,p_section_id,p_attendance_date) then
    raise exception 'Initial attendance can only be reset in the primary course';
  end if;
  return public.reset_attendance_session(p_session_id);
end;
$$;

create or replace function public.finalize_section_attendance(
  p_session_id uuid, p_section_id uuid, p_attendance_date date,
  p_general_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.check_attendance_session_scope(p_session_id,p_section_id,p_attendance_date) then
    raise exception 'Attendance is finalized at the end of the configured completion course';
  end if;
  perform public.finalize_attendance_session(p_session_id,p_section_id,p_general_notes);
end;
$$;

-- Old browser tabs must refresh instead of bypassing class/date validation.
-- Internal callers and the audited manager-correction workflow are preserved.
revoke execute on function public.set_attendance_record(uuid,uuid,text,text,text[],text) from public,anon,authenticated;
revoke execute on function public.mark_all_attendance(uuid,text) from public,anon,authenticated;
revoke execute on function public.reset_attendance_session(uuid) from public,anon,authenticated;
revoke execute on function public.finalize_attendance_session(uuid,uuid,text) from public,anon,authenticated;

revoke all on function public.set_section_attendance_record(uuid,uuid,date,uuid,text,text,text[],text) from public,anon;
revoke all on function public.mark_all_section_attendance(uuid,uuid,date,text) from public,anon;
revoke all on function public.reset_section_attendance(uuid,uuid,date) from public,anon;
revoke all on function public.finalize_section_attendance(uuid,uuid,date,text) from public,anon;
grant execute on function public.set_section_attendance_record(uuid,uuid,date,uuid,text,text,text[],text) to authenticated,service_role;
grant execute on function public.mark_all_section_attendance(uuid,uuid,date,text) to authenticated,service_role;
grant execute on function public.reset_section_attendance(uuid,uuid,date) to authenticated,service_role;
grant execute on function public.finalize_section_attendance(uuid,uuid,date,text) to authenticated,service_role;

commit;
