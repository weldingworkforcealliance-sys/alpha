-- LTG Live Classroom: validate the submitted student identity before students
-- spend time answering questions. Does not alter the existing submission
-- trigger or the gradebook, and does not reveal student names, IDs, or rosters.
--
-- This anonymous, join-code-bound RPC returns only a boolean. The join code
-- must belong to an active, unexpired classroom session. The existing
-- submit_classroom_assessment_v2 and resolve_classroom_submission_student_uuid
-- remain the authoritative final submission checks.
create or replace function public.validate_classroom_student_identity(
  p_join_code text,
  p_student_name text,
  p_student_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_session_id uuid;
  v_school_id uuid;
  v_section_id uuid;
  v_pair_id uuid;
  v_candidate_count integer := 0;
  v_match uuid;
  v_compact text;
  v_digits text;
  v_input_parts text[];
begin
  -- Generic false responses avoid revealing whether a class or ID exists.
  if p_join_code is null
     or char_length(btrim(p_join_code)) not between 4 and 32
     or p_student_name is null
     or char_length(btrim(p_student_name)) not between 2 and 120
     or p_student_id is null
     or char_length(btrim(p_student_id)) not between 1 and 80
  then
    return false;
  end if;

  select cs.id, cs.school_id, cs.section_id
    into v_session_id, v_school_id, v_section_id
  from public.classroom_sessions cs
  where cs.join_code = upper(btrim(p_join_code))
    and cs.status = 'active'
    and cs.expires_at > clock_timestamp();

  if v_session_id is null then
    return false;
  end if;

  -- Do not let a previously submitted student start a second attempt.
  if exists (
    select 1 from public.classroom_submissions sub
    where sub.classroom_session_id = v_session_id
      and lower(btrim(sub.student_id)) = lower(btrim(p_student_id))
  ) then
    return false;
  end if;

  select ap.id into v_pair_id
  from public.attendance_pairs ap
  where ap.school_id = v_school_id
    and ap.active = true
    and (ap.primary_section_id = v_section_id or ap.completion_section_id = v_section_id)
  order by (ap.attendance_mode = 'pvhs') desc, ap.created_at desc
  limit 1;

  -- For sections without an attendance pair, preserve the legacy submission
  -- contract: the final submission RPC handles its own identity checks.
  if v_pair_id is null then
    return true;
  end if;

  v_compact := nullif(regexp_replace(lower(btrim(p_student_id)), '[^a-z0-9]+', '', 'g'), '');
  v_digits := nullif(regexp_replace(btrim(p_student_id), '[^0-9]+', '', 'g'), '');

  select count(*)::integer, max(st.id::text)::uuid
    into v_candidate_count, v_match
  from public.attendance_pair_enrollments en
  join public.attendance_students st on st.id = en.student_id
  where en.pair_id = v_pair_id and en.active = true and st.active = true
    and nullif(btrim(st.external_student_id), '') is not null
    and btrim(st.external_student_id) = btrim(p_student_id);

  if v_candidate_count <> 1 and v_compact is not null then
    select count(*)::integer, max(st.id::text)::uuid
      into v_candidate_count, v_match
    from public.attendance_pair_enrollments en
    join public.attendance_students st on st.id = en.student_id
    where en.pair_id = v_pair_id and en.active = true and st.active = true
      and nullif(btrim(st.external_student_id), '') is not null
      and nullif(regexp_replace(lower(btrim(st.external_student_id)), '[^a-z0-9]+', '', 'g'), '') = v_compact;
  end if;

  if v_candidate_count <> 1 and v_digits is not null and v_compact = v_digits then
    select count(*)::integer, max(st.id::text)::uuid
      into v_candidate_count, v_match
    from public.attendance_pair_enrollments en
    join public.attendance_students st on st.id = en.student_id
    where en.pair_id = v_pair_id and en.active = true and st.active = true
      and nullif(btrim(st.external_student_id), '') is not null
      and nullif(regexp_replace(lower(btrim(st.external_student_id)), '[^a-z0-9]+', '', 'g'), '') ~ '^[0-9]+$'
      and coalesce(nullif(ltrim(regexp_replace(btrim(st.external_student_id), '[^0-9]+', '', 'g'), '0'), ''), '0')
          = coalesce(nullif(ltrim(v_digits, '0'), ''), '0');
  end if;

  -- Match the existing submission trigger's legacy fallback only for roster
  -- members without an external Student ID, and only with unique full names.
  if v_candidate_count <> 1 then
    v_input_parts := regexp_split_to_array(
      btrim(lower(regexp_replace(coalesce(p_student_name, ''), '[^a-z0-9]+', ' ', 'g'))),
      '[[:space:]]+'
    );
    if coalesce(array_length(v_input_parts, 1), 0) >= 2 then
      with candidates as (
        select st.id,
          regexp_split_to_array(
            btrim(lower(regexp_replace(coalesce(st.display_name, ''), '[^a-z0-9]+', ' ', 'g'))),
            '[[:space:]]+'
          ) as parts
        from public.attendance_pair_enrollments en
        join public.attendance_students st on st.id = en.student_id
        where en.pair_id = v_pair_id and en.active = true and st.active = true
          and nullif(btrim(st.external_student_id), '') is null
      ), matched as (
        select id from candidates
        where coalesce(array_length(parts, 1), 0) >= 2
          and (
            (parts[1] = v_input_parts[1] and
             parts[array_length(parts, 1)] = v_input_parts[array_length(v_input_parts, 1)])
            or
            (parts[1] = v_input_parts[array_length(v_input_parts, 1)] and
             parts[array_length(parts, 1)] = v_input_parts[1])
          )
      )
      select count(*)::integer, max(id::text)::uuid
        into v_candidate_count, v_match
      from matched;
    end if;
  end if;

  if v_candidate_count <> 1 or v_match is null then
    return false;
  end if;

  if exists (
    select 1 from public.classroom_submissions sub
    where sub.classroom_session_id = v_session_id and sub.student_uuid = v_match
  ) then
    return false;
  end if;

  return true;
end;
$function$;

revoke all on function public.validate_classroom_student_identity(text, text, text)
  from public, anon, authenticated;
grant execute on function public.validate_classroom_student_identity(text, text, text)
  to anon, authenticated;

comment on function public.validate_classroom_student_identity(text, text, text)
  is 'Join-code scoped boolean identity preflight for LTG public classroom; no roster, scores or PII returned.';
