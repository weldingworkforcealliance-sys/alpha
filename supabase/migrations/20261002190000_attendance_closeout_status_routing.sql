-- Tell the planner which half of a linked class needs attendance work.
-- This prevents completion-course links from trapping an instructor when
-- initial attendance was never entered in the primary course.
begin;

create or replace function public.attendance_closeout_status(
  p_section_id uuid,
  p_attendance_date date default current_date
)
returns table(
  attendance_required boolean,
  pair_id uuid,
  session_id uuid,
  finalized boolean,
  primary_section_id uuid,
  completion_section_id uuid,
  active_student_count integer,
  initial_marked_count integer,
  missing_initial_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pair public.attendance_pairs%rowtype;
  v_session_id uuid;
  v_status text;
  v_active integer := 0;
  v_marked integer := 0;
begin
  select ap.*
    into v_pair
  from public.attendance_pairs ap
  where ap.active = true
    and ap.completion_section_id = p_section_id
  order by ap.created_at
  limit 1;

  if v_pair.id is null then
    return query
    select false, null::uuid, null::uuid, true,
           null::uuid, null::uuid, 0, 0, 0;
    return;
  end if;

  if not private.attendance_can_manage_pair(v_pair.id, auth.uid()) then
    raise exception 'Assigned instructor, active coverage, or school management access required';
  end if;

  select ats.id, ats.status
    into v_session_id, v_status
  from public.attendance_sessions ats
  where ats.pair_id = v_pair.id
    and ats.attendance_date = p_attendance_date;

  select
    count(*)::integer,
    count(*) filter (where ar.initial_status is not null)::integer
    into v_active, v_marked
  from public.attendance_pair_enrollments e
  join public.attendance_students stu
    on stu.id = e.student_id
   and stu.active = true
  left join public.attendance_records ar
    on ar.session_id = v_session_id
   and ar.student_id = e.student_id
  where e.pair_id = v_pair.id
    and e.active = true
    and e.created_at::date <= p_attendance_date;

  return query
  select true,
         v_pair.id,
         v_session_id,
         coalesce(v_status = 'finalized', false),
         v_pair.primary_section_id,
         v_pair.completion_section_id,
         coalesce(v_active, 0),
         coalesce(v_marked, 0),
         greatest(coalesce(v_active, 0) - coalesce(v_marked, 0), 0);
end;
$$;

revoke all on function public.attendance_closeout_status(uuid,date)
  from public, anon;
grant execute on function public.attendance_closeout_status(uuid,date)
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
