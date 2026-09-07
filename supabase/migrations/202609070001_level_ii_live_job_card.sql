-- Level II Live Job Card
--
-- Reproduces the Job Card schema and RPC behavior validated in the non-production
-- Gltg project, while explicitly hardening Data API grants before production use.
-- This is an instructional classroom record. It does not create AWS qualification
-- or certification records.

create schema if not exists private;

create table if not exists public.job_card_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  template_key text not null,
  name text not null,
  description text,
  default_requirements jsonb not null default '[]'::jsonb,
  system_defined boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint job_card_templates_requirements_array
    check (jsonb_typeof(default_requirements) = 'array'),
  constraint job_card_templates_requirements_max
    check (jsonb_array_length(default_requirements) <= 4)
);

create unique index if not exists job_card_templates_global_key_uidx
  on public.job_card_templates(template_key)
  where school_id is null;

create unique index if not exists job_card_templates_school_key_uidx
  on public.job_card_templates(school_id, template_key)
  where school_id is not null;

create table if not exists public.job_card_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  guide_day_id uuid,
  planner_day_number integer,
  instructor_id uuid not null references public.profiles(id) on delete restrict,
  template_id uuid references public.job_card_templates(id) on delete set null,
  join_code text not null,
  status text not null default 'active',
  expected_students integer not null,
  job_title text not null,
  drawing_ref text,
  drawing_revision text,
  wps_swps_ref text,
  process text,
  position text,
  material_joint text,
  requirements jsonb not null,
  started_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint job_card_sessions_expected_students_check
    check (expected_students >= 1 and expected_students <= 17),
  constraint job_card_sessions_job_title_check
    check (char_length(btrim(job_title)) >= 1 and char_length(btrim(job_title)) <= 180),
  constraint job_card_sessions_planner_day_number_check
    check (planner_day_number is null or planner_day_number > 0),
  constraint job_card_sessions_requirements_array
    check (jsonb_typeof(requirements) = 'array'),
  constraint job_card_sessions_requirements_count
    check (jsonb_array_length(requirements) >= 1 and jsonb_array_length(requirements) <= 4),
  constraint job_card_sessions_status_check
    check (status in ('active', 'ended', 'expired'))
);

create unique index if not exists job_card_sessions_join_code_uidx
  on public.job_card_sessions(upper(join_code));

create index if not exists job_card_sessions_instructor_status_idx
  on public.job_card_sessions(instructor_id, status, started_at desc);

create index if not exists job_card_sessions_section_status_idx
  on public.job_card_sessions(section_id, status, started_at desc);

create table if not exists public.job_card_submissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  job_card_session_id uuid not null references public.job_card_sessions(id) on delete cascade,
  student_name text not null,
  student_id text not null,
  start_check jsonb not null,
  quality_check jsonb not null,
  requirement_results jsonb not null,
  evidence_type text not null default 'none',
  evidence_note text,
  submitted_at timestamptz not null default clock_timestamp(),
  review_decision text,
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  constraint job_card_submissions_evidence_type_check
    check (evidence_type in ('none', 'photo', 'measurement', 'inspection_test_result')),
  constraint job_card_submissions_quality_check_object
    check (jsonb_typeof(quality_check) = 'object'),
  constraint job_card_submissions_results_array
    check (jsonb_typeof(requirement_results) = 'array'),
  constraint job_card_submissions_results_count
    check (jsonb_array_length(requirement_results) >= 1 and jsonb_array_length(requirement_results) <= 4),
  constraint job_card_submissions_review_decision_check
    check (review_decision is null or review_decision in ('accepted', 'correction_required')),
  constraint job_card_submissions_start_check_object
    check (jsonb_typeof(start_check) = 'object'),
  constraint job_card_submissions_student_id_check
    check (char_length(btrim(student_id)) >= 1 and char_length(btrim(student_id)) <= 80),
  constraint job_card_submissions_student_name_check
    check (char_length(btrim(student_name)) >= 1 and char_length(btrim(student_name)) <= 120)
);

create unique index if not exists job_card_submission_session_student_uidx
  on public.job_card_submissions(job_card_session_id, lower(btrim(student_id)));

create index if not exists job_card_submissions_session_submitted_idx
  on public.job_card_submissions(job_card_session_id, submitted_at desc);

alter table public.job_card_templates enable row level security;
alter table public.job_card_sessions enable row level security;
alter table public.job_card_submissions enable row level security;

create or replace function private.job_card_is_platform_owner(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select p_user_id is not null and exists (
    select 1
    from public.platform_owners po
    where po.user_id = p_user_id
  );
$$;

create or replace function private.job_card_can_instruct(p_school_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select p_user_id is not null and (
    private.job_card_is_platform_owner(p_user_id)
    or exists (
      select 1
      from public.school_memberships sm
      where sm.school_id = p_school_id
        and sm.user_id = p_user_id
        and sm.status = 'active'::public.membership_status
        and sm.role in (
          'school_admin'::public.app_school_role,
          'program_lead'::public.app_school_role,
          'lead_instructor'::public.app_school_role,
          'instructor'::public.app_school_role
        )
    )
  );
$$;

create or replace function private.job_card_generate_code()
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (
      select 1
      from public.job_card_sessions s
      where upper(s.join_code) = v_code
    );
  end loop;
  return v_code;
end;
$$;

revoke all on function private.job_card_is_platform_owner(uuid) from public;
revoke all on function private.job_card_can_instruct(uuid, uuid) from public;
revoke all on function private.job_card_generate_code() from public;
grant execute on function private.job_card_is_platform_owner(uuid) to authenticated, service_role;
grant execute on function private.job_card_can_instruct(uuid, uuid) to authenticated, service_role;
grant execute on function private.job_card_generate_code() to service_role;

drop policy if exists job_card_templates_select on public.job_card_templates;
create policy job_card_templates_select
on public.job_card_templates
for select
to authenticated
using (
  school_id is null
  or private.job_card_is_platform_owner(auth.uid())
  or exists (
    select 1
    from public.school_memberships sm
    where sm.school_id = job_card_templates.school_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'::public.membership_status
  )
);

drop policy if exists job_card_sessions_select on public.job_card_sessions;
create policy job_card_sessions_select
on public.job_card_sessions
for select
to authenticated
using (
  instructor_id = auth.uid()
  or private.job_card_is_platform_owner(auth.uid())
);

drop policy if exists job_card_submissions_select on public.job_card_submissions;
create policy job_card_submissions_select
on public.job_card_submissions
for select
to authenticated
using (
  private.job_card_is_platform_owner(auth.uid())
  or exists (
    select 1
    from public.job_card_sessions s
    where s.id = job_card_submissions.job_card_session_id
      and s.instructor_id = auth.uid()
  )
);

create or replace function public.expire_job_card_sessions()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_count integer;
begin
  update public.job_card_sessions
  set status = 'expired', ended_at = coalesce(ended_at, clock_timestamp())
  where status = 'active' and expires_at <= clock_timestamp();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

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

  if not private.job_card_can_instruct(v_section.school_id, v_uid) then
    raise exception 'You do not have permission to launch a Job Card for this school';
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

create or replace function public.get_job_card_by_code(p_join_code text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_session public.job_card_sessions%rowtype;
  v_section_name text;
  v_course_code text;
begin
  perform public.expire_job_card_sessions();

  select s.* into v_session
  from public.job_card_sessions s
  where upper(s.join_code) = upper(btrim(p_join_code))
    and s.status = 'active'
    and s.expires_at > clock_timestamp()
  limit 1;
  if not found then raise exception 'This Live Job Card code is invalid or expired'; end if;

  select sec.section_name, c.course_code
  into v_section_name, v_course_code
  from public.sections sec
  join public.courses c on c.id = sec.course_id
  where sec.id = v_session.section_id;

  return jsonb_build_object(
    'sessionId', v_session.id,
    'joinCode', v_session.join_code,
    'status', v_session.status,
    'expiresAt', v_session.expires_at,
    'sectionLabel', concat_ws(' · ', nullif(v_course_code,''), nullif(v_section_name,'')),
    'jobTitle', v_session.job_title,
    'plannerDayNumber', v_session.planner_day_number,
    'drawingRef', v_session.drawing_ref,
    'drawingRevision', v_session.drawing_revision,
    'wpsSwpsRef', v_session.wps_swps_ref,
    'process', v_session.process,
    'position', v_session.position,
    'materialJoint', v_session.material_joint,
    'requirements', v_session.requirements
  );
end;
$$;

create or replace function public.submit_job_card(
  p_join_code text,
  p_student_name text,
  p_student_id text,
  p_start_check jsonb,
  p_quality_check jsonb,
  p_requirement_results jsonb,
  p_evidence_type text default 'none',
  p_evidence_note text default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_session public.job_card_sessions%rowtype;
  v_count integer;
  v_req jsonb;
  v_result jsonb;
  v_status text;
  v_sanitized jsonb := '[]'::jsonb;
  v_submission_id uuid;
begin
  perform public.expire_job_card_sessions();

  select * into v_session
  from public.job_card_sessions
  where upper(join_code) = upper(btrim(p_join_code))
    and status = 'active'
    and expires_at > clock_timestamp()
  for update;
  if not found then raise exception 'This Live Job Card code is invalid or expired'; end if;

  if p_student_name is null or char_length(btrim(p_student_name)) = 0 then
    raise exception 'Student name is required';
  end if;
  if p_student_id is null or char_length(btrim(p_student_id)) = 0 then
    raise exception 'Student ID is required';
  end if;
  if p_evidence_type not in ('none','photo','measurement','inspection_test_result') then
    raise exception 'Invalid evidence type';
  end if;

  if coalesce((p_start_check->>'drawingReviewed')::boolean,false) is not true
     or coalesce((p_start_check->>'procedureReviewed')::boolean,false) is not true
     or coalesce((p_start_check->>'materialJointVerified')::boolean,false) is not true then
    raise exception 'Complete the Start Check before submitting';
  end if;

  if coalesce((p_quality_check->>'requirementsChecked')::boolean,false) is not true
     or coalesce((p_quality_check->>'correctionsRecorded')::boolean,false) is not true
     or coalesce((p_quality_check->>'readyForInstructor')::boolean,false) is not true then
    raise exception 'Complete the Quick Quality Check before submitting';
  end if;

  if jsonb_typeof(p_requirement_results) <> 'array'
     or jsonb_array_length(p_requirement_results) <> jsonb_array_length(v_session.requirements) then
    raise exception 'Student requirement results do not match this Job Card';
  end if;

  for v_req in select value from jsonb_array_elements(v_session.requirements)
  loop
    select value into v_result
    from jsonb_array_elements(p_requirement_results)
    where value->>'key' = v_req->>'key'
    limit 1;

    if v_result is null then
      raise exception 'A required Job Card result is missing';
    end if;

    v_status := lower(coalesce(v_result->>'status',''));
    if v_status not in ('pass','correct','na') then
      raise exception 'Every requirement must be Pass, Correct, or N/A';
    end if;

    if v_status <> 'na' and btrim(coalesce(v_result->>'actualValue','')) = '' then
      raise exception 'Student Actual is required unless the item is N/A';
    end if;

    if v_status = 'correct' and (
      btrim(coalesce(v_result->>'issue','')) = ''
      or btrim(coalesce(v_result->>'correction','')) = ''
      or btrim(coalesce(v_result->>'recheck','')) = ''
    ) then
      raise exception 'Corrected items require issue, correction, and recheck';
    end if;

    v_sanitized := v_sanitized || jsonb_build_array(jsonb_build_object(
      'key', v_req->>'key',
      'label', v_req->>'label',
      'requiredValue', v_req->>'requiredValue',
      'actualValue', case when v_status = 'na' then '' else coalesce(v_result->>'actualValue','') end,
      'status', v_status,
      'issue', case when v_status = 'correct' then coalesce(v_result->>'issue','') else '' end,
      'correction', case when v_status = 'correct' then coalesce(v_result->>'correction','') else '' end,
      'recheck', case when v_status = 'correct' then coalesce(v_result->>'recheck','') else '' end
    ));
  end loop;

  if exists (
    select 1
    from public.job_card_submissions
    where job_card_session_id = v_session.id
      and lower(btrim(student_id)) = lower(btrim(p_student_id))
  ) then
    raise exception 'A Job Card has already been submitted for this Student ID';
  end if;

  select count(*) into v_count
  from public.job_card_submissions
  where job_card_session_id = v_session.id;

  if v_count >= v_session.expected_students or v_count >= 17 then
    raise exception 'This Live Job Card has reached its student capacity';
  end if;

  insert into public.job_card_submissions(
    school_id, job_card_session_id, student_name, student_id,
    start_check, quality_check, requirement_results, evidence_type, evidence_note
  ) values (
    v_session.school_id, v_session.id, btrim(p_student_name), btrim(p_student_id),
    p_start_check, p_quality_check, v_sanitized, p_evidence_type, nullif(btrim(p_evidence_note),'')
  )
  returning id into v_submission_id;

  return v_submission_id;
end;
$$;

create or replace function public.review_job_card_submission(
  p_submission_id uuid,
  p_decision text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  v_submission public.job_card_submissions%rowtype;
  v_session public.job_card_sessions%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_decision not in ('accepted','correction_required') then
    raise exception 'Invalid instructor decision';
  end if;

  select * into v_submission
  from public.job_card_submissions
  where id = p_submission_id;
  if not found then raise exception 'Job Card submission not found'; end if;

  select * into v_session
  from public.job_card_sessions
  where id = v_submission.job_card_session_id;

  if not (v_session.instructor_id = v_uid or private.job_card_is_platform_owner(v_uid)) then
    raise exception 'You do not have permission to review this Job Card';
  end if;

  update public.job_card_submissions
  set review_decision = p_decision,
      review_notes = nullif(btrim(p_notes),''),
      reviewed_at = clock_timestamp(),
      reviewed_by = v_uid
  where id = p_submission_id;
end;
$$;

create or replace function public.end_job_card_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.job_card_sessions%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_session
  from public.job_card_sessions
  where id = p_session_id
  for update;
  if not found then raise exception 'Job Card session not found'; end if;

  if not (v_session.instructor_id = v_uid or private.job_card_is_platform_owner(v_uid)) then
    raise exception 'You do not have permission to end this Job Card session';
  end if;

  update public.job_card_sessions
  set status = case when status = 'active' then 'ended' else status end,
      ended_at = case when status = 'active' then clock_timestamp() else ended_at end
  where id = p_session_id;
end;
$$;

-- The Data API only needs authenticated read access to the instructor-facing tables.
-- Anonymous students interact exclusively through the two restricted RPCs below.
revoke all on public.job_card_templates from public, anon, authenticated;
revoke all on public.job_card_sessions from public, anon, authenticated;
revoke all on public.job_card_submissions from public, anon, authenticated;
grant select on public.job_card_templates to authenticated;
grant select on public.job_card_sessions to authenticated;
grant select on public.job_card_submissions to authenticated;
grant all on public.job_card_templates to service_role;
grant all on public.job_card_sessions to service_role;
grant all on public.job_card_submissions to service_role;

-- SECURITY DEFINER functions default to PUBLIC EXECUTE in PostgreSQL. Remove that
-- default and expose only the entry points each client role actually needs.
revoke all on function public.start_job_card_session(uuid,uuid,integer,integer,text,text,text,text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.end_job_card_session(uuid) from public, anon, authenticated;
revoke all on function public.review_job_card_submission(uuid,text,text) from public, anon, authenticated;
revoke all on function public.expire_job_card_sessions() from public, anon, authenticated;
revoke all on function public.get_job_card_by_code(text) from public, anon, authenticated;
revoke all on function public.submit_job_card(text,text,text,jsonb,jsonb,jsonb,text,text) from public, anon, authenticated;

grant execute on function public.start_job_card_session(uuid,uuid,integer,integer,text,text,text,text,text,text,text,jsonb) to authenticated, service_role;
grant execute on function public.end_job_card_session(uuid) to authenticated, service_role;
grant execute on function public.review_job_card_submission(uuid,text,text) to authenticated, service_role;
grant execute on function public.expire_job_card_sessions() to service_role;
grant execute on function public.get_job_card_by_code(text) to anon, authenticated, service_role;
grant execute on function public.submit_job_card(text,text,text,jsonb,jsonb,jsonb,text,text) to anon, authenticated, service_role;

-- Only submission changes are needed by the instructor's live Realtime panel.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'job_card_submissions'
     ) then
    alter publication supabase_realtime add table public.job_card_submissions;
  end if;
end;
$$;

insert into public.job_card_templates(
  school_id,
  template_key,
  name,
  description,
  default_requirements,
  system_defined,
  active
)
select
  null,
  'level_ii_live_job_card_v1',
  'Level II Live Job Card',
  'Reusable school-sized instructional Job Card. Instructor preloads the specific job requirements; students record actuals, checks, corrections, and evidence references.',
  '[]'::jsonb,
  true,
  true
where not exists (
  select 1
  from public.job_card_templates
  where school_id is null
    and template_key = 'level_ii_live_job_card_v1'
);
