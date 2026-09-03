-- Keep Connected Classroom session state consistent with join-code validity.

update public.classroom_sessions
set status = 'ended',
    ended_at = coalesce(ended_at, expires_at)
where status = 'active'
  and expires_at <= now();

create or replace function public.expire_classroom_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer := 0;
begin
  if v_uid is null then
    raise exception 'Instructor login required';
  end if;

  if public.is_platform_owner() then
    update public.classroom_sessions
       set status = 'ended',
           ended_at = coalesce(ended_at, expires_at)
     where status = 'active'
       and expires_at <= now();
  else
    update public.classroom_sessions
       set status = 'ended',
           ended_at = coalesce(ended_at, expires_at)
     where instructor_id = v_uid
       and status = 'active'
       and expires_at <= now();
  end if;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_classroom_sessions() from public, anon;
grant execute on function public.expire_classroom_sessions() to authenticated;

create or replace function public.start_classroom_session_v2(
  p_section_id uuid,
  p_assessment_slug text default 'preclass_math'::text,
  p_expected_students integer default 17
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid;
  target_school uuid;
begin
  if auth.uid() is null then
    raise exception 'Instructor login required';
  end if;
  if p_expected_students < 1 or p_expected_students > 60 then
    raise exception 'Expected students must be between 1 and 60';
  end if;

  update public.classroom_sessions
     set status = 'ended',
         ended_at = coalesce(ended_at, expires_at)
   where instructor_id = auth.uid()
     and status = 'active'
     and expires_at <= now();

  select school_id into target_school
  from public.sections
  where id = p_section_id;

  if target_school is null then
    raise exception 'Class not found';
  end if;

  if not exists (
    select 1
    from public.assessment_modules
    where slug = p_assessment_slug
      and active
  ) then
    raise exception 'Assessment is not available';
  end if;

  if not exists (
    select 1
    from public.current_teaching_sections
    where section_id = p_section_id
  ) and not public.is_platform_owner() then
    raise exception 'You are not assigned to this class';
  end if;

  update public.classroom_sessions
     set status = 'ended',
         ended_at = now()
   where instructor_id = auth.uid()
     and section_id = p_section_id
     and status = 'active';

  insert into public.classroom_sessions(
    school_id,
    section_id,
    instructor_id,
    assessment_slug,
    join_code,
    expected_students
  )
  values(
    target_school,
    p_section_id,
    auth.uid(),
    p_assessment_slug,
    public.make_classroom_join_code(),
    p_expected_students
  )
  returning id into result_id;

  return result_id;
end;
$$;

revoke all on function public.start_classroom_session_v2(uuid,text,integer) from public, anon;
grant execute on function public.start_classroom_session_v2(uuid,text,integer) to authenticated;
