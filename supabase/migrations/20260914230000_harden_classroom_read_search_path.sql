-- Harden the intentional anonymous Live Classroom read RPC.
--
-- get_classroom_assessment is SECURITY DEFINER because students join without
-- LTG accounts. Keep the public contract unchanged, but run with an empty
-- search_path and fully-qualified application tables so object resolution
-- cannot be influenced by objects in a writable schema.

begin;

create or replace function public.get_classroom_assessment(p_join_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.classroom_sessions%rowtype;
  payload jsonb;
begin
  select * into s
  from public.classroom_sessions
  where join_code = upper(btrim(p_join_code))
    and status = 'active'
    and expires_at > clock_timestamp();

  if s.id is null then
    raise exception 'This class code is invalid or the session has ended';
  end if;

  select jsonb_build_object(
    'session', jsonb_build_object(
      'session_id', s.id,
      'session_name', 'Live Welding Class',
      'assessment_title', m.title,
      'question_count', count(q.id),
      'expected_students', s.expected_students,
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
        )
        order by q.question_number
      ),
      '[]'::jsonb
    )
  )
  into payload
  from public.assessment_modules m
  join public.assessment_questions q on q.assessment_slug = m.slug
  where m.slug = s.assessment_slug
  group by
    m.title,
    m.instructions,
    m.allow_team_members,
    m.reference_title,
    m.reference_image_url,
    m.reference_body,
    m.show_student_score;

  return payload;
end;
$$;

revoke all on function public.get_classroom_assessment(text)
  from public, anon, authenticated;
grant execute on function public.get_classroom_assessment(text)
  to anon, authenticated;

commit;
