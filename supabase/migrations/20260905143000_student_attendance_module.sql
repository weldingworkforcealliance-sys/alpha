-- LTG paired-course student attendance module
-- Supports standard and PVHS attendance, shared pair rosters, end-of-pair
-- confirmation, auditability, and delayed PVHS report queueing.

create table if not exists public.attendance_pairs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  pair_name text not null,
  primary_section_id uuid not null references public.sections(id) on delete cascade,
  completion_section_id uuid not null references public.sections(id) on delete cascade,
  attendance_mode text not null default 'standard'
    check (attendance_mode in ('standard','pvhs')),
  report_email text,
  report_delay_minutes integer not null default 30
    check (report_delay_minutes between 0 and 1440),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, primary_section_id, completion_section_id),
  check (primary_section_id <> completion_section_id)
);

create table if not exists public.attendance_students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) > 0),
  external_student_id text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists attendance_students_school_name_ci_idx
  on public.attendance_students (school_id, lower(display_name));

create table if not exists public.attendance_pair_enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  pair_id uuid not null references public.attendance_pairs(id) on delete cascade,
  student_id uuid not null references public.attendance_students(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pair_id, student_id)
);

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  pair_id uuid not null references public.attendance_pairs(id) on delete cascade,
  attendance_date date not null,
  attendance_mode text not null check (attendance_mode in ('standard','pvhs')),
  status text not null default 'draft' check (status in ('draft','finalized')),
  taken_at timestamptz not null default now(),
  taken_by uuid references auth.users(id) on delete set null,
  finalized_at timestamptz,
  finalized_by uuid references auth.users(id) on delete set null,
  instructor_notes text,
  report_recipient text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pair_id, attendance_date)
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id uuid not null references public.attendance_students(id) on delete cascade,
  initial_status text check (initial_status is null or initial_status in ('present','absent','late','excused')),
  final_status text check (final_status is null or final_status in ('present','absent','late','excused','left_early','partial')),
  completion_flags text[] not null default '{}'::text[],
  completion_confirmed boolean not null default false,
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id),
  check (completion_flags <@ array['unprepared','left_early','disappeared','other']::text[])
);

create table if not exists public.attendance_report_queue (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  session_id uuid not null unique references public.attendance_sessions(id) on delete cascade,
  recipient_email text not null,
  run_after timestamptz not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists attendance_pairs_primary_section_idx
  on public.attendance_pairs(primary_section_id) where active;
create index if not exists attendance_pairs_completion_section_idx
  on public.attendance_pairs(completion_section_id) where active;
create index if not exists attendance_pair_enrollments_pair_active_idx
  on public.attendance_pair_enrollments(pair_id, active);
create index if not exists attendance_sessions_pair_date_idx
  on public.attendance_sessions(pair_id, attendance_date);
create index if not exists attendance_records_session_idx
  on public.attendance_records(session_id);
create index if not exists attendance_report_queue_due_idx
  on public.attendance_report_queue(status, run_after)
  where status in ('pending','failed');

create or replace function public.attendance_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace trigger attendance_pairs_touch_updated_at
before update on public.attendance_pairs
for each row execute function public.attendance_touch_updated_at();

create or replace trigger attendance_students_touch_updated_at
before update on public.attendance_students
for each row execute function public.attendance_touch_updated_at();

create or replace trigger attendance_pair_enrollments_touch_updated_at
before update on public.attendance_pair_enrollments
for each row execute function public.attendance_touch_updated_at();

create or replace trigger attendance_sessions_touch_updated_at
before update on public.attendance_sessions
for each row execute function public.attendance_touch_updated_at();

create or replace trigger attendance_records_touch_updated_at
before update on public.attendance_records
for each row execute function public.attendance_touch_updated_at();

create or replace trigger attendance_report_queue_touch_updated_at
before update on public.attendance_report_queue
for each row execute function public.attendance_touch_updated_at();

alter table public.attendance_pairs enable row level security;
alter table public.attendance_students enable row level security;
alter table public.attendance_pair_enrollments enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_report_queue enable row level security;

create policy attendance_pairs_select_staff
on public.attendance_pairs for select to authenticated
using (public.is_school_instructional_staff(school_id));

create policy attendance_pairs_manage_school
on public.attendance_pairs for all to authenticated
using (public.can_manage_school(school_id))
with check (public.can_manage_school(school_id));

create policy attendance_students_select_staff
on public.attendance_students for select to authenticated
using (public.is_school_instructional_staff(school_id));

create policy attendance_students_manage_school
on public.attendance_students for all to authenticated
using (public.can_manage_school(school_id))
with check (public.can_manage_school(school_id));

create policy attendance_enrollments_select_staff
on public.attendance_pair_enrollments for select to authenticated
using (public.is_school_instructional_staff(school_id));

create policy attendance_enrollments_manage_school
on public.attendance_pair_enrollments for all to authenticated
using (public.can_manage_school(school_id))
with check (public.can_manage_school(school_id));

create policy attendance_sessions_select_staff
on public.attendance_sessions for select to authenticated
using (public.is_school_instructional_staff(school_id));

create policy attendance_records_select_staff
on public.attendance_records for select to authenticated
using (public.is_school_instructional_staff(school_id));

create policy attendance_report_queue_select_management
on public.attendance_report_queue for select to authenticated
using (public.can_manage_school(school_id));

grant select, insert, update, delete on public.attendance_pairs to authenticated;
grant select, insert, update, delete on public.attendance_students to authenticated;
grant select, insert, update, delete on public.attendance_pair_enrollments to authenticated;
grant select on public.attendance_sessions to authenticated;
grant select on public.attendance_records to authenticated;
grant select on public.attendance_report_queue to authenticated;

create or replace function public.save_attendance_pair(
  p_pair_id uuid,
  p_primary_section_id uuid,
  p_completion_section_id uuid,
  p_pair_name text,
  p_mode text default 'standard',
  p_report_email text default null,
  p_report_delay_minutes integer default 30,
  p_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_completion_school_id uuid;
  v_pair_id uuid;
begin
  select school_id into v_school_id
  from public.sections
  where id = p_primary_section_id;

  select school_id into v_completion_school_id
  from public.sections
  where id = p_completion_section_id;

  if v_school_id is null or v_completion_school_id is null then
    raise exception 'Both attendance-pair sections are required';
  end if;

  if v_school_id <> v_completion_school_id then
    raise exception 'Attendance-pair sections must belong to the same school';
  end if;

  if not public.can_manage_school(v_school_id) then
    raise exception 'School management access required';
  end if;

  if p_primary_section_id = p_completion_section_id then
    raise exception 'Primary and completion sections must be different';
  end if;

  if p_mode not in ('standard','pvhs') then
    raise exception 'Unsupported attendance mode';
  end if;

  if p_mode = 'pvhs' and nullif(btrim(coalesce(p_report_email,'')), '') is null then
    raise exception 'PVHS attendance requires a report recipient email';
  end if;

  if p_report_delay_minutes < 0 or p_report_delay_minutes > 1440 then
    raise exception 'Report delay must be between 0 and 1440 minutes';
  end if;

  if p_pair_id is null then
    insert into public.attendance_pairs (
      school_id, pair_name, primary_section_id, completion_section_id,
      attendance_mode, report_email, report_delay_minutes, active
    ) values (
      v_school_id,
      coalesce(nullif(btrim(p_pair_name),''),'Class Pair'),
      p_primary_section_id,
      p_completion_section_id,
      p_mode,
      nullif(btrim(coalesce(p_report_email,'')),''),
      p_report_delay_minutes,
      p_active
    ) returning id into v_pair_id;
  else
    update public.attendance_pairs
    set pair_name = coalesce(nullif(btrim(p_pair_name),''), pair_name),
        primary_section_id = p_primary_section_id,
        completion_section_id = p_completion_section_id,
        attendance_mode = p_mode,
        report_email = nullif(btrim(coalesce(p_report_email,'')),''),
        report_delay_minutes = p_report_delay_minutes,
        active = p_active
    where id = p_pair_id
      and school_id = v_school_id
    returning id into v_pair_id;

    if v_pair_id is null then
      raise exception 'Attendance pair not found';
    end if;
  end if;

  perform public.write_audit_event(
    v_school_id,
    'attendance_pair_saved',
    'attendance_pair',
    v_pair_id,
    jsonb_build_object(
      'primary_section_id', p_primary_section_id,
      'completion_section_id', p_completion_section_id,
      'mode', p_mode,
      'active', p_active
    )
  );

  return v_pair_id;
end;
$$;

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
  v_name text;
  v_student_id uuid;
  v_processed integer := 0;
  v_enrolled integer := 0;
begin
  select school_id into v_school_id
  from public.attendance_pairs
  where id = p_pair_id;

  if v_school_id is null then
    raise exception 'Attendance pair not found';
  end if;

  if not public.can_manage_school(v_school_id) then
    raise exception 'School management access required';
  end if;

  for v_line in
    select value from regexp_split_to_table(coalesce(p_names,''), E'\\r?\\n') as value
  loop
    v_name := btrim(regexp_replace(v_line, E'^[\\s•*-]+', '', 'g'));
    if v_name = '' then
      continue;
    end if;

    v_processed := v_processed + 1;

    select id into v_student_id
    from public.attendance_students
    where school_id = v_school_id
      and lower(display_name) = lower(v_name)
    limit 1;

    if v_student_id is null then
      insert into public.attendance_students (school_id, display_name, created_by)
      values (v_school_id, v_name, auth.uid())
      returning id into v_student_id;
    else
      update public.attendance_students
      set active = true,
          display_name = v_name
      where id = v_student_id;
    end if;

    insert into public.attendance_pair_enrollments (school_id, pair_id, student_id, active)
    values (v_school_id, p_pair_id, v_student_id, true)
    on conflict (pair_id, student_id)
    do update set active = true;

    v_enrolled := v_enrolled + 1;
  end loop;

  perform public.write_audit_event(
    v_school_id,
    'attendance_roster_bulk_upserted',
    'attendance_pair',
    p_pair_id,
    jsonb_build_object('processed', v_processed, 'enrolled', v_enrolled)
  );

  return query select v_processed, v_enrolled;
end;
$$;

create or replace function public.open_attendance_session(
  p_section_id uuid,
  p_attendance_date date default current_date
)
returns table(
  session_id uuid,
  pair_id uuid,
  pair_name text,
  attendance_mode text,
  is_completion_section boolean,
  finalized boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pair public.attendance_pairs%rowtype;
  v_session_id uuid;
  v_status text;
begin
  select * into v_pair
  from public.attendance_pairs
  where active = true
    and (primary_section_id = p_section_id or completion_section_id = p_section_id)
  order by created_at
  limit 1;

  if v_pair.id is null then
    raise exception 'No attendance pair is configured for this section';
  end if;

  if not public.is_school_instructional_staff(v_pair.school_id) then
    raise exception 'Active instructional staff access required';
  end if;

  insert into public.attendance_sessions (
    school_id, pair_id, attendance_date, attendance_mode,
    status, taken_at, taken_by, report_recipient
  ) values (
    v_pair.school_id,
    v_pair.id,
    p_attendance_date,
    v_pair.attendance_mode,
    'draft',
    now(),
    auth.uid(),
    v_pair.report_email
  )
  on conflict (pair_id, attendance_date)
  do update set updated_at = now()
  returning id, status into v_session_id, v_status;

  insert into public.attendance_records (school_id, session_id, student_id)
  select e.school_id, v_session_id, e.student_id
  from public.attendance_pair_enrollments e
  join public.attendance_students s on s.id = e.student_id
  where e.pair_id = v_pair.id
    and e.active = true
    and s.active = true
  on conflict (session_id, student_id) do nothing;

  return query
  select
    v_session_id,
    v_pair.id,
    v_pair.pair_name,
    v_pair.attendance_mode,
    p_section_id = v_pair.completion_section_id,
    v_status = 'finalized';
end;
$$;

create or replace function public.set_attendance_record(
  p_session_id uuid,
  p_student_id uuid,
  p_initial_status text default null,
  p_final_status text default null,
  p_completion_flags text[] default '{}'::text[],
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_status text;
begin
  select school_id, status into v_school_id, v_status
  from public.attendance_sessions
  where id = p_session_id;

  if v_school_id is null then
    raise exception 'Attendance session not found';
  end if;

  if not public.is_school_instructional_staff(v_school_id) then
    raise exception 'Active instructional staff access required';
  end if;

  if v_status = 'finalized' then
    raise exception 'Finalized attendance cannot be edited from the instructor screen';
  end if;

  if p_initial_status is not null and p_initial_status not in ('present','absent','late','excused') then
    raise exception 'Unsupported initial attendance status';
  end if;

  if p_final_status is not null and p_final_status not in ('present','absent','late','excused','left_early','partial') then
    raise exception 'Unsupported final attendance status';
  end if;

  if not coalesce(p_completion_flags, '{}'::text[]) <@ array['unprepared','left_early','disappeared','other']::text[] then
    raise exception 'Unsupported completion flag';
  end if;

  update public.attendance_records
  set initial_status = p_initial_status,
      final_status = p_final_status,
      completion_flags = coalesce(p_completion_flags, '{}'::text[]),
      notes = nullif(btrim(coalesce(p_notes,'')),''),
      updated_by = auth.uid()
  where session_id = p_session_id
    and student_id = p_student_id;

  if not found then
    raise exception 'Attendance record not found';
  end if;
end;
$$;

create or replace function public.mark_all_attendance(
  p_session_id uuid,
  p_status text default 'present'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_session_status text;
  v_count integer;
begin
  select school_id, status into v_school_id, v_session_status
  from public.attendance_sessions
  where id = p_session_id;

  if v_school_id is null then
    raise exception 'Attendance session not found';
  end if;

  if not public.is_school_instructional_staff(v_school_id) then
    raise exception 'Active instructional staff access required';
  end if;

  if v_session_status = 'finalized' then
    raise exception 'Finalized attendance cannot be edited';
  end if;

  if p_status not in ('present','absent','late','excused') then
    raise exception 'Unsupported attendance status';
  end if;

  update public.attendance_records
  set initial_status = p_status,
      updated_by = auth.uid()
  where session_id = p_session_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.finalize_attendance_session(
  p_session_id uuid,
  p_section_id uuid,
  p_general_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.attendance_sessions%rowtype;
  v_pair public.attendance_pairs%rowtype;
  v_missing integer;
begin
  select * into v_session
  from public.attendance_sessions
  where id = p_session_id
  for update;

  if v_session.id is null then
    raise exception 'Attendance session not found';
  end if;

  select * into v_pair
  from public.attendance_pairs
  where id = v_session.pair_id;

  if v_pair.id is null then
    raise exception 'Attendance pair not found';
  end if;

  if p_section_id <> v_pair.completion_section_id then
    raise exception 'Attendance is finalized at the end of the configured completion course';
  end if;

  if not public.is_school_instructional_staff(v_session.school_id) then
    raise exception 'Active instructional staff access required';
  end if;

  if v_session.status = 'finalized' then
    return;
  end if;

  select count(*) into v_missing
  from public.attendance_records ar
  join public.attendance_pair_enrollments e
    on e.pair_id = v_pair.id
   and e.student_id = ar.student_id
   and e.active = true
  where ar.session_id = p_session_id
    and ar.initial_status is null;

  if v_missing > 0 then
    raise exception 'Attendance status is required for every active student before finalizing';
  end if;

  update public.attendance_records
  set final_status = coalesce(final_status, initial_status),
      completion_confirmed = true,
      updated_by = auth.uid()
  where session_id = p_session_id;

  update public.attendance_sessions
  set status = 'finalized',
      finalized_at = now(),
      finalized_by = auth.uid(),
      instructor_notes = nullif(btrim(coalesce(p_general_notes,'')),''),
      report_recipient = coalesce(report_recipient, v_pair.report_email)
  where id = p_session_id;

  if v_pair.attendance_mode = 'pvhs' then
    if nullif(btrim(coalesce(v_pair.report_email,'')), '') is null then
      raise exception 'PVHS report email is not configured';
    end if;

    insert into public.attendance_report_queue (
      school_id, session_id, recipient_email, run_after, status
    ) values (
      v_session.school_id,
      p_session_id,
      v_pair.report_email,
      now() + make_interval(mins => v_pair.report_delay_minutes),
      'pending'
    )
    on conflict (session_id)
    do update set
      recipient_email = excluded.recipient_email,
      run_after = excluded.run_after,
      status = case
        when public.attendance_report_queue.status = 'sent' then 'sent'
        else 'pending'
      end,
      last_error = null;
  end if;

  perform public.write_audit_event(
    v_session.school_id,
    'attendance_finalized',
    'attendance_session',
    p_session_id,
    jsonb_build_object(
      'pair_id', v_pair.id,
      'attendance_date', v_session.attendance_date,
      'mode', v_pair.attendance_mode,
      'report_queued', v_pair.attendance_mode = 'pvhs'
    )
  );
end;
$$;

create or replace function public.attendance_completion_requirement(
  p_section_id uuid,
  p_attendance_date date default current_date
)
returns table(
  attendance_required boolean,
  pair_id uuid,
  session_id uuid,
  finalized boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pair public.attendance_pairs%rowtype;
  v_session_id uuid;
  v_status text;
begin
  select * into v_pair
  from public.attendance_pairs
  where active = true
    and completion_section_id = p_section_id
  order by created_at
  limit 1;

  if v_pair.id is null then
    return query select false, null::uuid, null::uuid, true;
    return;
  end if;

  if not public.is_school_instructional_staff(v_pair.school_id) then
    raise exception 'Active instructional staff access required';
  end if;

  select id, status into v_session_id, v_status
  from public.attendance_sessions
  where pair_id = v_pair.id
    and attendance_date = p_attendance_date;

  return query select true, v_pair.id, v_session_id, coalesce(v_status = 'finalized', false);
end;
$$;

-- Protect planner completion at the database layer. Only the configured
-- completion section (e.g. WLD 110 or WLD 210) requires finalized pair attendance.
create or replace function public.complete_current_planner_day(
  p_section_id uuid,
  p_actual_date date default current_date,
  p_actual_minutes integer default null,
  p_deviation_summary text default null,
  p_follow_up_needed boolean default false,
  p_follow_up_notes text default null
)
returns table(completed_day integer, new_current_day integer, section_complete boolean, planner_held boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_day_number integer;
  v_max_days integer;
  v_planner_day_id uuid;
  v_hold boolean;
  v_new_day integer;
  v_complete boolean := false;
  v_delivery_status text;
  v_started_at timestamptz;
  v_started_by uuid;
  v_completed_at timestamptz;
  v_actual_minutes integer;
  v_attendance_required boolean;
  v_attendance_finalized boolean;
begin
  select s.school_id, sp.current_planner_day_number, s.planned_instructional_days,
         pd.id, sp.manual_hold
    into v_school_id, v_day_number, v_max_days, v_planner_day_id, v_hold
  from public.sections s
  join public.section_progress sp on sp.section_id = s.id
  join public.planner_days pd
    on pd.section_id = s.id
   and pd.planner_day_number = sp.current_planner_day_number
  where s.id = p_section_id
  for update of sp;

  if v_school_id is null then
    raise exception 'Section or current planner day not found';
  end if;

  select pdd.delivery_status, pdd.started_at, pdd.instructor_id
    into v_delivery_status, v_started_at, v_started_by
  from public.planner_day_delivery pdd
  where pdd.planner_day_id = v_planner_day_id
    and pdd.section_id = p_section_id
  for update;

  if not found or v_started_at is null then
    raise exception 'Start Today must be used before completing the day';
  end if;

  if not (
    public.is_platform_owner()
    or public.can_review_instruction(v_school_id)
    or v_started_by = auth.uid()
  ) then
    raise exception 'Only the instructor who started this class or school management can complete it';
  end if;

  if v_delivery_status = 'completed' then
    raise exception 'This class day is already completed';
  end if;

  if v_delivery_status not in ('in_progress','started') then
    raise exception 'This class day is not currently in progress';
  end if;

  select r.attendance_required, r.finalized
    into v_attendance_required, v_attendance_finalized
  from public.attendance_completion_requirement(p_section_id, p_actual_date) r;

  if coalesce(v_attendance_required,false) and not coalesce(v_attendance_finalized,false) then
    raise exception 'Attendance confirmation is required before completing this paired class day';
  end if;

  v_completed_at := now();
  v_actual_minutes := greatest(
    1,
    round(extract(epoch from (v_completed_at - v_started_at)) / 60.0)::integer
  );

  update public.planner_day_delivery
  set delivery_status = 'completed',
      actual_date = p_actual_date,
      completed_at = v_completed_at,
      actual_minutes = v_actual_minutes,
      deviation_summary = p_deviation_summary,
      follow_up_needed = p_follow_up_needed,
      follow_up_notes = p_follow_up_notes,
      updated_at = now()
  where planner_day_id = v_planner_day_id;

  update public.planner_day_coverage
  set status = 'completed',
      completed_at = v_completed_at,
      updated_at = now()
  where planner_day_id = v_planner_day_id
    and status = 'active';

  perform public.write_audit_event(
    v_school_id,
    'planner_day_completed',
    'planner_day',
    v_planner_day_id,
    jsonb_build_object(
      'section_id', p_section_id,
      'planner_day_number', v_day_number,
      'started_at', v_started_at,
      'started_by', v_started_by,
      'completed_by', auth.uid(),
      'completed_at', v_completed_at,
      'actual_minutes', v_actual_minutes,
      'follow_up_needed', p_follow_up_needed
    )
  );

  if v_day_number >= v_max_days then
    update public.section_progress
    set completed_at = coalesce(completed_at, v_completed_at),
        updated_at = now()
    where section_id = p_section_id;
    v_new_day := v_day_number;
    v_complete := true;
  elsif v_hold then
    update public.section_progress
    set last_advanced_at = null,
        updated_at = now()
    where section_id = p_section_id;
    v_new_day := v_day_number;
  else
    v_new_day := v_day_number + 1;
    update public.section_progress
    set current_planner_day_number = v_new_day,
        last_advanced_at = v_completed_at,
        updated_at = now()
    where section_id = p_section_id;
  end if;

  return query select v_day_number, v_new_day, v_complete, v_hold;
end;
$$;

revoke all on function public.save_attendance_pair(uuid,uuid,uuid,text,text,text,integer,boolean) from public, anon;
revoke all on function public.bulk_upsert_attendance_roster(uuid,text) from public, anon;
revoke all on function public.open_attendance_session(uuid,date) from public, anon;
revoke all on function public.set_attendance_record(uuid,uuid,text,text,text[],text) from public, anon;
revoke all on function public.mark_all_attendance(uuid,text) from public, anon;
revoke all on function public.finalize_attendance_session(uuid,uuid,text) from public, anon;
revoke all on function public.attendance_completion_requirement(uuid,date) from public, anon;

grant execute on function public.save_attendance_pair(uuid,uuid,uuid,text,text,text,integer,boolean) to authenticated;
grant execute on function public.bulk_upsert_attendance_roster(uuid,text) to authenticated;
grant execute on function public.open_attendance_session(uuid,date) to authenticated;
grant execute on function public.set_attendance_record(uuid,uuid,text,text,text[],text) to authenticated;
grant execute on function public.mark_all_attendance(uuid,text) to authenticated;
grant execute on function public.finalize_attendance_session(uuid,uuid,text) to authenticated;
grant execute on function public.attendance_completion_requirement(uuid,date) to authenticated;
