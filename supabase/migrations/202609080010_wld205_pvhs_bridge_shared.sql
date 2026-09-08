-- WLD-205 PVHS BRIDGE DAYS 2-9 — ONE-PUSH LIVE CLASSROOM BUNDLE
-- STAGED FOR REVIEW. Intended to supersede the earlier separate Day 3/5/7/9 staging packages.
-- Source basis: WLD205_Level_II_55_Day_23_DAY_CORE_PVHS_PROJECT_EXTENSION_FINAL_v12.
-- No secure AWS assessment content is reproduced here.

alter table public.assessment_modules
  add column if not exists reference_title text,
  add column if not exists reference_image_url text,
  add column if not exists reference_body text,
  add column if not exists show_student_score boolean not null default true;

create or replace function public.get_classroom_assessment(p_join_code text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  s public.classroom_sessions;
  payload jsonb;
begin
  select * into s
  from public.classroom_sessions
  where join_code=upper(trim(p_join_code))
    and status='active'
    and expires_at>now();

  if s.id is null then
    raise exception 'This class code is invalid or the session has ended';
  end if;

  select jsonb_build_object(
    'session',jsonb_build_object(
      'session_id',s.id,
      'session_name','Live Welding Class',
      'assessment_title',m.title,
      'question_count',count(q.id),
      'expected_students',s.expected_students,
      'instructions',m.instructions,
      'allow_team_members',m.allow_team_members,
      'reference_title',m.reference_title,
      'reference_image_url',m.reference_image_url,
      'reference_body',m.reference_body,
      'show_student_score',m.show_student_score
    ),
    'questions',coalesce(
      jsonb_agg(
        jsonb_build_object(
          'key',q.question_key,
          'number',q.question_number,
          'type',q.question_type,
          'text',q.question_text,
          'domain',q.domain,
          'options',q.options
        )
        order by q.question_number
      ),
      '[]'::jsonb
    )
  )
  into payload
  from public.assessment_modules m
  join public.assessment_questions q on q.assessment_slug=m.slug
  where m.slug=s.assessment_slug
  group by
    m.title,m.instructions,m.allow_team_members,
    m.reference_title,m.reference_image_url,m.reference_body,
    m.show_student_score;

  return payload;
end
$$;

revoke execute on function public.get_classroom_assessment(text)
  from public,anon,authenticated;
grant execute on function public.get_classroom_assessment(text)
  to anon,authenticated;

-- Fail loudly if the current PVHS WLD-205 Days 2-9 guide cannot be uniquely identified.
do $$
declare
  target_count integer;
  target_guide uuid;
  day_count integer;
begin
  select count(distinct d.guide_id), min(d.guide_id)
    into target_count, target_guide
  from public.course_guide_days d
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and d.planner_day_number=2
    and d.title='PVHS Bridge - Math Recovery I: Measurement, Fractions + Mixed Numbers';

  if target_count <> 1 then
    raise exception 'Expected exactly one current PVHS WLD-205 bridge guide; found %', target_count;
  end if;

  select count(*) into day_count
  from public.course_guide_days d
  where d.guide_id=target_guide
    and d.planner_day_number between 2 and 9;

  if day_count <> 8 then
    raise exception 'Current PVHS WLD-205 guide does not contain all Days 2-9; found % days', day_count;
  end if;
end
$$;
