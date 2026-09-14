-- LTG student identity hardening beyond Live Classroom.
--
-- Live Job Cards now use the same roster-aware Student ID tolerance as Live
-- Classroom: exact match first, harmless punctuation/separator tolerance,
-- numeric leading-zero tolerance only when unique, and canonical student_uuid
-- linking. Paired classes reject unknown IDs; unpaired classes remain usable
-- for programs that have not configured attendance rosters yet.
--
-- Historical learning rows are backfilled only when one unique active roster
-- identity matches the submitted ID after separator normalization. No name-based
-- guessing is used for historical work.

begin;

create or replace function public.resolve_job_card_submission_student_uuid()
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
  select js.school_id, js.section_id
    into v_school_id, v_section_id
  from public.job_card_sessions js
  where js.id = new.job_card_session_id;

  if v_school_id is null then
    v_school_id := new.school_id;
  end if;

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

  -- If this section participates in an active attendance pair, identity is
  -- class-roster scoped. Prefer PVHS when an accidental overlap exists.
  select ap.id
    into v_pair_id
  from public.attendance_pairs ap
  where ap.school_id = v_school_id
    and ap.active = true
    and (ap.primary_section_id = v_section_id or ap.completion_section_id = v_section_id)
  order by (ap.attendance_mode = 'pvhs') desc, ap.created_at desc
  limit 1;

  if v_pair_id is not null then
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

    if v_candidate_count <> 1 and v_input_compact is not null then
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
    end if;

    if v_candidate_count <> 1
       and v_input_digits is not null
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
    end if;

    -- Transitional safety for legacy roster rows that still lack a canonical
    -- ID. Use name matching only when exactly one ID-less roster row matches.
    if v_candidate_count <> 1 then
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

        v_match_id := null;
      end if;
    end if;

    if v_candidate_count = 1 and v_match is not null then
      new.student_uuid := v_match;
      if v_match_id is not null then
        new.student_id := v_match_id;
      end if;

      if exists (
        select 1
        from public.job_card_submissions sub
        where sub.job_card_session_id = new.job_card_session_id
          and sub.student_uuid = v_match
          and sub.id is distinct from new.id
      ) then
        raise exception 'A Job Card has already been submitted for this Student ID';
      end if;

      return new;
    end if;

    raise exception 'Student ID not recognized for this class. Re-enter the Student ID shown in LTG or ask your instructor.';
  end if;

  -- Unpaired programs may not use LTG attendance rosters. Resolve to a unique
  -- school identity when possible, but do not block the workflow when no roster
  -- identity exists.
  select count(*)::integer,
         max(s.id::text)::uuid,
         max(btrim(s.external_student_id))
    into v_candidate_count, v_match, v_match_id
  from public.attendance_students s
  where s.school_id = v_school_id
    and s.active = true
    and nullif(btrim(s.external_student_id), '') is not null
    and btrim(s.external_student_id) = btrim(new.student_id);

  if v_candidate_count <> 1 and v_input_compact is not null then
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
  end if;

  if v_candidate_count <> 1
     and v_input_digits is not null
     and v_input_compact = v_input_digits then
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
          ) ~ '^[0-9]+$'
      and coalesce(
            nullif(
              ltrim(regexp_replace(btrim(s.external_student_id), '[^0-9]+', '', 'g'), '0'),
              ''
            ),
            '0'
          ) = coalesce(nullif(ltrim(v_input_digits, '0'), ''), '0');
  end if;

  if v_candidate_count = 1 and v_match is not null then
    new.student_uuid := v_match;
    new.student_id := v_match_id;

    if exists (
      select 1
      from public.job_card_submissions sub
      where sub.job_card_session_id = new.job_card_session_id
        and sub.student_uuid = v_match
        and sub.id is distinct from new.id
    ) then
      raise exception 'A Job Card has already been submitted for this Student ID';
    end if;

    return new;
  end if;

  -- Even without a canonical roster identity, formatting variants of the same
  -- raw ID must not create duplicate submissions within one Job Card session.
  if v_input_compact is not null and exists (
    select 1
    from public.job_card_submissions sub
    where sub.job_card_session_id = new.job_card_session_id
      and sub.id is distinct from new.id
      and nullif(
            regexp_replace(lower(btrim(sub.student_id)), '[^a-z0-9]+', '', 'g'),
            ''
          ) = v_input_compact
  ) then
    raise exception 'A Job Card has already been submitted for this Student ID';
  end if;

  if v_input_digits is not null
     and v_input_compact = v_input_digits
     and exists (
       select 1
       from public.job_card_submissions sub
       where sub.job_card_session_id = new.job_card_session_id
         and sub.id is distinct from new.id
         and nullif(
               regexp_replace(lower(btrim(sub.student_id)), '[^a-z0-9]+', '', 'g'),
               ''
             ) ~ '^[0-9]+$'
         and coalesce(
               nullif(ltrim(regexp_replace(btrim(sub.student_id), '[^0-9]+', '', 'g'), '0'), ''),
               '0'
             ) = coalesce(nullif(ltrim(v_input_digits, '0'), ''), '0')
     ) then
    raise exception 'A Job Card has already been submitted for this Student ID';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_resolve_job_card_submission_student_uuid
  on public.job_card_submissions;

create trigger trg_resolve_job_card_submission_student_uuid
before insert or update of student_id, school_id, job_card_session_id
on public.job_card_submissions
for each row
execute function public.resolve_job_card_submission_student_uuid();

-- Link historical Live Classroom work only when the submitted ID resolves to
-- one unique active canonical student in the same school after harmless
-- separator normalization. This safely catches newly completed roster IDs such
-- as a previously ID-less student without guessing from the name.
with candidate_matches as (
  select
    sub.id as submission_id,
    count(*)::integer as match_count,
    max(s.id::text)::uuid as student_uuid
  from public.classroom_submissions sub
  join public.classroom_sessions cs on cs.id = sub.classroom_session_id
  join public.attendance_students s
    on s.school_id = cs.school_id
   and s.active = true
   and nullif(btrim(s.external_student_id), '') is not null
   and nullif(
         regexp_replace(lower(btrim(s.external_student_id)), '[^a-z0-9]+', '', 'g'),
         ''
       ) = nullif(
         regexp_replace(lower(btrim(sub.student_id)), '[^a-z0-9]+', '', 'g'),
         ''
       )
  where sub.student_uuid is null
  group by sub.id
)
update public.classroom_submissions sub
set student_uuid = cm.student_uuid
from candidate_matches cm
where sub.id = cm.submission_id
  and cm.match_count = 1;

-- Same conservative backfill for any historical Job Card rows.
with candidate_matches as (
  select
    sub.id as submission_id,
    count(*)::integer as match_count,
    max(s.id::text)::uuid as student_uuid
  from public.job_card_submissions sub
  join public.attendance_students s
    on s.school_id = sub.school_id
   and s.active = true
   and nullif(btrim(s.external_student_id), '') is not null
   and nullif(
         regexp_replace(lower(btrim(s.external_student_id)), '[^a-z0-9]+', '', 'g'),
         ''
       ) = nullif(
         regexp_replace(lower(btrim(sub.student_id)), '[^a-z0-9]+', '', 'g'),
         ''
       )
  where sub.student_uuid is null
  group by sub.id
)
update public.job_card_submissions sub
set student_uuid = cm.student_uuid
from candidate_matches cm
where sub.id = cm.submission_id
  and cm.match_count = 1;

commit;
