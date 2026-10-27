-- LTG Student Gradebook / Progress
-- Additive grading metadata and read/reporting APIs for Live Classroom evidence.
-- Existing classroom sessions remain Practice Only by default so no historical
-- activity is silently converted into an official grade.

create schema if not exists private;

alter table public.classroom_sessions
  add column if not exists grade_category text not null default 'practice_only',
  add column if not exists counts_toward_grade boolean not null default false;

alter table public.classroom_sessions
  drop constraint if exists classroom_sessions_grade_category_check;
alter table public.classroom_sessions
  add constraint classroom_sessions_grade_category_check
  check (grade_category in ('practice_only','test','quiz','task','activity','practical','competency'));

alter table public.classroom_submissions
  add column if not exists attendance_student_id uuid references public.attendance_students(id) on delete set null;
alter table public.job_card_submissions
  add column if not exists attendance_student_id uuid references public.attendance_students(id) on delete set null;

create index if not exists classroom_submissions_attendance_student_idx on public.classroom_submissions(attendance_student_id);
create index if not exists classroom_sessions_section_started_grade_idx on public.classroom_sessions(section_id, started_at desc, grade_category);
create index if not exists job_card_submissions_attendance_student_idx on public.job_card_submissions(attendance_student_id);

create table if not exists private.course_grade_settings (
  course_id uuid primary key references public.courses(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  weights jsonb not null default '{}'::jsonb,
  calculation_method text not null default 'mean_percent' check (calculation_method in ('mean_percent')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default clock_timestamp(),
  constraint course_grade_settings_weights_object check (jsonb_typeof(weights) = 'object')
);
revoke all on table private.course_grade_settings from public, anon, authenticated;

create or replace function private.resolve_attendance_student_for_section(p_school_id uuid,p_section_id uuid,p_external_student_id text)
returns uuid language sql stable security definer set search_path to '' as $$
  with matches as (
    select distinct s.id
    from public.attendance_pairs p
    join public.attendance_pair_enrollments e on e.pair_id=p.id and e.school_id=p.school_id and e.active=true
    join public.attendance_students s on s.id=e.student_id and s.school_id=p.school_id and s.active=true
    where p.school_id=p_school_id and p.active=true
      and p_section_id in (p.primary_section_id,p.completion_section_id)
      and s.external_student_id is not null
      and lower(btrim(s.external_student_id))=lower(btrim(p_external_student_id))
  )
  select case when count(*)=1 then (array_agg(id))[1] else null end from matches;
$$;
revoke all on function private.resolve_attendance_student_for_section(uuid,uuid,text) from public, anon, authenticated;

create or replace function private.link_classroom_submission_student()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_school_id uuid; v_section_id uuid;
begin
  select s.school_id,s.section_id into v_school_id,v_section_id from public.classroom_sessions s where s.id=new.classroom_session_id;
  if v_school_id is not null then
    new.attendance_student_id:=private.resolve_attendance_student_for_section(v_school_id,v_section_id,new.student_id);
  end if;
  return new;
end; $$;

create or replace function private.link_job_card_submission_student()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_school_id uuid; v_section_id uuid;
begin
  select s.school_id,s.section_id into v_school_id,v_section_id from public.job_card_sessions s where s.id=new.job_card_session_id;
  if v_school_id is not null then
    new.attendance_student_id:=private.resolve_attendance_student_for_section(v_school_id,v_section_id,new.student_id);
  end if;
  return new;
end; $$;
revoke all on function private.link_classroom_submission_student() from public, anon, authenticated;
revoke all on function private.link_job_card_submission_student() from public, anon, authenticated;

drop trigger if exists classroom_submission_link_student on public.classroom_submissions;
create trigger classroom_submission_link_student before insert or update of classroom_session_id,student_id on public.classroom_submissions for each row execute function private.link_classroom_submission_student();
drop trigger if exists job_card_submission_link_student on public.job_card_submissions;
create trigger job_card_submission_link_student before insert or update of job_card_session_id,student_id on public.job_card_submissions for each row execute function private.link_job_card_submission_student();

update public.classroom_submissions sub
set attendance_student_id=private.resolve_attendance_student_for_section(sess.school_id,sess.section_id,sub.student_id)
from public.classroom_sessions sess
where sess.id=sub.classroom_session_id and sub.attendance_student_id is null;

update public.job_card_submissions sub
set attendance_student_id=private.resolve_attendance_student_for_section(sess.school_id,sess.section_id,sub.student_id)
from public.job_card_sessions sess
where sess.id=sub.job_card_session_id and sub.attendance_student_id is null;

create or replace function public.start_classroom_session_v3(
  p_section_id uuid,
  p_assessment_slug text default 'preclass_math',
  p_expected_students integer default 17,
  p_grade_category text default 'practice_only'
)
returns uuid language plpgsql security definer set search_path to '' as $$
declare v_id uuid; v_category text:=lower(btrim(coalesce(p_grade_category,'practice_only')));
begin
  if auth.uid() is null then raise exception 'Instructor login required'; end if;
  if v_category not in ('practice_only','test','quiz','task','activity','practical','competency') then raise exception 'Invalid grade category'; end if;
  v_id:=public.start_classroom_session_v2(p_section_id,p_assessment_slug,p_expected_students);
  update public.classroom_sessions
  set grade_category=v_category,counts_toward_grade=v_category in ('test','quiz','task','activity','practical')
  where id=v_id and instructor_id=auth.uid();
  return v_id;
end; $$;
revoke all on function public.start_classroom_session_v3(uuid,text,integer,text) from public, anon, authenticated;
grant execute on function public.start_classroom_session_v3(uuid,text,integer,text) to authenticated;

create or replace function public.set_classroom_session_grade_category(p_session_id uuid,p_grade_category text)
returns void language plpgsql security definer set search_path to '' as $$
declare v_session public.classroom_sessions%rowtype; v_category text:=lower(btrim(coalesce(p_grade_category,'practice_only')));
begin
  if auth.uid() is null then raise exception 'Instructor login required'; end if;
  if v_category not in ('practice_only','test','quiz','task','activity','practical','competency') then raise exception 'Invalid grade category'; end if;
  select * into v_session from public.classroom_sessions where id=p_session_id;
  if not found then raise exception 'Classroom session not found'; end if;
  if v_session.instructor_id<>auth.uid() and not public.can_manage_school(v_session.school_id) and not public.is_platform_owner() then
    raise exception 'You do not have permission to classify this grade item';
  end if;
  update public.classroom_sessions
  set grade_category=v_category,counts_toward_grade=v_category in ('test','quiz','task','activity','practical')
  where id=p_session_id;
end; $$;
revoke all on function public.set_classroom_session_grade_category(uuid,text) from public, anon, authenticated;
grant execute on function public.set_classroom_session_grade_category(uuid,text) to authenticated;

create or replace function public.save_course_grade_settings(p_course_id uuid,p_weights jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_school_id uuid; v_total numeric:=0; v_key text; v_value jsonb; v_weights jsonb:=coalesce(p_weights,'{}'::jsonb);
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  select school_id into v_school_id from public.courses where id=p_course_id;
  if v_school_id is null then raise exception 'Course not found'; end if;
  if not public.can_manage_school(v_school_id) and not public.is_platform_owner() then raise exception 'School or program administrator access required'; end if;
  if jsonb_typeof(v_weights)<>'object' then raise exception 'Grade weights must be an object'; end if;
  for v_key,v_value in select key,value from jsonb_each(v_weights) loop
    if v_key not in ('test','quiz','task','activity','practical') then raise exception 'Unsupported grade category: %',v_key; end if;
    if jsonb_typeof(v_value)<>'number' then raise exception 'Each grade weight must be numeric'; end if;
    if (v_value#>>'{}')::numeric<0 or (v_value#>>'{}')::numeric>100 then raise exception 'Each grade weight must be between 0 and 100'; end if;
    v_total:=v_total+(v_value#>>'{}')::numeric;
  end loop;
  if v_weights<>'{}'::jsonb and v_total<>100 then raise exception 'Grade weights must total 100 percent'; end if;
  insert into private.course_grade_settings(course_id,school_id,weights,updated_by,updated_at)
  values(p_course_id,v_school_id,v_weights,auth.uid(),clock_timestamp())
  on conflict(course_id) do update set school_id=excluded.school_id,weights=excluded.weights,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  return jsonb_build_object('course_id',p_course_id,'weights',v_weights,'total',v_total);
end; $$;
revoke all on function public.save_course_grade_settings(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.save_course_grade_settings(uuid,jsonb) to authenticated;

create or replace function public.get_section_gradebook(p_section_id uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  v_school_id uuid; v_course_id uuid; v_section_name text; v_course_code text; v_course_name text;
  v_can_manage boolean:=false; v_weights jsonb:='{}'::jsonb; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  select s.school_id,s.course_id,s.section_name,c.course_code,c.course_name
  into v_school_id,v_course_id,v_section_name,v_course_code,v_course_name
  from public.sections s join public.courses c on c.id=s.course_id where s.id=p_section_id;
  if v_school_id is null then raise exception 'Class section not found'; end if;
  v_can_manage:=public.can_manage_school(v_school_id) or public.is_platform_owner();
  if not v_can_manage and not public.is_section_instructor(v_school_id,p_section_id) then raise exception 'You do not have permission to view this gradebook'; end if;
  select coalesce(g.weights,'{}'::jsonb) into v_weights from private.course_grade_settings g where g.course_id=v_course_id;
  v_weights:=coalesce(v_weights,'{}'::jsonb);

  select jsonb_build_object(
    'section',jsonb_build_object('section_id',p_section_id,'section_name',v_section_name,'course_id',v_course_id,'course_code',v_course_code,'course_name',v_course_name),
    'can_manage_grading',v_can_manage,
    'grading',jsonb_build_object('weights',v_weights,'configured',v_weights<>'{}'::jsonb,'calculation_method','mean_percent'),
    'roster',coalesce((select jsonb_agg(r order by r->>'display_name') from (
      select distinct jsonb_build_object('attendance_student_id',st.id,'display_name',st.display_name,'external_student_id',st.external_student_id) r
      from public.attendance_pairs p
      join public.attendance_pair_enrollments e on e.pair_id=p.id and e.school_id=p.school_id and e.active=true
      join public.attendance_students st on st.id=e.student_id and st.school_id=p.school_id and st.active=true
      where p.school_id=v_school_id and p.active=true and p_section_id in (p.primary_section_id,p.completion_section_id)
    ) x),'[]'::jsonb),
    'sessions',coalesce((select jsonb_agg(jsonb_build_object(
      'session_id',sess.id,'assessment_slug',sess.assessment_slug,'assessment_title',coalesce(m.title,sess.assessment_slug),
      'grade_category',sess.grade_category,'counts_toward_grade',sess.counts_toward_grade,'status',sess.status,
      'started_at',sess.started_at,'ended_at',sess.ended_at,
      'submission_count',(select count(*) from public.classroom_submissions sx where sx.classroom_session_id=sess.id),
      'class_average',(select round(avg(100.0*sx.score/greatest(sx.possible_score,1)),1) from public.classroom_submissions sx where sx.classroom_session_id=sess.id),
      'can_reclassify',(sess.instructor_id=auth.uid() or v_can_manage)
    ) order by sess.started_at desc) from public.classroom_sessions sess left join public.assessment_modules m on m.slug=sess.assessment_slug where sess.section_id=p_section_id),'[]'::jsonb),
    'submissions',coalesce((select jsonb_agg(jsonb_build_object(
      'submission_id',sub.id,'session_id',sess.id,'attendance_student_id',sub.attendance_student_id,
      'student_name',sub.student_name,'student_id',sub.student_id,'assessment_slug',sess.assessment_slug,
      'assessment_title',coalesce(m.title,sess.assessment_slug),'grade_category',sess.grade_category,
      'counts_toward_grade',sess.counts_toward_grade,'score',sub.score,'possible_score',sub.possible_score,
      'percent',round(100.0*sub.score/greatest(sub.possible_score,1),1),'domain_scores',sub.domain_scores,'submitted_at',sub.submitted_at
    ) order by sub.submitted_at desc) from public.classroom_submissions sub join public.classroom_sessions sess on sess.id=sub.classroom_session_id left join public.assessment_modules m on m.slug=sess.assessment_slug where sess.section_id=p_section_id),'[]'::jsonb),
    'job_card_evidence',coalesce((select jsonb_agg(jsonb_build_object(
      'submission_id',sub.id,'attendance_student_id',sub.attendance_student_id,'student_name',sub.student_name,
      'student_id',sub.student_id,'job_title',sess.job_title,'planner_day_number',sess.planner_day_number,
      'review_decision',sub.review_decision,'review_notes',sub.review_notes,'evidence_type',sub.evidence_type,
      'submitted_at',sub.submitted_at,'reviewed_at',sub.reviewed_at
    ) order by sub.submitted_at desc) from public.job_card_submissions sub join public.job_card_sessions sess on sess.id=sub.job_card_session_id where sess.section_id=p_section_id),'[]'::jsonb)
  ) into v_result;
  return v_result;
end; $$;
revoke all on function public.get_section_gradebook(uuid) from public, anon, authenticated;
grant execute on function public.get_section_gradebook(uuid) to authenticated;
