-- Prevent attendance sessions from being created outside a section's configured class dates.
-- Sections without a configured calendar retain the existing behavior.

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
    where e.pair_id=v_pair.id and e.active=true and stu.active=true
    on conflict on constraint attendance_records_session_id_student_id_key do nothing;

    update public.attendance_records ar
    set completion_confirmed=false
    where ar.session_id=v_session_id
      and not exists (
        select 1 from public.attendance_pair_enrollments e
        join public.attendance_students stu on stu.id=e.student_id
        where e.pair_id=v_pair.id and e.student_id=ar.student_id
          and e.active=true and stu.active=true
      );
  end if;

  return query select v_session_id,v_pair.id,v_pair.pair_name,v_pair.attendance_mode,
    p_section_id=v_pair.completion_section_id,v_status='finalized';
end;
$function$;
