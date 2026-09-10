-- LTG stabilization: bound anonymous Live Classroom and Live Job Card submissions.
-- Join-code participation stays public by design, but public writers must not be
-- able to persist unbounded text/JSON or create an unlimited number of classroom
-- submissions while a join code is active.

begin;

create or replace function public.submit_classroom_assessment_v2(
  p_join_code text,
  p_student_name text,
  p_student_id text,
  p_team_members text,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.classroom_sessions%rowtype;
  q record;
  total integer := 0;
  correct integer := 0;
  normalized text;
  domains jsonb := '{}'::jsonb;
  domain_row jsonb;
  v_count integer := 0;
begin
  if p_join_code is null
     or char_length(btrim(p_join_code)) < 4
     or char_length(btrim(p_join_code)) > 32 then
    raise exception 'A valid class code is required';
  end if;

  if p_student_name is null
     or char_length(btrim(p_student_name)) < 2
     or char_length(btrim(p_student_name)) > 120 then
    raise exception 'Student name must be between 2 and 120 characters';
  end if;

  if p_student_id is null
     or char_length(btrim(p_student_id)) < 1
     or char_length(btrim(p_student_id)) > 80 then
    raise exception 'Student ID must be between 1 and 80 characters';
  end if;

  if char_length(coalesce(p_team_members, '')) > 500 then
    raise exception 'Team member list is too long';
  end if;

  if jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Every question must be answered';
  end if;

  if octet_length(p_answers::text) > 65536 then
    raise exception 'Assessment response is too large';
  end if;

  select * into s
  from public.classroom_sessions
  where join_code = upper(btrim(p_join_code))
    and status = 'active'
    and expires_at > clock_timestamp()
  for update;

  if s.id is null then
    raise exception 'This class session has ended';
  end if;

  if exists (
    select 1
    from public.classroom_submissions sub
    where sub.classroom_session_id = s.id
      and lower(btrim(sub.student_id)) = lower(btrim(p_student_id))
  ) then
    raise exception 'This Student ID has already submitted';
  end if;

  select count(*)::integer into v_count
  from public.classroom_submissions sub
  where sub.classroom_session_id = s.id;

  -- start_classroom_session_v2 permits at most 60 expected students. Keep 60 as
  -- the platform-wide absolute public-write ceiling without treating the softer
  -- expected_students value as a hard attendance cap.
  if v_count >= 60 then
    raise exception 'This class session has reached its student capacity';
  end if;

  for q in
    select *
    from public.assessment_questions aq
    where aq.assessment_slug = s.assessment_slug
    order by aq.question_number
  loop
    total := total + 1;

    if not (p_answers ? q.question_key)
       or char_length(btrim(coalesce(p_answers ->> q.question_key, ''))) = 0 then
      raise exception 'Every question must be answered';
    end if;

    if char_length(p_answers ->> q.question_key) > 2000 then
      raise exception 'An assessment answer is too long';
    end if;

    normalized := lower(btrim(p_answers ->> q.question_key));
    domain_row := coalesce(
      domains -> q.domain,
      jsonb_build_object('correct', 0, 'total', 0)
    );
    domain_row := jsonb_set(
      domain_row,
      '{total}',
      to_jsonb((domain_row ->> 'total')::integer + 1)
    );

    if (q.question_type = 'mc' and upper(normalized) = upper(q.correct_answer))
       or (
         q.question_type = 'text'
         and exists (
           select 1
           from jsonb_array_elements_text(
             coalesce(q.accepted_answers, '[]'::jsonb)
           ) a
           where lower(btrim(a)) = normalized
         )
       ) then
      correct := correct + 1;
      domain_row := jsonb_set(
        domain_row,
        '{correct}',
        to_jsonb((domain_row ->> 'correct')::integer + 1)
      );
    end if;

    domains := jsonb_set(domains, array[q.domain], domain_row, true);
  end loop;

  if (select count(*) from jsonb_object_keys(p_answers)) <> total then
    raise exception 'Every question must be answered';
  end if;

  insert into public.classroom_submissions(
    classroom_session_id,
    student_name,
    student_id,
    team_members,
    answers,
    score,
    possible_score,
    domain_scores
  )
  values (
    s.id,
    btrim(p_student_name),
    btrim(p_student_id),
    nullif(btrim(coalesce(p_team_members, '')), ''),
    p_answers,
    correct,
    total,
    domains
  );

  return jsonb_build_object(
    'score', correct,
    'possible_score', total,
    'percent', round(100.0 * correct / greatest(total, 1))
  );
end;
$$;

revoke all on function public.submit_classroom_assessment_v2(text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_classroom_assessment_v2(text, text, text, text, jsonb)
  to anon, authenticated;

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
set search_path = ''
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

  if p_join_code is null
     or char_length(btrim(p_join_code)) < 4
     or char_length(btrim(p_join_code)) > 32 then
    raise exception 'A valid Live Job Card code is required';
  end if;

  if p_student_name is null
     or char_length(btrim(p_student_name)) < 1
     or char_length(btrim(p_student_name)) > 120 then
    raise exception 'Student name must be between 1 and 120 characters';
  end if;

  if p_student_id is null
     or char_length(btrim(p_student_id)) < 1
     or char_length(btrim(p_student_id)) > 80 then
    raise exception 'Student ID must be between 1 and 80 characters';
  end if;

  if char_length(coalesce(p_evidence_note, '')) > 2000 then
    raise exception 'Evidence note is too long';
  end if;

  if jsonb_typeof(p_start_check) <> 'object'
     or octet_length(p_start_check::text) > 8192 then
    raise exception 'Invalid Start Check payload';
  end if;

  if jsonb_typeof(p_quality_check) <> 'object'
     or octet_length(p_quality_check::text) > 8192 then
    raise exception 'Invalid Quick Quality Check payload';
  end if;

  if jsonb_typeof(p_requirement_results) <> 'array'
     or octet_length(p_requirement_results::text) > 65536 then
    raise exception 'Invalid Job Card requirement results';
  end if;

  select * into v_session
  from public.job_card_sessions s
  where upper(s.join_code) = upper(btrim(p_join_code))
    and s.status = 'active'
    and s.expires_at > clock_timestamp()
  for update;

  if not found then
    raise exception 'This Live Job Card code is invalid or expired';
  end if;

  if p_evidence_type not in ('none', 'photo', 'measurement', 'inspection_test_result') then
    raise exception 'Invalid evidence type';
  end if;

  if coalesce((p_start_check ->> 'drawingReviewed')::boolean, false) is not true
     or coalesce((p_start_check ->> 'procedureReviewed')::boolean, false) is not true
     or coalesce((p_start_check ->> 'materialJointVerified')::boolean, false) is not true then
    raise exception 'Complete the Start Check before submitting';
  end if;

  if coalesce((p_quality_check ->> 'requirementsChecked')::boolean, false) is not true
     or coalesce((p_quality_check ->> 'correctionsRecorded')::boolean, false) is not true
     or coalesce((p_quality_check ->> 'readyForInstructor')::boolean, false) is not true then
    raise exception 'Complete the Quick Quality Check before submitting';
  end if;

  if jsonb_array_length(p_requirement_results) <> jsonb_array_length(v_session.requirements) then
    raise exception 'Student requirement results do not match this Job Card';
  end if;

  for v_req in
    select value from jsonb_array_elements(v_session.requirements)
  loop
    select value into v_result
    from jsonb_array_elements(p_requirement_results)
    where value ->> 'key' = v_req ->> 'key'
    limit 1;

    if v_result is null then
      raise exception 'A required Job Card result is missing';
    end if;

    if greatest(
      char_length(coalesce(v_result ->> 'actualValue', '')),
      char_length(coalesce(v_result ->> 'issue', '')),
      char_length(coalesce(v_result ->> 'correction', '')),
      char_length(coalesce(v_result ->> 'recheck', ''))
    ) > 2000 then
      raise exception 'A Job Card response value is too long';
    end if;

    v_status := lower(coalesce(v_result ->> 'status', ''));
    if v_status not in ('pass', 'correct', 'na') then
      raise exception 'Every requirement must be Pass, Correct, or N/A';
    end if;

    if v_status <> 'na' and btrim(coalesce(v_result ->> 'actualValue', '')) = '' then
      raise exception 'Student Actual is required unless the item is N/A';
    end if;

    if v_status = 'correct' and (
      btrim(coalesce(v_result ->> 'issue', '')) = ''
      or btrim(coalesce(v_result ->> 'correction', '')) = ''
      or btrim(coalesce(v_result ->> 'recheck', '')) = ''
    ) then
      raise exception 'Corrected items require issue, correction, and recheck';
    end if;

    v_sanitized := v_sanitized || jsonb_build_array(jsonb_build_object(
      'key', v_req ->> 'key',
      'label', v_req ->> 'label',
      'requiredValue', v_req ->> 'requiredValue',
      'actualValue', case when v_status = 'na' then '' else coalesce(v_result ->> 'actualValue', '') end,
      'status', v_status,
      'issue', case when v_status = 'correct' then coalesce(v_result ->> 'issue', '') else '' end,
      'correction', case when v_status = 'correct' then coalesce(v_result ->> 'correction', '') else '' end,
      'recheck', case when v_status = 'correct' then coalesce(v_result ->> 'recheck', '') else '' end
    ));
  end loop;

  if exists (
    select 1
    from public.job_card_submissions sub
    where sub.job_card_session_id = v_session.id
      and lower(btrim(sub.student_id)) = lower(btrim(p_student_id))
  ) then
    raise exception 'A Job Card has already been submitted for this Student ID';
  end if;

  select count(*)::integer into v_count
  from public.job_card_submissions sub
  where sub.job_card_session_id = v_session.id;

  if v_count >= v_session.expected_students or v_count >= 17 then
    raise exception 'This Live Job Card has reached its student capacity';
  end if;

  insert into public.job_card_submissions(
    school_id,
    job_card_session_id,
    student_name,
    student_id,
    start_check,
    quality_check,
    requirement_results,
    evidence_type,
    evidence_note
  ) values (
    v_session.school_id,
    v_session.id,
    btrim(p_student_name),
    btrim(p_student_id),
    p_start_check,
    p_quality_check,
    v_sanitized,
    p_evidence_type,
    nullif(btrim(p_evidence_note), '')
  )
  returning id into v_submission_id;

  return v_submission_id;
end;
$$;

revoke all on function public.submit_job_card(text, text, text, jsonb, jsonb, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_job_card(text, text, text, jsonb, jsonb, jsonb, text, text)
  to anon, authenticated;

commit;
