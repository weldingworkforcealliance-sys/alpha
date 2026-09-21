-- Fix PL/pgSQL output-column ambiguity in attendance_completion_requirement.
-- The RETURNS TABLE column named pair_id shadowed the attendance_sessions.pair_id
-- column when the query used an unqualified WHERE pair_id = ... predicate.

create or replace function public.attendance_completion_requirement(
  p_section_id uuid,
  p_attendance_date date default current_date
)
returns table(
  attendance_required boolean,
  pair_id uuid,
  session_id uuid,
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
    select false, null::uuid, null::uuid, true;
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

  return query
  select true, v_pair.id, v_session_id, coalesce(v_status = 'finalized', false);
end;
$function$;
