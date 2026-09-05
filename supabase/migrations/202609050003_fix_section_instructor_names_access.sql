-- Align instructor-name visibility with current_teaching_sections.
-- Any active school member who can see a section may see its assigned instructor names.
-- Also harden the SECURITY DEFINER search path.

create or replace function public.get_section_instructor_names(p_section_id uuid)
returns table(instructor_id uuid, display_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
begin
  select s.school_id
    into v_school_id
  from public.sections s
  where s.id = p_section_id;

  if v_school_id is null then
    raise exception 'Section not found';
  end if;

  if not (
    public.is_platform_owner()
    or public.is_school_member(v_school_id)
  ) then
    raise exception 'Access denied';
  end if;

  return query
  select
    si.instructor_id,
    coalesce(nullif(btrim(pr.display_name), ''), pr.email, 'Assigned instructor')::text
  from public.section_instructors si
  left join public.profiles pr on pr.id = si.instructor_id
  where si.section_id = p_section_id
    and si.school_id = v_school_id
    and si.active = true
  order by coalesce(nullif(btrim(pr.display_name), ''), pr.email, 'Assigned instructor');
end;
$$;

revoke execute on function public.get_section_instructor_names(uuid) from public, anon;
grant execute on function public.get_section_instructor_names(uuid) to authenticated, service_role;
