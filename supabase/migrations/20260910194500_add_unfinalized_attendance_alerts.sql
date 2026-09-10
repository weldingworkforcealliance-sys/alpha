-- LTG stabilization: surface attendance that has been started but not finalized.
--
-- Opening the attendance workspace creates a draft session, so only sessions with
-- at least one recorded initial status are considered actionable. Future-dated
-- drafts are excluded. Instructors see pairs they are actively assigned to;
-- instructional management and Platform Owners retain their broader oversight.

begin;

create or replace function public.get_unfinalized_attendance_alerts(
  p_as_of date default current_date
)
returns table(
  session_id uuid,
  pair_id uuid,
  pair_name text,
  attendance_date date,
  completion_section_id uuid,
  attendance_mode text,
  marked_count integer,
  student_count integer,
  is_overdue boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    ses.id,
    p.id,
    p.pair_name,
    ses.attendance_date,
    p.completion_section_id,
    p.attendance_mode,
    (
      select count(*)::integer
      from public.attendance_records ar
      where ar.session_id = ses.id
        and ar.initial_status is not null
    ) as marked_count,
    (
      select count(*)::integer
      from public.attendance_pair_enrollments e
      join public.attendance_students stu
        on stu.id = e.student_id
       and stu.active = true
      where e.pair_id = p.id
        and e.active = true
        and e.created_at::date <= ses.attendance_date
    ) as student_count,
    ses.attendance_date < p_as_of as is_overdue
  from public.attendance_sessions ses
  join public.attendance_pairs p on p.id = ses.pair_id
  where p.active = true
    and ses.status <> 'finalized'
    and ses.attendance_date <= p_as_of
    and exists (
      select 1
      from public.attendance_records ar
      where ar.session_id = ses.id
        and ar.initial_status is not null
    )
    and (
      public.is_platform_owner()
      or public.can_review_instruction(p.school_id)
      or exists (
        select 1
        from public.section_instructors si
        where si.instructor_id = auth.uid()
          and si.active = true
          and si.section_id in (p.primary_section_id, p.completion_section_id)
      )
    )
  order by
    (ses.attendance_date < p_as_of) desc,
    ses.attendance_date asc,
    p.pair_name asc;
end;
$$;

revoke all on function public.get_unfinalized_attendance_alerts(date)
  from public, anon;
grant execute on function public.get_unfinalized_attendance_alerts(date)
  to authenticated;

commit;
