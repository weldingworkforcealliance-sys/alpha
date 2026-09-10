-- LTG stabilization: Live Job Card launch is a section-scoped instructor action.
-- A school-wide instructor membership alone must not authorize a user to launch
-- a Job Card for every section at that school.

begin;

create or replace function public.start_job_card_session(
  p_section_id uuid,
  p_guide_day_id uuid default null,
  p_planner_day_number integer default null,
  p_expected_students integer default 17,
  p_job_title text default null,
  p_drawing_ref text default null,
  p_drawing_revision text default null,
  p_wps_swps_ref text default null,
  p_process text default null,
  p_position text default null,
  p_material_joint text default null,
  p_requirements jsonb default '[]'::jsonb
)
returns public.job_card_sessions
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  v_section public.sections%rowtype;
  v_session public.job_card_sessions%rowtype;
  v_requirement jsonb;
  v_key text;
  v_seen_keys text[] := '{}'::text[];
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_section
  from public.sections
  where id = p_section_id;
  if not found then raise exception 'Class section not found'; end if;

  -- Platform Owner and school instructional management may launch across the
  -- school. Ordinary instructors/assistants must be actively assigned to the
  -- target section (or be the instructor who has already started that section).
  if not (
    public.is_platform_owner()
    or public.can_review_instruction(v_section.school_id)
    or public.is_section_instructor(v_section.school_id, p_section_id)
  ) then
    raise exception 'Assigned instructor or school management access required';
  end if;

  if p_expected_students is null or p_expected_students < 1 or p_expected_students > 17 then
    raise exception 'Expected students must be between 1 and 17';
  end if;

  if p_job_title is null or char_length(btrim(p_job_title)) = 0 then
    raise exception 'Job / planner-day title is required';
  end if;

  if jsonb_typeof(p_requirements) <> 'array'
     or jsonb_array_length(p_requirements) < 1
     or jsonb_array_length(p_requirements) > 4 then
    raise exception 'Provide between 1 and 4 critical job requirements';
  end if;

  for v_requirement in select value from jsonb_array_elements(p_requirements)
  loop
    v_key := btrim(coalesce(v_requirement->>'key',''));
    if v_key = ''
       or btrim(coalesce(v_requirement->>'label','')) = ''
       or btrim(coalesce(v_requirement->>'requiredValue','')) = '' then
      raise exception 'Every job requirement needs a key, label, and required value';
    end if;
    if v_key = any(v_seen_keys) then
      raise exception 'Job requirement keys must be unique';
    end if;
    v_seen_keys := array_append(v_seen_keys, v_key);
  end loop;

  perform public.expire_job_card_sessions();
  if exists (
    select 1
    from public.job_card_sessions
    where section_id = p_section_id
      and status = 'active'
      and expires_at > clock_timestamp()
  ) then
    raise exception 'This class already has an active Live Job Card session';
  end if;

  insert into public.job_card_sessions(
    school_id, section_id, guide_day_id, planner_day_number, instructor_id,
    join_code, expected_students, job_title, drawing_ref, drawing_revision,
    wps_swps_ref, process, position, material_joint, requirements, expires_at
  ) values (
    v_section.school_id, p_section_id, p_guide_day_id, p_planner_day_number, v_uid,
    private.job_card_generate_code(), p_expected_students, btrim(p_job_title),
    nullif(btrim(p_drawing_ref),''), nullif(btrim(p_drawing_revision),''),
    nullif(btrim(p_wps_swps_ref),''), nullif(btrim(p_process),''),
    nullif(btrim(p_position),''), nullif(btrim(p_material_joint),''),
    p_requirements, clock_timestamp() + interval '12 hours'
  )
  returning * into v_session;

  return v_session;
end;
$$;

revoke all on function public.start_job_card_session(
  uuid, uuid, integer, integer, text, text, text, text, text, text, text, jsonb
) from public, anon;
grant execute on function public.start_job_card_session(
  uuid, uuid, integer, integer, text, text, text, text, text, text, text, jsonb
) to authenticated, service_role;

commit;
