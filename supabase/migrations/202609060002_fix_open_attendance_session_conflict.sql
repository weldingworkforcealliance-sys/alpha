create or replace function public.open_attendance_session(p_section_id uuid, p_attendance_date date default current_date)
returns table(session_id uuid, pair_id uuid, pair_name text, attendance_mode text, is_completion_section boolean, finalized boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pair public.attendance_pairs%rowtype;
  v_session_id uuid;
  v_status text;
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

  if not (public.is_platform_owner() or public.is_school_instructional_staff(v_pair.school_id)) then
    raise exception 'Active instructional staff access required';
  end if;

  insert into public.attendance_sessions as s
    (school_id, pair_id, attendance_date, attendance_mode, status, taken_at, taken_by, report_recipient)
  values
    (v_pair.school_id, v_pair.id, p_attendance_date, v_pair.attendance_mode, 'draft', now(), auth.uid(), v_pair.report_email)
  on conflict on constraint attendance_sessions_pair_id_attendance_date_key
  do update set updated_at = now()
  returning s.id, s.status into v_session_id, v_status;

  insert into public.attendance_records (school_id, session_id, student_id)
  select e.school_id, v_session_id, e.student_id
  from public.attendance_pair_enrollments e
  join public.attendance_students s on s.id = e.student_id
  where e.pair_id = v_pair.id
    and e.active = true
    and s.active = true
  on conflict (session_id, student_id) do nothing;

  return query
  select
    v_session_id,
    v_pair.id,
    v_pair.pair_name,
    v_pair.attendance_mode,
    p_section_id = v_pair.completion_section_id,
    v_status = 'finalized';
end;
$function$;
