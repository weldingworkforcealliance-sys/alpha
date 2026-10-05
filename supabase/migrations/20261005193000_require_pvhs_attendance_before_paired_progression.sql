-- Make PVHS attendance-email generation deterministic by tying paired planner
-- progression to initial attendance completion.
--
-- 1. Starting/working a PVHS paired section seeds the attendance session and roster.
-- 2. The primary course cannot be completed, and the paired completion course
--    cannot start, until every active student has an initial attendance status.
-- 3. Existing attendance-report queue logic remains responsible for creating
--    the report as soon as the last initial status is saved.

create or replace function private.ensure_pvhs_attendance_session_from_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pair public.attendance_pairs%rowtype;
  v_attendance_date date;
  v_session_id uuid;
begin
  if new.delivery_status not in ('started','in_progress','completed') then
    return new;
  end if;

  select *
    into v_pair
  from public.attendance_pairs p
  where p.active = true
    and p.attendance_mode = 'pvhs'
    and new.section_id in (p.primary_section_id, p.completion_section_id)
  order by p.created_at
  limit 1;

  if v_pair.id is null then
    return new;
  end if;

  v_attendance_date := coalesce(
    new.actual_date,
    case
      when new.started_at is not null
        then (new.started_at at time zone private.school_timezone(v_pair.school_id))::date
      else private.school_local_date(v_pair.school_id)
    end
  );

  insert into public.attendance_sessions as ses
    (school_id, pair_id, attendance_date, attendance_mode, status,
     taken_at, taken_by, report_recipient, session_type, counts_toward_attendance)
  values
    (v_pair.school_id, v_pair.id, v_attendance_date, 'pvhs', 'draft',
     coalesce(new.started_at, now()), auth.uid(), v_pair.report_email,
     'instructional', true)
  on conflict on constraint attendance_sessions_pair_id_attendance_date_key
  do update set
    updated_at = now()
  returning ses.id into v_session_id;

  insert into public.attendance_records
    (school_id, session_id, student_id)
  select
    e.school_id,
    v_session_id,
    e.student_id
  from public.attendance_pair_enrollments e
  join public.attendance_students stu
    on stu.id = e.student_id
   and stu.active = true
  where e.pair_id = v_pair.id
    and e.active = true
    and e.created_at::date <= v_attendance_date
  on conflict on constraint attendance_records_session_id_student_id_key
  do nothing;

  return new;
end;
$function$;

revoke all on function private.ensure_pvhs_attendance_session_from_delivery()
  from public, anon, authenticated;

drop trigger if exists planner_delivery_seed_pvhs_attendance
  on public.planner_day_delivery;

create trigger planner_delivery_seed_pvhs_attendance
after insert or update of delivery_status, actual_date, started_at
on public.planner_day_delivery
for each row
execute function private.ensure_pvhs_attendance_session_from_delivery();

create or replace function private.require_pvhs_initial_attendance_before_progression()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pair public.attendance_pairs%rowtype;
  v_attendance_date date;
  v_session_id uuid;
  v_student_count integer := 0;
  v_marked_count integer := 0;
begin
  select *
    into v_pair
  from public.attendance_pairs p
  where p.active = true
    and p.attendance_mode = 'pvhs'
    and new.section_id in (p.primary_section_id, p.completion_section_id)
  order by p.created_at
  limit 1;

  if v_pair.id is null then
    return new;
  end if;

  if not (
    (new.section_id = v_pair.primary_section_id and new.delivery_status = 'completed')
    or
    (
      new.section_id = v_pair.completion_section_id
      and new.delivery_status in ('started','in_progress','completed')
      and (
        tg_op = 'INSERT'
        or old.delivery_status is distinct from new.delivery_status
      )
    )
  ) then
    return new;
  end if;

  v_attendance_date := coalesce(
    new.actual_date,
    case
      when new.started_at is not null
        then (new.started_at at time zone private.school_timezone(v_pair.school_id))::date
      else private.school_local_date(v_pair.school_id)
    end
  );

  select ses.id
    into v_session_id
  from public.attendance_sessions ses
  where ses.pair_id = v_pair.id
    and ses.attendance_date = v_attendance_date
  limit 1;

  select count(*)::integer
    into v_student_count
  from public.attendance_pair_enrollments e
  join public.attendance_students stu
    on stu.id = e.student_id
   and stu.active = true
  where e.pair_id = v_pair.id
    and e.active = true
    and e.created_at::date <= v_attendance_date;

  if v_student_count = 0 then
    return new;
  end if;

  if v_session_id is not null then
    select count(*)::integer
      into v_marked_count
    from public.attendance_records ar
    join public.attendance_pair_enrollments e
      on e.pair_id = v_pair.id
     and e.student_id = ar.student_id
     and e.active = true
    join public.attendance_students stu
      on stu.id = ar.student_id
     and stu.active = true
    where ar.session_id = v_session_id
      and e.created_at::date <= v_attendance_date
      and ar.initial_status is not null;
  end if;

  if v_session_id is null or v_marked_count < v_student_count then
    raise exception
      'PVHS attendance is incomplete for %. Enter initial attendance for all % students before completing the first course or starting the paired completion course. (% of % marked)',
      v_attendance_date, v_student_count, v_marked_count, v_student_count;
  end if;

  return new;
end;
$function$;

revoke all on function private.require_pvhs_initial_attendance_before_progression()
  from public, anon, authenticated;

drop trigger if exists planner_delivery_require_pvhs_attendance
  on public.planner_day_delivery;

create trigger planner_delivery_require_pvhs_attendance
before insert or update of delivery_status
on public.planner_day_delivery
for each row
execute function private.require_pvhs_initial_attendance_before_progression();
