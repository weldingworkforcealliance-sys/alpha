-- Revoking school membership must also revoke access through a running class.
-- Keep assigned-instructor and temporary coverage paths for active members.
create or replace function public.is_section_instructor(check_school_id uuid, check_section_id uuid)
returns boolean
language sql stable security definer
set search_path to ''
as $function$
  select public.is_school_member(check_school_id) and (
    exists (select 1 from public.section_instructors si
      where si.school_id=check_school_id and si.section_id=check_section_id
        and si.instructor_id=auth.uid() and si.active=true)
    or exists (select 1 from public.planner_day_delivery pdd
      where pdd.school_id=check_school_id and pdd.section_id=check_section_id
        and pdd.instructor_id=auth.uid() and pdd.delivery_status in ('in_progress','started'))
  );
$function$;
revoke all on function public.is_section_instructor(uuid,uuid) from public, anon;
grant execute on function public.is_section_instructor(uuid,uuid) to authenticated, service_role;
