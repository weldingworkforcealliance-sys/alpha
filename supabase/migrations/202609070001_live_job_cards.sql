-- LTG Live Job Card
-- Additive only. Does not modify approved curriculum or approved course outcomes.

create extension if not exists pgcrypto;

create table if not exists public.job_card_templates (
  slug text primary key,
  title text not null,
  description text,
  estimated_student_minutes integer not null default 5,
  default_requirement_labels jsonb not null default '[]'::jsonb,
  start_checks jsonb not null default '[]'::jsonb,
  quality_checks jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  constraint job_card_templates_minutes_check check (estimated_student_minutes between 1 and 30),
  constraint job_card_templates_requirement_labels_array check (jsonb_typeof(default_requirement_labels) = 'array'),
  constraint job_card_templates_start_checks_array check (jsonb_typeof(start_checks) = 'array'),
  constraint job_card_templates_quality_checks_array check (jsonb_typeof(quality_checks) = 'array')
);

create table if not exists public.job_card_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  section_id uuid not null references public.sections(id) on delete restrict,
  instructor_id uuid not null references auth.users(id) on delete restrict,
  template_slug text not null references public.job_card_templates(slug) on delete restrict,
  guide_day_id uuid null references public.course_guide_days(id) on delete set null,
  join_code text not null unique,
  status text not null default 'active' check (status in ('active','ended')),
  expected_students integer not null default 17,
  job_header jsonb not null,
  requirements jsonb not null,
  start_checks jsonb not null,
  quality_checks jsonb not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  expires_at timestamptz not null default (now() + interval '12 hours'),
  constraint job_card_sessions_expected_students_check check (expected_students between 1 and 17),
  constraint job_card_sessions_job_header_object check (jsonb_typeof(job_header) = 'object'),
  constraint job_card_sessions_requirements_array check (jsonb_typeof(requirements) = 'array'),
  constraint job_card_sessions_start_checks_array check (jsonb_typeof(start_checks) = 'array'),
  constraint job_card_sessions_quality_checks_array check (jsonb_typeof(quality_checks) = 'array')
);

create table if not exists public.job_card_submissions (
  id uuid primary key default gen_random_uuid(),
  job_card_session_id uuid not null references public.job_card_sessions(id) on delete restrict,
  student_name text not null,
  student_id text not null,
  actual_values jsonb not null default '{}'::jsonb,
  requirement_checks jsonb not null default '{}'::jsonb,
  start_check_confirmations jsonb not null default '{}'::jsonb,
  quality_check_confirmations jsonb not null default '{}'::jsonb,
  issue_found text,
  correction text,
  recheck_status text check (recheck_status in ('pass','needs_more_work')),
  evidence_types jsonb not null default '[]'::jsonb,
  evidence_note text,
  submitted_at timestamptz not null default now(),
  final_decision text check (final_decision in ('pass_move_on','continue_practice','rework_retry')),
  instructor_note text,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  unique(job_card_session_id,student_id),
  constraint job_card_submissions_actual_values_object check (jsonb_typeof(actual_values) = 'object'),
  constraint job_card_submissions_requirement_checks_object check (jsonb_typeof(requirement_checks) = 'object'),
  constraint job_card_submissions_start_checks_object check (jsonb_typeof(start_check_confirmations) = 'object'),
  constraint job_card_submissions_quality_checks_object check (jsonb_typeof(quality_check_confirmations) = 'object'),
  constraint job_card_submissions_evidence_types_array check (jsonb_typeof(evidence_types) = 'array')
);

create index if not exists job_card_sessions_school_id_idx on public.job_card_sessions(school_id);
create index if not exists job_card_sessions_section_id_idx on public.job_card_sessions(section_id);
create index if not exists job_card_sessions_instructor_id_idx on public.job_card_sessions(instructor_id);
create index if not exists job_card_sessions_status_expires_idx on public.job_card_sessions(status,expires_at);
create unique index if not exists job_card_sessions_one_active_per_section_uq
  on public.job_card_sessions(section_id) where status = 'active';
create index if not exists job_card_submissions_session_idx on public.job_card_submissions(job_card_session_id);
create index if not exists job_card_submissions_reviewed_idx on public.job_card_submissions(job_card_session_id,reviewed_at);

alter table public.job_card_templates enable row level security;
alter table public.job_card_sessions enable row level security;
alter table public.job_card_submissions enable row level security;

revoke all on public.job_card_templates from anon,authenticated;
revoke all on public.job_card_sessions from anon,authenticated;
revoke all on public.job_card_submissions from anon,authenticated;

grant select on public.job_card_sessions to authenticated;
grant select on public.job_card_submissions to authenticated;

drop policy if exists job_card_templates_no_direct_access on public.job_card_templates;
create policy job_card_templates_no_direct_access on public.job_card_templates
for all to anon,authenticated using (false) with check (false);

drop policy if exists job_card_sessions_instructor_read on public.job_card_sessions;
create policy job_card_sessions_instructor_read on public.job_card_sessions
for select to authenticated
using (instructor_id = (select auth.uid()) or (select public.is_platform_owner()));

drop policy if exists job_card_submissions_instructor_read on public.job_card_submissions;
create policy job_card_submissions_instructor_read on public.job_card_submissions
for select to authenticated
using (
  exists (
    select 1
    from public.job_card_sessions s
    where s.id = job_card_session_id
      and (s.instructor_id = (select auth.uid()) or (select public.is_platform_owner()))
  )
);

create or replace function public.make_job_card_join_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare code text;
begin
  loop
    code := upper(substr(encode(extensions.gen_random_bytes(6),'hex'),1,6));
    exit when not exists(select 1 from public.job_card_sessions where join_code = code)
      and not exists(select 1 from public.classroom_sessions where join_code = code);
  end loop;
  return code;
end
$$;

create or replace function public.list_job_card_templates()
returns table(slug text,title text,description text,estimated_student_minutes integer,default_requirement_labels jsonb,start_checks jsonb,quality_checks jsonb,version integer)
language sql security definer stable set search_path = '' as $$
  select t.slug,t.title,t.description,t.estimated_student_minutes,t.default_requirement_labels,t.start_checks,t.quality_checks,t.version
  from public.job_card_templates t where t.active order by t.title
$$;

create or replace function public.expire_job_card_sessions()
returns integer language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  if auth.uid() is null then raise exception 'Instructor login required'; end if;
  update public.job_card_sessions s set status='ended', ended_at=coalesce(s.ended_at,now())
  where s.status='active' and s.expires_at<=now();
  get diagnostics affected = row_count;
  return affected;
end
$$;

create or replace function public.start_job_card_session(
  p_section_id uuid,p_template_slug text,p_job_header jsonb,p_requirements jsonb,p_expected_students integer default 17,p_guide_day_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare result_id uuid; target_school uuid; template_row public.job_card_templates; requirement_row jsonb; requirement_keys text[] := '{}';
begin
  if auth.uid() is null then raise exception 'Instructor login required'; end if;
  if p_expected_students < 1 or p_expected_students > 17 then raise exception 'Expected students must be between 1 and 17'; end if;
  if jsonb_typeof(p_job_header) <> 'object' then raise exception 'Job header must be an object'; end if;
  if jsonb_typeof(p_requirements) <> 'array' or jsonb_array_length(p_requirements) < 1 or jsonb_array_length(p_requirements) > 4 then raise exception 'Use between 1 and 4 critical requirements'; end if;
  for requirement_row in select value from jsonb_array_elements(p_requirements) loop
    if length(trim(coalesce(requirement_row->>'key',''))) < 1 then raise exception 'Every critical requirement needs a stable key'; end if;
    if length(trim(coalesce(requirement_row->>'label',''))) < 2 then raise exception 'Every critical requirement needs a label'; end if;
    if length(trim(coalesce(requirement_row->>'required',''))) < 1 then raise exception 'Every critical requirement needs a required value or N/A'; end if;
    if trim(requirement_row->>'key') = any(requirement_keys) then raise exception 'Critical requirement keys must be unique'; end if;
    requirement_keys := array_append(requirement_keys, trim(requirement_row->>'key'));
  end loop;
  select s.school_id into target_school from public.sections s where s.id=p_section_id;
  if target_school is null then raise exception 'Class not found'; end if;
  if not exists(select 1 from public.current_teaching_sections cts where cts.section_id=p_section_id) and not public.is_platform_owner() then raise exception 'You are not assigned to this class'; end if;
  select * into template_row from public.job_card_templates t where t.slug=p_template_slug and t.active;
  if template_row.slug is null then raise exception 'Job card template is not available'; end if;
  if p_guide_day_id is not null and not exists(
    select 1 from public.course_guide_days d join public.sections sec on sec.course_id=d.course_id where d.id=p_guide_day_id and sec.id=p_section_id
  ) then raise exception 'Planner day does not belong to the selected class course'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_section_id::text,0));
  perform public.expire_job_card_sessions();
  if exists(select 1 from public.job_card_sessions s where s.section_id=p_section_id and s.status='active') then
    raise exception 'This class already has an active Live Job Card session';
  end if;
  insert into public.job_card_sessions(school_id,section_id,instructor_id,template_slug,guide_day_id,join_code,expected_students,job_header,requirements,start_checks,quality_checks)
  values(target_school,p_section_id,auth.uid(),template_row.slug,p_guide_day_id,public.make_job_card_join_code(),p_expected_students,p_job_header,p_requirements,template_row.start_checks,template_row.quality_checks)
  returning id into result_id;
  return result_id;
end
$$;

create or replace function public.end_job_card_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.job_card_sessions s set status='ended',ended_at=now() where s.id=p_session_id and (s.instructor_id=auth.uid() or public.is_platform_owner());
  if not found then raise exception 'Session not found or permission denied'; end if;
end
$$;

create or replace function public.get_live_job_card(p_join_code text)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare s public.job_card_sessions; template_title text; class_label text;
begin
  select * into s from public.job_card_sessions jcs where jcs.join_code=upper(trim(p_join_code)) and jcs.status='active' and jcs.expires_at>now();
  if s.id is null then raise exception 'This job card code is invalid or the session has ended'; end if;
  select t.title into template_title from public.job_card_templates t where t.slug=s.template_slug;
  select concat_ws(' · ',c.course_code,coalesce(sec.section_name,sec.section_code)) into class_label
  from public.sections sec join public.courses c on c.id=sec.course_id where sec.id=s.section_id;
  return jsonb_build_object('session',jsonb_build_object('session_id',s.id,'template_title',template_title,'expected_students',s.expected_students,'class_label',class_label,'started_at',s.started_at,'job_header',s.job_header,'requirements',s.requirements,'start_checks',s.start_checks,'quality_checks',s.quality_checks,'expires_at',s.expires_at));
end
$$;

create or replace function public.submit_live_job_card(
  p_join_code text,p_student_name text,p_student_id text,p_actual_values jsonb,p_requirement_checks jsonb,p_start_check_confirmations jsonb,p_quality_check_confirmations jsonb,p_issue_found text default null,p_correction text default null,p_recheck_status text default null,p_evidence_types jsonb default '[]'::jsonb,p_evidence_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare s public.job_card_sessions; result_id uuid; req jsonb; req_key text; check_value text; check_label text; correction_required boolean:=false; evidence_value text; submission_count integer;
begin
  if length(trim(coalesce(p_student_name,''))) < 2 or length(trim(coalesce(p_student_id,''))) < 1 then raise exception 'Student name and ID are required'; end if;
  if jsonb_typeof(p_actual_values)<>'object' or jsonb_typeof(p_requirement_checks)<>'object' or jsonb_typeof(p_start_check_confirmations)<>'object' or jsonb_typeof(p_quality_check_confirmations)<>'object' or jsonb_typeof(p_evidence_types)<>'array' then raise exception 'Job card submission format is invalid'; end if;
  select * into s from public.job_card_sessions jcs where jcs.join_code=upper(trim(p_join_code)) and jcs.status='active' and jcs.expires_at>now() for update;
  if s.id is null then raise exception 'This job card session has ended'; end if;
  if exists(select 1 from public.job_card_submissions sub where sub.job_card_session_id=s.id and lower(trim(sub.student_id))=lower(trim(p_student_id))) then raise exception 'This Student ID has already submitted this job card'; end if;
  select count(*) into submission_count from public.job_card_submissions sub where sub.job_card_session_id=s.id;
  if submission_count >= s.expected_students or submission_count >= 17 then
    raise exception 'This Live Job Card has reached its student capacity';
  end if;
  for req in select value from jsonb_array_elements(s.requirements) loop
    req_key:=req->>'key';
    if length(coalesce(req_key,''))<1 then raise exception 'Job card requirement configuration is invalid'; end if;
    check_value:=lower(trim(coalesce(p_requirement_checks->>req_key,'')));
    if check_value not in ('pass','correct','na') then raise exception 'Every critical requirement must be marked Pass, Correct, or N/A'; end if;
    if check_value<>'na' and length(trim(coalesce(p_actual_values->>req_key,'')))<1 then raise exception 'Enter the actual value for every applicable critical requirement'; end if;
    if check_value='correct' then correction_required:=true; end if;
  end loop;
  for check_label in select jsonb_array_elements_text(s.start_checks) loop
    if coalesce((p_start_check_confirmations->>check_label)::boolean,false) is not true then raise exception 'Complete every Start Check before submitting'; end if;
  end loop;
  for check_label in select jsonb_array_elements_text(s.quality_checks) loop
    if coalesce((p_quality_check_confirmations->>check_label)::boolean,false) is not true then raise exception 'Complete every Quick Quality Check before submitting'; end if;
  end loop;
  if correction_required then
    if length(trim(coalesce(p_issue_found,'')))<2 or length(trim(coalesce(p_correction,'')))<2 then raise exception 'Describe the issue and correction when a requirement needed correction'; end if;
    if p_recheck_status not in ('pass','needs_more_work') then raise exception 'Record the recheck result after a correction'; end if;
  end if;
  for evidence_value in select jsonb_array_elements_text(p_evidence_types) loop
    if evidence_value not in ('photo','measurement','inspection_test_result') then raise exception 'Evidence selection is invalid'; end if;
  end loop;
  insert into public.job_card_submissions(job_card_session_id,student_name,student_id,actual_values,requirement_checks,start_check_confirmations,quality_check_confirmations,issue_found,correction,recheck_status,evidence_types,evidence_note)
  values(s.id,trim(p_student_name),trim(p_student_id),p_actual_values,p_requirement_checks,p_start_check_confirmations,p_quality_check_confirmations,nullif(trim(coalesce(p_issue_found,'')),''),nullif(trim(coalesce(p_correction,'')),''),case when correction_required then p_recheck_status else null end,p_evidence_types,nullif(trim(coalesce(p_evidence_note,'')),'')) returning id into result_id;
  return result_id;
end
$$;

create or replace function public.review_job_card_submission(p_submission_id uuid,p_final_decision text,p_instructor_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Instructor login required'; end if;
  if p_final_decision not in ('pass_move_on','continue_practice','rework_retry') then raise exception 'Instructor decision is invalid'; end if;
  update public.job_card_submissions sub set final_decision=p_final_decision,instructor_note=nullif(trim(coalesce(p_instructor_note,'')),''),reviewed_by=auth.uid(),reviewed_at=now()
  from public.job_card_sessions s where sub.id=p_submission_id and s.id=sub.job_card_session_id and (s.instructor_id=auth.uid() or public.is_platform_owner());
  if not found then raise exception 'Submission not found or permission denied'; end if;
end
$$;

revoke execute on function public.make_job_card_join_code() from public,anon,authenticated;
revoke execute on function public.list_job_card_templates() from public,anon,authenticated;
revoke execute on function public.expire_job_card_sessions() from public,anon,authenticated;
revoke execute on function public.start_job_card_session(uuid,text,jsonb,jsonb,integer,uuid) from public,anon,authenticated;
revoke execute on function public.end_job_card_session(uuid) from public,anon,authenticated;
revoke execute on function public.get_live_job_card(text) from public,anon,authenticated;
revoke execute on function public.submit_live_job_card(text,text,text,jsonb,jsonb,jsonb,jsonb,text,text,text,jsonb,text) from public,anon,authenticated;
revoke execute on function public.review_job_card_submission(uuid,text,text) from public,anon,authenticated;

grant execute on function public.list_job_card_templates() to authenticated;
grant execute on function public.expire_job_card_sessions() to authenticated;
grant execute on function public.start_job_card_session(uuid,text,jsonb,jsonb,integer,uuid) to authenticated;
grant execute on function public.end_job_card_session(uuid) to authenticated;
grant execute on function public.get_live_job_card(text) to anon,authenticated;
grant execute on function public.submit_live_job_card(text,text,text,jsonb,jsonb,jsonb,jsonb,text,text,text,jsonb,text) to anon,authenticated;
grant execute on function public.review_job_card_submission(uuid,text,text) to authenticated;

insert into public.job_card_templates(slug,title,description,estimated_student_minutes,default_requirement_labels,start_checks,quality_checks,active,version)
values('level2_school_job_card','PCCC Level II Live Job Card','School-sized 3-5 minute requirement-to-evidence job card for Level II welding instruction.',5,
  '["Machine setting / welding variable","Fit-up / root opening / bevel","Critical job dimension","Final dimension / acceptance item"]'::jsonb,
  '["Material matches job / drawing","WPS/SWPS checked","Fit-up within requirement","PPE / work area ready","Correct process / polarity / gas","Position verified"]'::jsonb,
  '["Critical dimensions within requirement","Visual condition acceptable","Ready for instructor review"]'::jsonb,true,1)
on conflict(slug) do update set title=excluded.title,description=excluded.description,estimated_student_minutes=excluded.estimated_student_minutes,default_requirement_labels=excluded.default_requirement_labels,start_checks=excluded.start_checks,quality_checks=excluded.quality_checks,active=true,version=excluded.version;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='job_card_submissions') then
    alter publication supabase_realtime add table public.job_card_submissions;
  end if;
end
$$;
