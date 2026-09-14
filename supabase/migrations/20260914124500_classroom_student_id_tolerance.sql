-- LTG Live Classroom: make roster Student ID matching tolerant without weakening
-- class-roster identity controls.
--
-- Exact canonical IDs remain the first match path. If that fails, LTG accepts
-- common harmless formatting differences (spaces, dashes, punctuation) only
-- when they resolve to exactly one active student on the active PVHS pair.
-- Numeric IDs may also tolerate leading-zero differences when the normalized
-- value resolves uniquely. Stored submissions are canonicalized back to the
-- roster's external_student_id.

begin;

create or replace function public.resolve_classroom_submission_student_uuid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
  v_section_id uuid;
  v_pair_id uuid;
  v_match uuid;
  v_match_id text;
  v_candidate_count integer := 0;
  v_input_parts text[];
  v_input_compact text;
  v_input_digits text;
begin
  select cs.school_id, cs.section_id
    into v_school_id, v_section_id
  from public.classroom_sessions cs
  where cs.id = new.classroom_session_id;

  new.student_uuid := null;

  if v_school_id is null or nullif(btrim(new.student_id), '') is null then
    return new;
  end if;

  v_input_compact := nullif(
    regexp_replace(lower(btrim(new.student_id)), '[^a-z0-9]+', '', 'g'),
    ''
  );
  v_input_digits := nullif(
    regexp_replace(btrim(new.student_id), '[^0-9]+', '', 'g'),
    ''
  );

  select ap.id
    into v_pair_id
  from public.attendance_pairs ap
  where ap.school_id = v_school_id
    and ap.active = true
    and ap.attendance_mode = 'pvhs'
    and (ap.primary_section_id = v_section_id or ap.completion_section_id = v_section_id)
  order by ap.created_at desc
  limit 1;

  -- Non-PVHS fallback keeps the existing school-wide behavior, but tolerates
  -- harmless punctuation/spacing when there is one unique canonical match.
  if v_pair_id is null then
    select count(*)::integer,
           max(s.id::text)::uuid,
           max(btrim(s.external_student_id))
      into v_candidate_count, v_match, v_match_id
    from public.attendance_students s
    where s.school_id = v_school_id
      and s.active = true
      and nullif(btrim(s.external_student_id), '') is not null
      and btrim(s.external_student_id) = btrim(new.student_id);

    if v_candidate_count = 1 then
      new.student_uuid := v_match;
      new.student_id := v_match_id;
      return new;
    end if;

    if v_input_compact is not null then
      select count(*)::integer,
             max(s.id::text)::uuid,
             max(btrim(s.external_student_id))
        into v_candidate_count, v_match, v_match_id
      from public.attendance_students s
      where s.school_id = v_school_id
        and s.active = true
        and nullif(btrim(s.external_student_id), '') is not null
        and nullif(
              regexp_replace(lower(btrim(s.external_student_id)), '[^a-z0-9]+', '', 'g'),
              ''
            ) = v_input_compact;

      if v_candidate_count = 1 then
        new.student_uuid := v_match;
        new.student_id := v_match_id;
        return new;
      end if;
    end if;

    return new;
  end if;

  -- 1. Exact canonical Student ID match on the active class pair.
  select count(*)::integer,
         max(s.id::text)::uuid,
         max(btrim(s.external_student_id))
    into v_candidate_count, v_match, v_match_id
  from public.attendance_pair_enrollments e
  join public.attendance_students s on s.id = e.student_id
  where e.pair_id = v_pair_id
    and e.active = true
    and s.active = true
    and nullif(btrim(s.external_student_id), '') is not null
    and btrim(s.external_student_id) = btrim(new.student_id);

  if v_candidate_count = 1 then
    new.student_uuid := v_match;
    new.student_id := v_match_id;
    return new;
  end if;

  -- 2. Ignore harmless separators/punctuation, but accept only one unique row.
  if v_input_compact is not null then
    select count(*)::integer,
           max(s.id::text)::uuid,
           max(btrim(s.external_student_id))
      into v_candidate_count, v_match, v_match_id
    from public.attendance_pair_enrollments e
    join public.attendance_students s on s.id = e.student_id
    where e.pair_id = v_pair_id
      and e.active = true
      and s.active = true
      and nullif(btrim(s.external_student_id), '') is not null
      and nullif(
            regexp_replace(lower(btrim(s.external_student_id)), '[^a-z0-9]+', '', 'g'),
            ''
          ) = v_input_compact;

    if v_candidate_count = 1 then
      new.student_uuid := v_match;
      new.student_id := v_match_id;
      return new;
    end if;
  end if;

  -- 3. For purely numeric IDs only, tolerate leading-zero differences when the
  -- normalized value is unique inside this class pair.
  if v_input_digits is not null
     and v_input_compact = v_input_digits then
    select count(*)::integer,
           max(s.id::text)::uuid,
           max(btrim(s.external_student_id))
      into v_candidate_count, v_match, v_match_id
    from public.attendance_pair_enrollments e
    join public.attendance_students s on s.id = e.student_id
    where e.pair_id = v_pair_id
      and e.active = true
      and s.active = true
      and nullif(btrim(s.external_student_id), '') is not null
      and nullif(
            regexp_replace(lower(btrim(s.external_student_id)), '[^a-z0-9]+', '', 'g'),
            ''
          ) ~ '^[0-9]+$'
      and coalesce(
            nullif(
              ltrim(regexp_replace(btrim(s.external_student_id), '[^0-9]+', '', 'g'), '0'),
              ''
            ),
            '0'
          ) = coalesce(nullif(ltrim(v_input_digits, '0'), ''), '0');

    if v_candidate_count = 1 then
      new.student_uuid := v_match;
      new.student_id := v_match_id;
      return new;
    end if;
  end if;

  -- 4. Legacy roster rows with no canonical ID may still resolve by a unique
  -- first/last-name match. Accept either First Last or Last, First ordering.
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
        and (
          (
            parts[1] = v_input_parts[1]
            and parts[array_length(parts, 1)] = v_input_parts[array_length(v_input_parts, 1)]
          )
          or
          (
            parts[1] = v_input_parts[array_length(v_input_parts, 1)]
            and parts[array_length(parts, 1)] = v_input_parts[1]
          )
        )
    )
    select count(*)::integer, max(id::text)::uuid
      into v_candidate_count, v_match
    from matched;

    if v_candidate_count = 1 then
      new.student_uuid := v_match;
      return new;
    end if;
  end if;

  raise exception 'Student ID not recognized for this class. Re-enter the Student ID shown in LTG or ask your instructor.';
end;
$$;

commit;
