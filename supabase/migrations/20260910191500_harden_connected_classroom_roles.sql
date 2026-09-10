-- LTG stabilization: keep Connected Classroom launch and answer-key access
-- limited to staff who actually have instructional authority. The
-- current_teaching_sections view intentionally supports broader school-member
-- visibility, so it must not be used as the authorization boundary for
-- privileged classroom actions.

begin;

create or replace function public.start_classroom_session_v2(
  p_section_id uuid,
  p_assessment_slug text default 'preclass_math'::text,
  p_expected_students integer default 17
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid;
  target_school uuid;
begin
  if auth.uid() is null then
    raise exception 'Instructor login required';
  end if;
  if p_expected_students < 1 or p_expected_students > 60 then
    raise exception 'Expected students must be between 1 and 60';
  end if;

  -- Opportunistically close this instructor's expired sessions before creating a new one.
  update public.classroom_sessions
     set status = 'ended',
         ended_at = coalesce(ended_at, expires_at)
   where instructor_id = auth.uid()
     and status = 'active'
     and expires_at <= now();

  select school_id into target_school
  from public.sections
  where id = p_section_id;

  if target_school is null then
    raise exception 'Class not found';
  end if;

  -- Classroom launch is section-scoped. Platform Owner and school instructional
  -- management may launch any section in scope; ordinary instructors/assistants
  -- must have an active assignment to this section.
  if not (
    public.is_platform_owner()
    or public.can_review_instruction(target_school)
    or public.is_section_instructor(target_school, p_section_id)
  ) then
    raise exception 'Assigned instructor or school management access required';
  end if;

  if not exists (
    select 1
    from public.assessment_modules
    where slug = p_assessment_slug
      and active
  ) then
    raise exception 'Assessment is not available';
  end if;

  update public.classroom_sessions
     set status = 'ended',
         ended_at = now()
   where instructor_id = auth.uid()
     and section_id = p_section_id
     and status = 'active';

  insert into public.classroom_sessions(
    school_id,
    section_id,
    instructor_id,
    assessment_slug,
    join_code,
    expected_students
  )
  values(
    target_school,
    p_section_id,
    auth.uid(),
    p_assessment_slug,
    public.make_classroom_join_code(),
    p_expected_students
  )
  returning id into result_id;

  return result_id;
end;
$$;

create or replace function public.get_assessment_answer_key(
  p_assessment_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'Instructor login required';
  end if;

  -- Answer keys are instructor-only. School instructional management can review
  -- them without a section assignment; ordinary teaching staff must have an
  -- active section assignment at an active school membership.
  if not public.is_platform_owner()
     and not exists (
       select 1
       from public.school_memberships sm
       where sm.user_id = auth.uid()
         and sm.status = 'active'
         and sm.role in ('school_admin','program_lead','lead_instructor')
     )
     and not exists (
       select 1
       from public.section_instructors si
       join public.school_memberships sm
         on sm.school_id = si.school_id
        and sm.user_id = si.instructor_id
        and sm.status = 'active'
       where si.instructor_id = auth.uid()
         and si.active = true
     ) then
    raise exception 'Active instructor assignment or school management access required';
  end if;

  select jsonb_build_object(
    'assessment',jsonb_build_object(
      'slug',m.slug,
      'title',m.title,
      'instructions',m.instructions
    ),
    'questions',coalesce(
      jsonb_agg(
        jsonb_build_object(
          'key',q.question_key,
          'number',q.question_number,
          'domain',q.domain,
          'text',q.question_text,
          'options',q.options,
          'correct_answer',q.correct_answer,
          'accepted_answers',q.accepted_answers,
          'explanation',q.explanation
        )
        order by q.question_number
      ),
      '[]'::jsonb
    )
  )
  into payload
  from public.assessment_modules m
  left join public.assessment_questions q on q.assessment_slug=m.slug
  where m.slug=p_assessment_slug and m.active
  group by m.slug,m.title,m.instructions;

  if payload is null then
    raise exception 'Assessment not found';
  end if;
  return payload;
end;
$$;

-- Preserve the authenticated-only answer-key and classroom-launch contracts.
-- Student access continues through the separate join-code RPCs.
revoke all on function public.start_classroom_session_v2(uuid, text, integer)
  from public, anon;
grant execute on function public.start_classroom_session_v2(uuid, text, integer)
  to authenticated;

revoke all on function public.get_assessment_answer_key(text)
  from public, anon;
grant execute on function public.get_assessment_answer_key(text)
  to authenticated;

commit;
