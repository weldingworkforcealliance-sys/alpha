-- LTG stabilization: attendance student identity repair
--
-- The original bulk roster importer stored an entire pasted line in display_name
-- and never populated external_student_id. That prevented the Reporting &
-- Analytics canonical student link from connecting Live Classroom submissions
-- to the attendance roster. Preserve the existing visible roster label while
-- extracting a leading numeric student ID into the canonical ID column.

begin;

-- ---------------------------------------------------------------------------
-- 1. Backfill a canonical external_student_id from legacy roster lines.
--    When the same legacy student was accidentally duplicated during earlier
--    roster testing, prefer the row that still has an active pair enrollment.
--    Historical attendance rows are not deleted or reassigned.
-- ---------------------------------------------------------------------------

with candidates as (
  select
    s.id,
    s.school_id,
    substring(btrim(s.display_name) from '^([0-9]{3,})[[:space:]]+') as parsed_id,
    exists (
      select 1
      from public.attendance_pair_enrollments e
      where e.student_id = s.id
        and e.active
    ) as has_active_enrollment,
    (
      select count(*)
      from public.attendance_records r
      where r.student_id = s.id
    ) as attendance_record_count,
    s.active,
    s.created_at
  from public.attendance_students s
  where s.external_student_id is null
    and btrim(s.display_name) ~ '^[0-9]{3,}[[:space:]]+'
), ranked as (
  select
    c.*,
    row_number() over (
      partition by c.school_id, c.parsed_id
      order by
        c.has_active_enrollment desc,
        c.active desc,
        c.attendance_record_count desc,
        c.created_at asc,
        c.id
    ) as identity_rank
  from candidates c
  where c.parsed_id is not null
)
update public.attendance_students s
set external_student_id = r.parsed_id
from ranked r
where s.id = r.id
  and r.identity_rank = 1
  and not exists (
    select 1
    from public.attendance_students existing
    where existing.school_id = r.school_id
      and existing.external_student_id = r.parsed_id
      and existing.id <> r.id
  );

-- Legacy duplicate student rows that have no current pair enrollment should no
-- longer inflate the active-student population. Keep the rows themselves so
-- their historical attendance remains intact.
update public.attendance_students legacy
set active = false
where legacy.active
  and legacy.external_student_id is null
  and btrim(legacy.display_name) ~ '^[0-9]{3,}[[:space:]]+'
  and not exists (
    select 1
    from public.attendance_pair_enrollments e
    where e.student_id = legacy.id
      and e.active
  )
  and exists (
    select 1
    from public.attendance_students canonical
    where canonical.school_id = legacy.school_id
      and canonical.external_student_id =
        substring(btrim(legacy.display_name) from '^([0-9]{3,})[[:space:]]+')
  );

-- ---------------------------------------------------------------------------
-- 2. Backfill canonical student_uuid links for historical learning records
--    only when the submitted Student ID exactly matches a known roster ID.
--    Do not guess based on names or repair obviously test/fake IDs.
-- ---------------------------------------------------------------------------

update public.classroom_submissions sub
set student_uuid = student.id
from public.classroom_sessions session,
     public.attendance_students student
where sub.student_uuid is null
  and sub.classroom_session_id = session.id
  and student.school_id = session.school_id
  and student.external_student_id is not null
  and btrim(student.external_student_id) = btrim(sub.student_id);

update public.job_card_submissions sub
set student_uuid = student.id
from public.attendance_students student
where sub.student_uuid is null
  and student.school_id = sub.school_id
  and student.external_student_id is not null
  and btrim(student.external_student_id) = btrim(sub.student_id);

-- ---------------------------------------------------------------------------
-- 3. Replace the roster importer. A line may be either:
--       2001756  McEvoy, Eamonn
--       McEvoy, Eamonn
--    A leading 3+ digit token followed by whitespace is treated as the school
--    Student ID. The full normalized line remains display_name so existing
--    attendance screens and emailed reports keep their familiar label.
-- ---------------------------------------------------------------------------

create or replace function public.bulk_upsert_attendance_roster(
  p_pair_id uuid,
  p_names text
)
returns table(processed integer, enrolled integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_line text;
  v_display_name text;
  v_external_student_id text;
  v_student_id uuid;
  v_processed integer := 0;
  v_enrolled integer := 0;
begin
  select school_id
    into v_school_id
  from public.attendance_pairs
  where id = p_pair_id;

  if v_school_id is null then
    raise exception 'Attendance pair not found';
  end if;

  if not public.can_manage_school(v_school_id) then
    raise exception 'School management access required';
  end if;

  for v_line in
    select value
    from regexp_split_to_table(coalesce(p_names, ''), E'\\r?\\n') as value
  loop
    v_display_name := btrim(regexp_replace(v_line, '^[[:space:]•*-]+', '', 'g'));
    if v_display_name = '' then
      continue;
    end if;

    v_external_student_id := substring(
      v_display_name from '^([0-9]{3,})[[:space:]]+'
    );

    v_processed := v_processed + 1;
    v_student_id := null;

    if v_external_student_id is not null then
      -- Prefer an already-canonical row. During migration from the legacy
      -- importer, fall back to a row whose stored display label starts with
      -- the same Student ID, preferring a currently enrolled record.
      select s.id
        into v_student_id
      from public.attendance_students s
      where s.school_id = v_school_id
        and (
          s.external_student_id = v_external_student_id
          or (
            s.external_student_id is null
            and substring(
              btrim(s.display_name) from '^([0-9]{3,})[[:space:]]+'
            ) = v_external_student_id
          )
        )
      order by
        (s.external_student_id = v_external_student_id) desc,
        exists (
          select 1
          from public.attendance_pair_enrollments e
          where e.student_id = s.id
            and e.active
        ) desc,
        s.active desc,
        s.created_at asc
      limit 1;
    else
      select s.id
        into v_student_id
      from public.attendance_students s
      where s.school_id = v_school_id
        and lower(btrim(s.display_name)) = lower(v_display_name)
      order by s.active desc, s.created_at asc
      limit 1;
    end if;

    if v_student_id is null then
      insert into public.attendance_students (
        school_id,
        display_name,
        external_student_id,
        created_by
      ) values (
        v_school_id,
        v_display_name,
        v_external_student_id,
        auth.uid()
      )
      returning id into v_student_id;
    else
      update public.attendance_students
      set active = true,
          display_name = v_display_name,
          external_student_id = coalesce(v_external_student_id, external_student_id)
      where id = v_student_id;
    end if;

    insert into public.attendance_pair_enrollments (
      school_id,
      pair_id,
      student_id,
      active
    ) values (
      v_school_id,
      p_pair_id,
      v_student_id,
      true
    )
    on conflict (pair_id, student_id)
    do update set active = true;

    v_enrolled := v_enrolled + 1;
  end loop;

  perform public.write_audit_event(
    v_school_id,
    'attendance_roster_bulk_upserted',
    'attendance_pair',
    p_pair_id,
    jsonb_build_object(
      'processed', v_processed,
      'enrolled', v_enrolled,
      'student_id_aware', true
    )
  );

  return query select v_processed, v_enrolled;
end;
$$;

revoke all on function public.bulk_upsert_attendance_roster(uuid, text)
  from public, anon;
grant execute on function public.bulk_upsert_attendance_roster(uuid, text)
  to authenticated;

commit;
