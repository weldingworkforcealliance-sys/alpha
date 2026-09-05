-- LTG student attendance module (deferred batch deployment)
-- Additive only. This migration does not alter approved curriculum or outcomes.

create schema if not exists private;

create table if not exists public.attendance_groups (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  code text null,
  attendance_mode text not null default 'standard'
    check (attendance_mode in ('standard', 'pvhs_daily_email')),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists attendance_groups_school_code_uidx
  on public.attendance_groups(school_id, lower(code))
  where code is not null and btrim(code) <> '';
create index if not exists attendance_groups_school_active_idx
  on public.attendance_groups(school_id, active, name);
create index if not exists attendance_groups_created_by_idx
  on public.attendance_groups(created_by);

create table if not exists public.attendance_group_sections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  attendance_group_id uuid not null references public.attendance_groups(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete restrict,
  triggers_attendance_confirmation boolean not null default false,
  created_at timestamptz not null default now(),
  unique (attendance_group_id, section_id)
);

create index if not exists attendance_group_sections_section_idx
  on public.attendance_group_sections(section_id, attendance_group_id);
create index if not exists attendance_group_sections_school_idx
  on public.attendance_group_sections(school_id, attendance_group_id);
create unique index if not exists attendance_one_confirmation_group_per_section_uidx
  on public.attendance_group_sections(section_id)
  where triggers_attendance_confirmation;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  external_student_id text null,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 80),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 80),
  preferred_name text null,
  email text null,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists students_school_external_id_uidx
  on public.students(school_id, lower(external_student_id))
  where external_student_id is not null and btrim(external_student_id) <> '';
create index if not exists students_school_name_idx
  on public.students(school_id, lower(last_name), lower(first_name));
create index if not exists students_created_by_idx
  on public.students(created_by);

create table if not exists public.attendance_group_students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  attendance_group_id uuid not null references public.attendance_groups(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  active boolean not null default true,
  enrolled_at date not null default current_date,
  withdrawn_at date null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_group_students_dates_check
    check (withdrawn_at is null or withdrawn_at >= enrolled_at),
  unique (attendance_group_id, student_id)
);

create index if not exists attendance_group_students_roster_idx
  on public.attendance_group_students(attendance_group_id, active, student_id);
create index if not exists attendance_group_students_student_idx
  on public.attendance_group_students(student_id, attendance_group_id);
create index if not exists attendance_group_students_school_idx
  on public.attendance_group_students(school_id, attendance_group_id);
create index if not exists attendance_group_students_created_by_idx
  on public.attendance_group_students(created_by);

create table if not exists public.student_section_enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  section_id uuid not null references public.sections(id) on delete restrict,
  source_attendance_group_id uuid null references public.attendance_groups(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'completed', 'withdrawn')),
  enrolled_at date not null default current_date,
  withdrawn_at date null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_section_enrollments_dates_check
    check (withdrawn_at is null or withdrawn_at >= enrolled_at),
  unique (student_id, section_id)
);

create index if not exists student_section_enrollments_section_idx
  on public.student_section_enrollments(section_id, status, student_id);
create index if not exists student_section_enrollments_school_idx
  on public.student_section_enrollments(school_id, status, student_id);
create index if not exists student_section_enrollments_group_idx
  on public.student_section_enrollments(source_attendance_group_id)
  where source_attendance_group_id is not null;
create index if not exists student_section_enrollments_created_by_idx
  on public.student_section_enrollments(created_by);

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  attendance_group_id uuid not null references public.attendance_groups(id) on delete restrict,
  attendance_date date not null,
  status text not null default 'draft'
    check (status in ('draft', 'finalized', 'reopened')),
  opened_by uuid not null references public.profiles(id) on delete restrict,
  opened_at timestamptz not null default now(),
  finalized_by uuid null references public.profiles(id) on delete restrict,
  finalized_at timestamptz null,
  report_due_at timestamptz null,
  report_sent_at timestamptz null,
  report_needs_resend boolean not null default false,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_sessions_finalize_state_check check (
    (status in ('draft', 'reopened') and finalized_by is null and finalized_at is null)
    or
    (status = 'finalized' and finalized_by is not null and finalized_at is not null)
  ),
  unique (attendance_group_id, attendance_date)
);

create index if not exists attendance_sessions_group_date_idx
  on public.attendance_sessions(attendance_group_id, attendance_date desc);
create index if not exists attendance_sessions_report_due_idx
  on public.attendance_sessions(report_due_at)
  where status = 'finalized' and report_sent_at is null;
create index if not exists attendance_sessions_school_date_idx
  on public.attendance_sessions(school_id, attendance_date desc);
create index if not exists attendance_sessions_opened_by_idx
  on public.attendance_sessions(opened_by);
create index if not exists attendance_sessions_finalized_by_idx
  on public.attendance_sessions(finalized_by)
  where finalized_by is not null;

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  attendance_session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  attendance_status text not null default 'unmarked'
    check (attendance_status in ('unmarked', 'present', 'absent', 'tardy', 'excused', 'left_early', 'not_scheduled')),
  arrival_time time null,
  departure_time time null,
  note text null check (note is null or char_length(note) <= 500),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attendance_session_id, student_id)
);

create index if not exists attendance_records_session_status_idx
  on public.attendance_records(attendance_session_id, attendance_status, student_id);
create index if not exists attendance_records_student_idx
  on public.attendance_records(student_id, attendance_session_id);
create index if not exists attendance_records_school_idx
  on public.attendance_records(school_id, attendance_session_id);
create index if not exists attendance_records_updated_by_idx
  on public.attendance_records(updated_by);

create table if not exists public.attendance_record_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  attendance_session_id uuid not null references public.attendance_sessions(id) on delete restrict,
  attendance_record_id uuid not null references public.attendance_records(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  changed_by uuid not null references public.profiles(id) on delete restrict,
  old_values jsonb not null,
  new_values jsonb not null,
  changed_at timestamptz not null default now()
);

create index if not exists attendance_record_audit_session_idx
  on public.attendance_record_audit(attendance_session_id, changed_at desc);
create index if not exists attendance_record_audit_record_idx
  on public.attendance_record_audit(attendance_record_id, changed_at desc);
create index if not exists attendance_record_audit_student_idx
  on public.attendance_record_audit(student_id, changed_at desc);
create index if not exists attendance_record_audit_changed_by_idx
  on public.attendance_record_audit(changed_by, changed_at desc);

create table if not exists public.attendance_email_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  recipient_email text null,
  cc_emails text[] not null default '{}',
  enabled boolean not null default false,
  recipient_confirmed_at timestamptz null,
  configured_by uuid null references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint attendance_email_recipient_check check (
    recipient_email is null or recipient_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  )
);

create index if not exists attendance_email_settings_configured_by_idx
  on public.attendance_email_settings(configured_by)
  where configured_by is not null;

create table if not exists public.attendance_report_deliveries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  attendance_session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  revision integer not null check (revision > 0),
  delivery_kind text not null default 'daily'
    check (delivery_kind in ('daily', 'correction', 'manual_resend')),
  recipient_email text not null,
  cc_emails text[] not null default '{}',
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'sent', 'failed', 'cancelled')),
  due_at timestamptz not null,
  processing_started_at timestamptz null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text null,
  provider_message_id text null,
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attendance_session_id, revision, delivery_kind)
);

create index if not exists attendance_report_deliveries_due_idx
  on public.attendance_report_deliveries(status, due_at)
  where status in ('queued', 'processing');
create index if not exists attendance_report_deliveries_school_created_idx
  on public.attendance_report_deliveries(school_id, created_at desc);

create or replace function private.attendance_is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.platform_owners po
    where po.user_id = (select auth.uid())
  );
$$;

create or replace function private.attendance_is_school_admin(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.attendance_is_platform_owner() or exists (
    select 1 from public.school_memberships sm
    where sm.school_id = p_school_id
      and sm.user_id = (select auth.uid())
      and sm.status = 'active'
      and sm.role::text = 'school_admin'
  );
$$;

create or replace function private.attendance_can_manage_school(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.attendance_is_platform_owner() or exists (
    select 1 from public.school_memberships sm
    where sm.school_id = p_school_id
      and sm.user_id = (select auth.uid())
      and sm.status = 'active'
      and sm.role::text in ('school_admin', 'program_lead', 'lead_instructor')
  );
$$;

create or replace function private.attendance_can_mark_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.attendance_groups g
    where g.id = p_group_id
      and g.active
      and (
        private.attendance_can_manage_school(g.school_id)
        or exists (
          select 1
          from public.attendance_group_sections ags
          join public.section_instructors si
            on si.section_id = ags.section_id
           and si.active
          where ags.attendance_group_id = g.id
            and si.instructor_id = (select auth.uid())
        )
      )
  );
$$;

create or replace function private.attendance_validate_group_section()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_group_school uuid;
  v_section_school uuid;
begin
  select school_id into v_group_school from public.attendance_groups where id = new.attendance_group_id;
  select school_id into v_section_school from public.sections where id = new.section_id;
  if v_group_school is null or v_section_school is null or v_group_school <> v_section_school then
    raise exception 'Attendance group and section must belong to the same school';
  end if;
  new.school_id := v_group_school;
  return new;
end;
$$;

drop trigger if exists attendance_group_section_school_guard on public.attendance_group_sections;
create trigger attendance_group_section_school_guard
before insert or update on public.attendance_group_sections
for each row execute function private.attendance_validate_group_section();

create or replace function private.attendance_sync_group_enrollments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'attendance_group_students' then
    if new.active then
      insert into public.student_section_enrollments(
        school_id, student_id, section_id, source_attendance_group_id,
        status, enrolled_at, withdrawn_at, created_by
      )
      select new.school_id, new.student_id, ags.section_id, new.attendance_group_id,
             'active', new.enrolled_at, null, new.created_by
      from public.attendance_group_sections ags
      where ags.attendance_group_id = new.attendance_group_id
      on conflict (student_id, section_id) do update
        set status = 'active', withdrawn_at = null, updated_at = clock_timestamp();
    else
      update public.student_section_enrollments e
      set status = 'withdrawn', withdrawn_at = coalesce(new.withdrawn_at, current_date),
          updated_at = clock_timestamp()
      where e.student_id = new.student_id
        and e.source_attendance_group_id = new.attendance_group_id;
    end if;
  elsif tg_table_name = 'attendance_group_sections' then
    insert into public.student_section_enrollments(
      school_id, student_id, section_id, source_attendance_group_id,
      status, enrolled_at, created_by
    )
    select new.school_id, gs.student_id, new.section_id, new.attendance_group_id,
           'active', gs.enrolled_at, gs.created_by
    from public.attendance_group_students gs
    where gs.attendance_group_id = new.attendance_group_id and gs.active
    on conflict (student_id, section_id) do update
      set status = 'active', withdrawn_at = null, updated_at = clock_timestamp();
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_group_students_sync_sections on public.attendance_group_students;
create trigger attendance_group_students_sync_sections
after insert or update of active, withdrawn_at on public.attendance_group_students
for each row execute function private.attendance_sync_group_enrollments();

drop trigger if exists attendance_group_sections_sync_students on public.attendance_group_sections;
create trigger attendance_group_sections_sync_students
after insert on public.attendance_group_sections
for each row execute function private.attendance_sync_group_enrollments();

create or replace function private.attendance_audit_record_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if row(old.attendance_status, old.arrival_time, old.departure_time, old.note)
     is distinct from
     row(new.attendance_status, new.arrival_time, new.departure_time, new.note) then
    insert into public.attendance_record_audit(
      school_id, attendance_session_id, attendance_record_id, student_id,
      changed_by, old_values, new_values
    ) values (
      new.school_id, new.attendance_session_id, new.id, new.student_id,
      new.updated_by,
      jsonb_build_object('status', old.attendance_status, 'arrival_time', old.arrival_time, 'departure_time', old.departure_time, 'note', old.note),
      jsonb_build_object('status', new.attendance_status, 'arrival_time', new.arrival_time, 'departure_time', new.departure_time, 'note', new.note)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_record_change_audit on public.attendance_records;
create trigger attendance_record_change_audit
after update on public.attendance_records
for each row execute function private.attendance_audit_record_change();

create or replace function public.list_attendance_groups()
returns table(
  id uuid,
  school_id uuid,
  name text,
  code text,
  attendance_mode text,
  course_labels text[],
  confirmation_course_labels text[],
  roster_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.school_id, g.name, g.code, g.attendance_mode,
         coalesce(array_agg(distinct coalesce(c.course_code, c.course_name) order by coalesce(c.course_code, c.course_name))
           filter (where c.id is not null), '{}'),
         coalesce(array_agg(distinct coalesce(c.course_code, c.course_name) order by coalesce(c.course_code, c.course_name))
           filter (where c.id is not null and ags.triggers_attendance_confirmation), '{}'),
         count(distinct gs.student_id) filter (where gs.active)
  from public.attendance_groups g
  left join public.attendance_group_sections ags on ags.attendance_group_id = g.id
  left join public.sections s on s.id = ags.section_id
  left join public.courses c on c.id = s.course_id
  left join public.attendance_group_students gs on gs.attendance_group_id = g.id
  where g.active and private.attendance_can_mark_group(g.id)
  group by g.id, g.school_id, g.name, g.code, g.attendance_mode
  order by g.name;
$$;

create or replace function public.create_attendance_group(
  p_school_id uuid,
  p_name text,
  p_code text,
  p_attendance_mode text,
  p_section_ids uuid[],
  p_confirmation_section_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not private.attendance_is_school_admin(p_school_id) then
    raise exception 'School administrator permission required';
  end if;
  if p_attendance_mode not in ('standard', 'pvhs_daily_email') then
    raise exception 'Invalid attendance type';
  end if;
  if coalesce(array_length(p_section_ids, 1), 0) < 2 then
    raise exception 'Select at least two linked class sections';
  end if;
  if coalesce(array_length(p_confirmation_section_ids, 1), 0) < 1 then
    raise exception 'Select the class that will trigger end-of-day attendance confirmation';
  end if;
  if exists (
    select 1 from unnest(p_section_ids) as selected(section_id)
    where not exists (
      select 1 from public.sections s where s.id = selected.section_id and s.school_id = p_school_id
    )
  ) then
    raise exception 'Every selected section must belong to this school';
  end if;
  if exists (
    select 1 from unnest(p_confirmation_section_ids) as confirmation(section_id)
    where not (confirmation.section_id = any(p_section_ids))
  ) then
    raise exception 'Every attendance confirmation class must be part of the linked class pair';
  end if;

  insert into public.attendance_groups(school_id, name, code, attendance_mode, created_by)
  values (p_school_id, btrim(p_name), nullif(btrim(p_code), ''), p_attendance_mode, v_uid)
  returning id into v_group_id;

  insert into public.attendance_group_sections(
    school_id, attendance_group_id, section_id, triggers_attendance_confirmation
  )
  select distinct p_school_id, v_group_id, selected.section_id,
         selected.section_id = any(p_confirmation_section_ids)
  from unnest(p_section_ids) as selected(section_id);

  insert into public.audit_log(school_id, user_id, action, entity_type, entity_id, details)
  values (p_school_id, v_uid, 'attendance_group_created', 'attendance_group', v_group_id,
          jsonb_build_object('name', btrim(p_name), 'mode', p_attendance_mode,
                             'section_ids', p_section_ids,
                             'confirmation_section_ids', p_confirmation_section_ids));
  return v_group_id;
end;
$$;

create or replace function public.get_end_of_day_attendance_requirement(
  p_section_id uuid,
  p_attendance_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_group public.attendance_groups%rowtype;
  v_session public.attendance_sessions%rowtype;
  v_courses text[];
begin
  select g.* into v_group
  from public.attendance_group_sections ags
  join public.attendance_groups g on g.id = ags.attendance_group_id
  where ags.section_id = p_section_id
    and ags.triggers_attendance_confirmation
    and g.active
    and private.attendance_can_mark_group(g.id)
  order by g.name
  limit 1;

  if not found then return jsonb_build_object('required', false); end if;

  select * into v_session
  from public.attendance_sessions ses
  where ses.attendance_group_id = v_group.id
    and ses.attendance_date = p_attendance_date;

  select coalesce(array_agg(distinct coalesce(c.course_code, c.course_name)
                            order by coalesce(c.course_code, c.course_name)), '{}')
  into v_courses
  from public.attendance_group_sections ags
  join public.sections s on s.id = ags.section_id
  join public.courses c on c.id = s.course_id
  where ags.attendance_group_id = v_group.id;

  return jsonb_build_object(
    'required', true,
    'attendance_group_id', v_group.id,
    'group_name', v_group.name,
    'attendance_mode', v_group.attendance_mode,
    'course_labels', v_courses,
    'already_finalized', coalesce(v_session.status = 'finalized', false),
    'attendance_session_id', v_session.id
  );
end;
$$;

create or replace function public.bulk_import_attendance_roster(
  p_attendance_group_id uuid,
  p_students jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_school_id uuid;
  v_row jsonb;
  v_student_id uuid;
  v_first text;
  v_last text;
  v_external text;
  v_email text;
  v_inserted integer := 0;
  v_reused integer := 0;
  v_enrolled integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_index integer := 0;
  v_match_count integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select school_id into v_school_id from public.attendance_groups where id = p_attendance_group_id and active;
  if v_school_id is null then raise exception 'Attendance group not found'; end if;
  if not private.attendance_is_school_admin(v_school_id) then
    raise exception 'School administrator permission required';
  end if;
  if jsonb_typeof(p_students) <> 'array' or jsonb_array_length(p_students) = 0 then
    raise exception 'Paste at least one student';
  end if;
  if jsonb_array_length(p_students) > 500 then
    raise exception 'A roster import is limited to 500 students';
  end if;

  for v_row in select value from jsonb_array_elements(p_students)
  loop
    v_index := v_index + 1;
    v_first := btrim(coalesce(v_row->>'first_name', ''));
    v_last := btrim(coalesce(v_row->>'last_name', ''));
    v_external := nullif(btrim(coalesce(v_row->>'external_student_id', '')), '');
    v_email := nullif(btrim(coalesce(v_row->>'email', '')), '');

    if v_first = '' or v_last = '' then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_index, 'message', 'First and last name are required'));
      continue;
    end if;

    v_student_id := null;
    if v_external is not null then
      select s.id into v_student_id
      from public.students s
      where s.school_id = v_school_id and lower(s.external_student_id) = lower(v_external)
      limit 1;
    else
      select count(*) into v_match_count
      from public.students s
      where s.school_id = v_school_id
        and lower(s.first_name) = lower(v_first)
        and lower(s.last_name) = lower(v_last);
      if v_match_count > 1 then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_index, 'message', 'Duplicate name found; add a Student ID to identify this student'
        ));
        continue;
      elsif v_match_count = 1 then
        select s.id into v_student_id
        from public.students s
        where s.school_id = v_school_id
          and lower(s.first_name) = lower(v_first)
          and lower(s.last_name) = lower(v_last)
        limit 1;
      end if;
    end if;

    if v_student_id is null then
      insert into public.students(school_id, external_student_id, first_name, last_name, email, created_by)
      values (v_school_id, v_external, v_first, v_last, v_email, v_uid)
      returning id into v_student_id;
      v_inserted := v_inserted + 1;
    else
      update public.students
      set first_name = v_first, last_name = v_last,
          email = coalesce(v_email, email), active = true, updated_at = clock_timestamp()
      where id = v_student_id;
      v_reused := v_reused + 1;
    end if;

    insert into public.attendance_group_students(
      school_id, attendance_group_id, student_id, active, withdrawn_at, created_by
    ) values (v_school_id, p_attendance_group_id, v_student_id, true, null, v_uid)
    on conflict (attendance_group_id, student_id) do update
      set active = true, withdrawn_at = null, updated_at = clock_timestamp();
    v_enrolled := v_enrolled + 1;
  end loop;

  insert into public.audit_log(school_id, user_id, action, entity_type, entity_id, details)
  values (v_school_id, v_uid, 'attendance_roster_imported', 'attendance_group', p_attendance_group_id,
          jsonb_build_object('new_students', v_inserted, 'existing_students', v_reused,
                             'enrolled', v_enrolled, 'errors', v_errors));

  return jsonb_build_object('new_students', v_inserted, 'existing_students', v_reused,
                            'enrolled', v_enrolled, 'errors', v_errors);
end;
$$;

create or replace function public.open_attendance_session(
  p_attendance_group_id uuid,
  p_attendance_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_school_id uuid;
  v_session_id uuid;
begin
  if v_uid is null then raise exception 'Instructor login required'; end if;
  if not private.attendance_can_mark_group(p_attendance_group_id) then
    raise exception 'You are not assigned to this attendance group';
  end if;
  select school_id into v_school_id from public.attendance_groups where id = p_attendance_group_id and active;
  if v_school_id is null then raise exception 'Attendance group not found'; end if;

  insert into public.attendance_sessions(
    school_id, attendance_group_id, attendance_date, opened_by
  ) values (v_school_id, p_attendance_group_id, p_attendance_date, v_uid)
  on conflict (attendance_group_id, attendance_date) do update
    set updated_at = public.attendance_sessions.updated_at
  returning id into v_session_id;

  insert into public.attendance_records(
    school_id, attendance_session_id, student_id, attendance_status, updated_by
  )
  select v_school_id, v_session_id, gs.student_id, 'unmarked', v_uid
  from public.attendance_group_students gs
  where gs.attendance_group_id = p_attendance_group_id
    and gs.active
    and gs.enrolled_at <= p_attendance_date
    and (gs.withdrawn_at is null or gs.withdrawn_at >= p_attendance_date)
  on conflict (attendance_session_id, student_id) do nothing;

  return v_session_id;
end;
$$;

create or replace function public.get_attendance_session(p_attendance_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
  v_payload jsonb;
begin
  select attendance_group_id into v_group_id
  from public.attendance_sessions where id = p_attendance_session_id;
  if v_group_id is null or not private.attendance_can_mark_group(v_group_id) then
    raise exception 'Attendance session not found or access denied';
  end if;

  select jsonb_build_object(
    'session', jsonb_build_object(
      'id', ses.id, 'school_id', ses.school_id, 'attendance_group_id', ses.attendance_group_id,
      'attendance_date', ses.attendance_date, 'status', ses.status,
      'finalized_at', ses.finalized_at, 'report_due_at', ses.report_due_at,
      'report_sent_at', ses.report_sent_at, 'report_needs_resend', ses.report_needs_resend,
      'revision', ses.revision
    ),
    'records', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'student_id', r.student_id,
        'student_name', concat_ws(', ', st.last_name, st.first_name),
        'external_student_id', st.external_student_id,
        'attendance_status', r.attendance_status,
        'arrival_time', r.arrival_time, 'departure_time', r.departure_time, 'note', r.note
      ) order by lower(st.last_name), lower(st.first_name))
      from public.attendance_records r
      join public.students st on st.id = r.student_id
      where r.attendance_session_id = ses.id
    ), '[]'::jsonb)
  ) into v_payload
  from public.attendance_sessions ses
  where ses.id = p_attendance_session_id;
  return v_payload;
end;
$$;

create or replace function public.save_attendance_records(
  p_attendance_session_id uuid,
  p_records jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.attendance_sessions%rowtype;
  v_record jsonb;
  v_count integer := 0;
  v_status text;
begin
  if v_uid is null then raise exception 'Instructor login required'; end if;
  select * into v_session from public.attendance_sessions where id = p_attendance_session_id for update;
  if not found or not private.attendance_can_mark_group(v_session.attendance_group_id) then
    raise exception 'Attendance session not found or access denied';
  end if;
  if v_session.status = 'finalized' and v_session.report_sent_at is not null then
    raise exception 'This report was already sent. A school administrator must reopen it before corrections';
  end if;
  if jsonb_typeof(p_records) <> 'array' then raise exception 'Attendance records must be an array'; end if;

  for v_record in select value from jsonb_array_elements(p_records)
  loop
    v_status := v_record->>'attendance_status';
    if v_status not in ('unmarked', 'present', 'absent', 'tardy', 'excused', 'left_early', 'not_scheduled') then
      raise exception 'Invalid attendance status';
    end if;
    update public.attendance_records r
    set attendance_status = v_status,
        arrival_time = nullif(v_record->>'arrival_time', '')::time,
        departure_time = nullif(v_record->>'departure_time', '')::time,
        note = nullif(btrim(coalesce(v_record->>'note', '')), ''),
        updated_by = v_uid,
        updated_at = clock_timestamp()
    where r.id = (v_record->>'id')::uuid
      and r.attendance_session_id = p_attendance_session_id;
    if found then v_count := v_count + 1; end if;
  end loop;

  update public.attendance_sessions
  set updated_at = clock_timestamp()
  where id = p_attendance_session_id;
  return jsonb_build_object('saved', v_count);
end;
$$;

create or replace function public.finalize_attendance_session(p_attendance_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.attendance_sessions%rowtype;
  v_group public.attendance_groups%rowtype;
  v_settings public.attendance_email_settings%rowtype;
  v_due timestamptz;
  v_email_state text := 'not_required';
begin
  if v_uid is null then raise exception 'Instructor login required'; end if;
  select * into v_session from public.attendance_sessions where id = p_attendance_session_id for update;
  if not found or not private.attendance_can_mark_group(v_session.attendance_group_id) then
    raise exception 'Attendance session not found or access denied';
  end if;
  if exists (
    select 1 from public.attendance_records
    where attendance_session_id = p_attendance_session_id and attendance_status = 'unmarked'
  ) then
    raise exception 'Every student must be marked before attendance is finalized';
  end if;
  if not exists (select 1 from public.attendance_records where attendance_session_id = p_attendance_session_id) then
    raise exception 'The attendance roster is empty';
  end if;

  select * into v_group from public.attendance_groups where id = v_session.attendance_group_id;
  v_due := clock_timestamp() + interval '30 minutes';

  update public.attendance_sessions
  set status = 'finalized', finalized_by = v_uid, finalized_at = clock_timestamp(),
      report_due_at = case when v_group.attendance_mode = 'pvhs_daily_email' then v_due else null end,
      report_needs_resend = false, updated_at = clock_timestamp()
  where id = p_attendance_session_id
  returning * into v_session;

  if v_group.attendance_mode = 'pvhs_daily_email' then
    select * into v_settings from public.attendance_email_settings where school_id = v_session.school_id;
    if v_settings.enabled and v_settings.recipient_email is not null and v_settings.recipient_confirmed_at is not null then
      insert into public.attendance_report_deliveries(
        school_id, attendance_session_id, revision, delivery_kind,
        recipient_email, cc_emails, due_at
      ) values (
        v_session.school_id, v_session.id, v_session.revision,
        case when v_session.report_sent_at is null then 'daily' else 'correction' end,
        v_settings.recipient_email, v_settings.cc_emails, v_due
      )
      on conflict (attendance_session_id, revision, delivery_kind) do nothing;
      v_email_state := 'queued';
    else
      v_email_state := 'configuration_required';
    end if;
  end if;

  insert into public.audit_log(school_id, user_id, action, entity_type, entity_id, details)
  values (v_session.school_id, v_uid, 'student_attendance_finalized', 'attendance_session', v_session.id,
          jsonb_build_object('attendance_date', v_session.attendance_date,
                             'report_due_at', v_session.report_due_at, 'email_state', v_email_state));
  return jsonb_build_object('status', 'finalized', 'email_state', v_email_state,
                            'report_due_at', v_session.report_due_at);
end;
$$;

create or replace function public.reopen_attendance_session(
  p_attendance_session_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.attendance_sessions%rowtype;
  v_uid uuid := auth.uid();
begin
  select * into v_session from public.attendance_sessions where id = p_attendance_session_id for update;
  if not found then raise exception 'Attendance session not found'; end if;
  if not private.attendance_is_school_admin(v_session.school_id) then
    raise exception 'School administrator permission required';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'A correction reason is required'; end if;

  update public.attendance_report_deliveries
  set status = 'cancelled', updated_at = clock_timestamp()
  where attendance_session_id = p_attendance_session_id and status in ('queued', 'processing');

  update public.attendance_sessions
  set status = 'reopened', finalized_by = null, finalized_at = null,
      report_due_at = null, report_needs_resend = report_sent_at is not null,
      revision = revision + 1, updated_at = clock_timestamp()
  where id = p_attendance_session_id;

  insert into public.audit_log(school_id, user_id, action, entity_type, entity_id, details)
  values (v_session.school_id, v_uid, 'student_attendance_reopened', 'attendance_session', v_session.id,
          jsonb_build_object('reason', btrim(p_reason), 'previous_revision', v_session.revision));
  return true;
end;
$$;

create or replace function public.configure_attendance_email(
  p_school_id uuid,
  p_recipient_email text,
  p_cc_emails text[] default '{}',
  p_enabled boolean default true,
  p_confirm_recipient boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_recipient_email, '')));
  v_cc text;
begin
  if not private.attendance_is_school_admin(p_school_id) then
    raise exception 'School administrator permission required';
  end if;
  if v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Enter a valid report email address';
  end if;
  if coalesce(cardinality(p_cc_emails), 0) > 5 then raise exception 'No more than five CC addresses are allowed'; end if;
  foreach v_cc in array coalesce(p_cc_emails, '{}')
  loop
    if lower(btrim(v_cc)) !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
      raise exception 'Every CC address must be a valid email address';
    end if;
  end loop;

  insert into public.attendance_email_settings(
    school_id, recipient_email, cc_emails, enabled, recipient_confirmed_at, configured_by
  ) values (
    p_school_id, v_email,
    array(select lower(btrim(value)) from unnest(coalesce(p_cc_emails, '{}')) as item(value)),
    p_enabled,
    case when p_confirm_recipient then clock_timestamp() else null end, v_uid
  )
  on conflict (school_id) do update
    set recipient_email = excluded.recipient_email,
        cc_emails = excluded.cc_emails,
        enabled = excluded.enabled,
        recipient_confirmed_at = case
          when public.attendance_email_settings.recipient_email = excluded.recipient_email
               and public.attendance_email_settings.recipient_confirmed_at is not null
            then public.attendance_email_settings.recipient_confirmed_at
          when p_confirm_recipient then clock_timestamp()
          else null
        end,
        configured_by = v_uid,
        updated_at = clock_timestamp();

  insert into public.audit_log(school_id, user_id, action, entity_type, entity_id, details)
  values (p_school_id, v_uid, 'attendance_email_configured', 'school', p_school_id,
          jsonb_build_object('recipient_email', v_email, 'cc_count', coalesce(cardinality(p_cc_emails), 0),
                             'enabled', p_enabled, 'confirmed', p_confirm_recipient));
  return true;
end;
$$;

create or replace function public.claim_due_attendance_reports(p_limit integer default 10)
returns setof public.attendance_report_deliveries
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select d.id
    from public.attendance_report_deliveries d
    where (
      d.status = 'queued'
      or (d.status = 'processing' and d.processing_started_at < clock_timestamp() - interval '10 minutes')
    )
      and d.due_at <= clock_timestamp()
      and d.attempt_count < 5
    order by d.due_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  )
  update public.attendance_report_deliveries d
  set status = 'processing', processing_started_at = clock_timestamp(),
      attempt_count = d.attempt_count + 1, updated_at = clock_timestamp()
  from due
  where d.id = due.id
  returning d.*;
end;
$$;

create or replace function public.attendance_report_payload(p_delivery_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'delivery_id', d.id,
    'recipient_email', d.recipient_email,
    'cc_emails', d.cc_emails,
    'delivery_kind', d.delivery_kind,
    'school_name', sch.name,
    'group_name', g.name,
    'group_code', g.code,
    'attendance_date', ses.attendance_date,
    'revision', d.revision,
    'courses', coalesce((
      select jsonb_agg(distinct coalesce(c.course_code, c.course_name))
      from public.attendance_group_sections ags
      join public.sections sec on sec.id = ags.section_id
      join public.courses c on c.id = sec.course_id
      where ags.attendance_group_id = g.id
    ), '[]'::jsonb),
    'totals', (
      select jsonb_object_agg(x.attendance_status, x.total)
      from (
        select r.attendance_status, count(*) as total
        from public.attendance_records r
        where r.attendance_session_id = ses.id
        group by r.attendance_status
      ) x
    ),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_name', concat_ws(', ', st.last_name, st.first_name),
        'student_id', st.external_student_id,
        'status', r.attendance_status,
        'arrival_time', r.arrival_time,
        'departure_time', r.departure_time,
        'note', r.note
      ) order by lower(st.last_name), lower(st.first_name))
      from public.attendance_records r
      join public.students st on st.id = r.student_id
      where r.attendance_session_id = ses.id
    ), '[]'::jsonb)
  )
  from public.attendance_report_deliveries d
  join public.attendance_sessions ses on ses.id = d.attendance_session_id
  join public.attendance_groups g on g.id = ses.attendance_group_id
  join public.schools sch on sch.id = d.school_id
  where d.id = p_delivery_id;
$$;

create or replace function public.complete_attendance_report(
  p_delivery_id uuid,
  p_provider_message_id text,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_attempts integer;
begin
  select attendance_session_id, attempt_count into v_session_id, v_attempts
  from public.attendance_report_deliveries where id = p_delivery_id for update;
  if not found then raise exception 'Attendance report delivery not found'; end if;

  if p_error is null then
    update public.attendance_report_deliveries
    set status = 'sent', sent_at = clock_timestamp(), provider_message_id = p_provider_message_id,
        last_error = null, updated_at = clock_timestamp()
    where id = p_delivery_id;
    update public.attendance_sessions
    set report_sent_at = clock_timestamp(), report_needs_resend = false, updated_at = clock_timestamp()
    where id = v_session_id;
  else
    update public.attendance_report_deliveries
    set status = case when v_attempts >= 5 then 'failed' else 'queued' end,
        due_at = clock_timestamp() + make_interval(mins => least(30, greatest(2, v_attempts * 5))),
        last_error = left(p_error, 1000), updated_at = clock_timestamp()
    where id = p_delivery_id;
  end if;
  return true;
end;
$$;

alter table public.attendance_groups enable row level security;
alter table public.attendance_group_sections enable row level security;
alter table public.students enable row level security;
alter table public.attendance_group_students enable row level security;
alter table public.student_section_enrollments enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_record_audit enable row level security;
alter table public.attendance_email_settings enable row level security;
alter table public.attendance_report_deliveries enable row level security;

create policy attendance_groups_select on public.attendance_groups for select to authenticated
  using (private.attendance_can_mark_group(id) or private.attendance_is_school_admin(school_id));
create policy attendance_group_sections_select on public.attendance_group_sections for select to authenticated
  using (private.attendance_can_mark_group(attendance_group_id) or private.attendance_is_school_admin(school_id));
create policy students_select on public.students for select to authenticated
  using (private.attendance_can_manage_school(school_id) or exists (
    select 1 from public.attendance_group_students gs
    where gs.student_id = students.id and private.attendance_can_mark_group(gs.attendance_group_id)
  ));
create policy attendance_group_students_select on public.attendance_group_students for select to authenticated
  using (private.attendance_can_mark_group(attendance_group_id) or private.attendance_is_school_admin(school_id));
create policy student_section_enrollments_select on public.student_section_enrollments for select to authenticated
  using (private.attendance_can_manage_school(school_id) or exists (
    select 1 from public.attendance_group_sections ags
    where ags.section_id = student_section_enrollments.section_id
      and private.attendance_can_mark_group(ags.attendance_group_id)
  ));
create policy attendance_sessions_select on public.attendance_sessions for select to authenticated
  using (private.attendance_can_mark_group(attendance_group_id));
create policy attendance_records_select on public.attendance_records for select to authenticated
  using (exists (
    select 1 from public.attendance_sessions ses
    where ses.id = attendance_records.attendance_session_id
      and private.attendance_can_mark_group(ses.attendance_group_id)
  ));
create policy attendance_record_audit_select on public.attendance_record_audit for select to authenticated
  using (private.attendance_is_school_admin(school_id));
create policy attendance_email_settings_select on public.attendance_email_settings for select to authenticated
  using (private.attendance_is_school_admin(school_id));
create policy attendance_report_deliveries_select on public.attendance_report_deliveries for select to authenticated
  using (private.attendance_is_school_admin(school_id));

grant select on public.attendance_groups, public.attendance_group_sections, public.students,
  public.attendance_group_students, public.student_section_enrollments, public.attendance_sessions,
  public.attendance_records, public.attendance_record_audit, public.attendance_email_settings,
  public.attendance_report_deliveries to authenticated;

revoke all on function private.attendance_is_platform_owner() from public, anon;
revoke all on function private.attendance_is_school_admin(uuid) from public, anon;
revoke all on function private.attendance_can_manage_school(uuid) from public, anon;
revoke all on function private.attendance_can_mark_group(uuid) from public, anon;
revoke all on function private.attendance_validate_group_section() from public, anon, authenticated;
revoke all on function private.attendance_sync_group_enrollments() from public, anon, authenticated;
revoke all on function private.attendance_audit_record_change() from public, anon, authenticated;

grant usage on schema private to authenticated;
grant execute on function private.attendance_is_platform_owner() to authenticated;
grant execute on function private.attendance_is_school_admin(uuid) to authenticated;
grant execute on function private.attendance_can_manage_school(uuid) to authenticated;
grant execute on function private.attendance_can_mark_group(uuid) to authenticated;

revoke all on function public.claim_due_attendance_reports(integer) from public, anon, authenticated;
revoke all on function public.attendance_report_payload(uuid) from public, anon, authenticated;
revoke all on function public.complete_attendance_report(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_due_attendance_reports(integer) to service_role;
grant execute on function public.attendance_report_payload(uuid) to service_role;
grant execute on function public.complete_attendance_report(uuid, text, text) to service_role;

revoke all on function public.list_attendance_groups() from public, anon;
revoke all on function public.create_attendance_group(uuid, text, text, text, uuid[], uuid[]) from public, anon;
revoke all on function public.get_end_of_day_attendance_requirement(uuid, date) from public, anon;
revoke all on function public.bulk_import_attendance_roster(uuid, jsonb) from public, anon;
revoke all on function public.open_attendance_session(uuid, date) from public, anon;
revoke all on function public.get_attendance_session(uuid) from public, anon;
revoke all on function public.save_attendance_records(uuid, jsonb) from public, anon;
revoke all on function public.finalize_attendance_session(uuid) from public, anon;
revoke all on function public.reopen_attendance_session(uuid, text) from public, anon;
revoke all on function public.configure_attendance_email(uuid, text, text[], boolean, boolean) from public, anon;

grant execute on function public.list_attendance_groups() to authenticated;
grant execute on function public.create_attendance_group(uuid, text, text, text, uuid[], uuid[]) to authenticated;
grant execute on function public.get_end_of_day_attendance_requirement(uuid, date) to authenticated;
grant execute on function public.bulk_import_attendance_roster(uuid, jsonb) to authenticated;
grant execute on function public.open_attendance_session(uuid, date) to authenticated;
grant execute on function public.get_attendance_session(uuid) to authenticated;
grant execute on function public.save_attendance_records(uuid, jsonb) to authenticated;
grant execute on function public.finalize_attendance_session(uuid) to authenticated;
grant execute on function public.reopen_attendance_session(uuid, text) to authenticated;
grant execute on function public.configure_attendance_email(uuid, text, text[], boolean, boolean) to authenticated;
