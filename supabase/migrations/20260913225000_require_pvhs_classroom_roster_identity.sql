-- PVHS Live Classroom results are longitudinal student records. Do not silently
-- accept a made-up Student ID and leave the grade detached from the roster.
-- Non-PVHS sessions keep the existing permissive behavior.

create or replace function public.resolve_classroom_submission_student_uuid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_school_id uuid;
  v_section_id uuid;
  v_pair_id uuid;
  v_match uuid;
  v_candidate_count integer := 0;
  v_input_parts text[];
begin
  select cs.school_id, cs.section_id
    into v_school_id, v_section_id
  from public.classroom_sessions cs
  where cs.id = new.classroom_session_id;

  new.student_uuid := null;

  if v_school_id is null or nullif(btrim(new.student_id), '') is null then
    return new;
  end if;

  select ap.id
    into v_pair_id
  from public.attendance_pairs ap
  where ap.school_id = v_school_id
    and ap.active = true
    and ap.attendance_mode = 'pvhs'
    and (ap.primary_section_id = v_section_id or ap.completion_section_id = v_section_id)
  order by ap.created_at desc
  limit 1;

  -- Generic / non-PVHS classroom sessions keep the previous exact-ID linker
  -- without turning the public classroom into a roster-enumeration endpoint.
  if v_pair_id is null then
    select s.id
      into new.student_uuid
    from public.attendance_students s
    where s.school_id = v_school_id
      and s.active = true
      and nullif(btrim(s.external_student_id), '') is not null
      and btrim(s.external_student_id) = btrim(new.student_id)
    limit 1;
    return new;
  end if;

  select s.id
    into v_match
  from public.attendance_pair_enrollments e
  join public.attendance_students s on s.id = e.student_id
  where e.pair_id = v_pair_id
    and e.active = true
    and s.active = true
    and nullif(btrim(s.external_student_id), '') is not null
    and btrim(s.external_student_id) = btrim(new.student_id)
  limit 1;

  if v_match is not null then
    new.student_uuid := v_match;
    return new;
  end if;

  -- Safe temporary fallback for an intentionally enrolled roster student whose
  -- official ID is not populated yet. Only a unique first+last match among
  -- missing-ID roster rows is accepted. A populated official ID is never bypassed.
  v_input_parts := regexp_split_to_array(
    btrim(lower(regexp_replace(coalesce(new.student_name, ''), '[^a-z0-9]+', ' ', 'g'))),
    '\s+'
  );

  if coalesce(array_length(v_input_parts, 1), 0) >= 2 then
    with candidates as (
      select s.id,
             regexp_split_to_array(
               btrim(lower(regexp_replace(coalesce(s.display_name, ''), '[^a-z0-9]+', ' ', 'g'))),
               '\s+'
             ) as parts
      from public.attendance_pair_enrollments e
      join public.attendance_students s on s.id = e.student_id
      where e.pair_id = v_pair_id
        and e.active = true
        and s.active = true
        and nullif(btrim(s.external_student_id), '') is null
    ), matched as (
      select id
      from candidates
      where coalesce(array_length(parts, 1), 0) >= 2
        and parts[1] = v_input_parts[1]
        and parts[array_length(parts, 1)] = v_input_parts[array_length(v_input_parts, 1)]
    )
    select count(*)::integer, max(id::text)::uuid
      into v_candidate_count, v_match
    from matched;

    if v_candidate_count = 1 then
      new.student_uuid := v_match;
      return new;
    end if;
  end if;

  raise exception 'Student ID not found on this class roster. Enter your official school Student ID exactly as issued, or ask your instructor before submitting.';
end;
$function$;
