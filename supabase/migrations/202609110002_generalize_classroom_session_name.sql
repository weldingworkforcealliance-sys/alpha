-- Keep the anonymous Connected Classroom payload program-neutral.
-- The previous function hardcoded "Live Welding Class", which leaked welding-specific
-- language into cross-discipline sessions such as Radiography.

create or replace function public.get_classroom_assessment(p_join_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_session public.classroom_sessions;
  payload jsonb;
begin
  select * into v_session
  from public.classroom_sessions
  where join_code = upper(trim(p_join_code))
    and status = 'active'
    and expires_at > now();

  if v_session.id is null then
    raise exception 'This class code is invalid or the session has ended';
  end if;

  select jsonb_build_object(
    'session', jsonb_build_object(
      'session_id', v_session.id,
      'session_name', coalesce(
        nullif(concat_ws(' · ', nullif(c.course_code, ''), nullif(sec.section_name, '')), ''),
        'Live Class'
      ),
      'assessment_title', m.title,
      'question_count', count(q.id),
      'expected_students', v_session.expected_students,
      'instructions', m.instructions,
      'allow_team_members', m.allow_team_members,
      'reference_title', m.reference_title,
      'reference_image_url', m.reference_image_url,
      'reference_body', m.reference_body,
      'show_student_score', m.show_student_score
    ),
    'questions', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'key', q.question_key,
          'number', q.question_number,
          'type', q.question_type,
          'text', q.question_text,
          'domain', q.domain,
          'options', q.options
        ) order by q.question_number
      ),
      '[]'::jsonb
    )
  ) into payload
  from public.assessment_modules m
  join public.assessment_questions q on q.assessment_slug = m.slug
  join public.sections sec on sec.id = v_session.section_id
  join public.courses c on c.id = sec.course_id
  where m.slug = v_session.assessment_slug
  group by m.title, m.instructions, m.allow_team_members, m.reference_title,
           m.reference_image_url, m.reference_body, m.show_student_score,
           c.course_code, sec.section_name;

  return payload;
end;
$function$;
