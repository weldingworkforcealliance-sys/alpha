-- STAGING ONLY: target Gltg ezlvivmeneefiiwqwgqd via an explicitly allowlisted runner.
-- Kept outside the repository's normal supabase/migrations directory.
-- CREATE OR REPLACE preserves ownership and existing EXECUTE grants.
-- Do not apply through a production-linked CLI or promote this migration.
set local lock_timeout = '3s';
set local statement_timeout = '15s';
do $guard$
begin
  if md5(pg_get_functiondef('public.get_classroom_assessment(text)'::regprocedure)) <> '5bd7b287dad647a5189c18f210f1415a' then raise exception 'Rollback stopped: get_classroom_assessment changed after hardening'; end if;
  if md5(pg_get_functiondef('public.get_job_card_by_code(text)'::regprocedure)) <> '56c4c964d98faf7e994f7b69f6eab909' then raise exception 'Rollback stopped: get_job_card_by_code changed after hardening'; end if;
  if md5(pg_get_functiondef('public.submit_classroom_assessment_v2(text,text,text,text,jsonb)'::regprocedure)) <> '272d14c7be4748248a31532d7446bff5' then raise exception 'Rollback stopped: submit_classroom_assessment_v2 changed after hardening'; end if;
  if md5(pg_get_functiondef('public.submit_job_card(text,text,text,jsonb,jsonb,jsonb,text,text)'::regprocedure)) <> '6dfa5bfc4b56905df88e3301b4144b66' then raise exception 'Rollback stopped: submit_job_card changed after hardening'; end if;
end $guard$;
CREATE OR REPLACE FUNCTION public.get_classroom_assessment(p_join_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.classroom_sessions; payload jsonb;
begin
  select * into s from public.classroom_sessions where join_code=upper(trim(p_join_code)) and status='active' and expires_at>now();
  if s.id is null then raise exception 'This class code is invalid or the session has ended'; end if;
  select jsonb_build_object(
    'session',jsonb_build_object(
      'session_id',s.id,'session_name','Live Welding Class','assessment_title',m.title,'question_count',count(q.id),
      'expected_students',s.expected_students,'instructions',m.instructions,'allow_team_members',m.allow_team_members,
      'reference_title',m.reference_title,'reference_image_url',m.reference_image_url,'reference_body',m.reference_body,
      'reference_assets',coalesce((select jsonb_agg(jsonb_build_object('key',a.asset_key,'title',a.title,'image_url',a.image_url,'original_image_url',a.original_image_url,'notes',a.notes) order by a.sort_order,a.asset_key) from public.assessment_reference_assets a where a.assessment_slug=m.slug),'[]'::jsonb),
      'show_student_score',m.show_student_score
    ),
    'questions',coalesce(jsonb_agg(jsonb_build_object('key',q.question_key,'number',q.question_number,'type',q.question_type,'text',q.question_text,'domain',q.domain,'options',q.options) order by q.question_number),'[]'::jsonb)
  ) into payload
  from public.assessment_modules m join public.assessment_questions q on q.assessment_slug=m.slug
  where m.slug=s.assessment_slug
  group by m.slug,m.title,m.instructions,m.allow_team_members,m.reference_title,m.reference_image_url,m.reference_body,m.show_student_score;
  return payload;
end $function$;

CREATE OR REPLACE FUNCTION public.get_job_card_by_code(p_join_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.job_card_sessions%rowtype;
  v_section_name text;
  v_course_code text;
begin
  perform public.expire_job_card_sessions();
  select s.* into v_session from public.job_card_sessions s
  where upper(s.join_code)=upper(btrim(p_join_code)) and s.status='active' and s.expires_at>clock_timestamp()
  limit 1;
  if not found then raise exception 'This Live Job Card code is invalid or expired'; end if;
  select sec.section_name,c.course_code into v_section_name,v_course_code
  from public.sections sec join public.courses c on c.id=sec.course_id
  where sec.id=v_session.section_id;
  return jsonb_build_object(
    'sessionId',v_session.id,
    'joinCode',v_session.join_code,
    'status',v_session.status,
    'expiresAt',v_session.expires_at,
    'sectionLabel',concat_ws(' · ',nullif(v_course_code,''),nullif(v_section_name,'')),
    'jobTitle',v_session.job_title,
    'plannerDayNumber',v_session.planner_day_number,
    'drawingRef',v_session.drawing_ref,
    'drawingRevision',v_session.drawing_revision,
    'wpsSwpsRef',v_session.wps_swps_ref,
    'process',v_session.process,
    'position',v_session.position,
    'materialJoint',v_session.material_joint,
    'requirements',v_session.requirements
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_classroom_assessment_v2(p_join_code text, p_student_name text, p_student_id text, p_team_members text, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  s public.classroom_sessions%rowtype; q record; total integer:=0; correct integer:=0; normalized text;
  domains jsonb:='{}'::jsonb; domain_row jsonb; v_count integer:=0;
begin
  if p_join_code is null or char_length(btrim(p_join_code))<4 or char_length(btrim(p_join_code))>32 then raise exception 'A valid class code is required'; end if;
  if p_student_name is null or char_length(btrim(p_student_name))<2 or char_length(btrim(p_student_name))>120 then raise exception 'Student name must be between 2 and 120 characters'; end if;
  if p_student_id is null or char_length(btrim(p_student_id))<1 or char_length(btrim(p_student_id))>80 then raise exception 'Student ID must be between 1 and 80 characters'; end if;
  if char_length(coalesce(p_team_members,''))>500 then raise exception 'Team member list is too long'; end if;
  if jsonb_typeof(p_answers)<>'object' then raise exception 'Every question must be answered'; end if;
  if octet_length(p_answers::text)>65536 then raise exception 'Assessment response is too large'; end if;
  select * into s from public.classroom_sessions
   where join_code=upper(btrim(p_join_code)) and status='active' and expires_at>clock_timestamp() for update;
  if s.id is null then raise exception 'This class session has ended'; end if;
  if exists(select 1 from public.classroom_submissions sub where sub.classroom_session_id=s.id and lower(btrim(sub.student_id))=lower(btrim(p_student_id))) then raise exception 'This Student ID has already submitted'; end if;
  select count(*)::integer into v_count from public.classroom_submissions sub where sub.classroom_session_id=s.id;
  if v_count>=60 then raise exception 'This class session has reached its student capacity'; end if;
  for q in select * from public.assessment_questions aq where aq.assessment_slug=s.assessment_slug order by aq.question_number loop
    total:=total+1;
    if not (p_answers ? q.question_key) or char_length(btrim(coalesce(p_answers->>q.question_key,'')))=0 then raise exception 'Every question must be answered'; end if;
    if char_length(p_answers->>q.question_key)>2000 then raise exception 'An assessment answer is too long'; end if;
    normalized:=lower(btrim(p_answers->>q.question_key));
    domain_row:=coalesce(domains->q.domain,jsonb_build_object('correct',0,'total',0));
    domain_row:=jsonb_set(domain_row,'{total}',to_jsonb((domain_row->>'total')::integer+1));
    if (q.question_type='mc' and upper(normalized)=upper(q.correct_answer))
       or (q.question_type='text' and exists(select 1 from jsonb_array_elements_text(coalesce(q.accepted_answers,'[]'::jsonb)) a where lower(btrim(a))=normalized)) then
      correct:=correct+1;
      domain_row:=jsonb_set(domain_row,'{correct}',to_jsonb((domain_row->>'correct')::integer+1));
    end if;
    domains:=jsonb_set(domains,array[q.domain],domain_row,true);
  end loop;
  if (select count(*) from jsonb_object_keys(p_answers))<>total then raise exception 'Every question must be answered'; end if;
  insert into public.classroom_submissions(classroom_session_id,student_name,student_id,team_members,answers,score,possible_score,domain_scores)
  values(s.id,btrim(p_student_name),btrim(p_student_id),nullif(btrim(coalesce(p_team_members,'')),''),p_answers,correct,total,domains);
  return jsonb_build_object('score',correct,'possible_score',total,'percent',round(100.0*correct/greatest(total,1)));
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_job_card(p_join_code text, p_student_name text, p_student_id text, p_start_check jsonb, p_quality_check jsonb, p_requirement_results jsonb, p_evidence_type text DEFAULT 'none'::text, p_evidence_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.job_card_sessions%rowtype;
  v_count integer;
  v_req jsonb;
  v_result jsonb;
  v_status text;
  v_sanitized jsonb:='[]'::jsonb;
  v_submission_id uuid;
begin
  perform public.expire_job_card_sessions();
  if p_join_code is null or char_length(btrim(p_join_code))<4 or char_length(btrim(p_join_code))>32 then raise exception 'A valid Live Job Card code is required'; end if;
  if p_student_name is null or char_length(btrim(p_student_name))<1 or char_length(btrim(p_student_name))>120 then raise exception 'Student name must be between 1 and 120 characters'; end if;
  if p_student_id is null or char_length(btrim(p_student_id))<1 or char_length(btrim(p_student_id))>80 then raise exception 'Student ID must be between 1 and 80 characters'; end if;
  if char_length(coalesce(p_evidence_note,''))>2000 then raise exception 'Evidence note is too long'; end if;
  if jsonb_typeof(p_start_check)<>'object' or octet_length(p_start_check::text)>8192 then raise exception 'Invalid Start Check payload'; end if;
  if jsonb_typeof(p_quality_check)<>'object' or octet_length(p_quality_check::text)>8192 then raise exception 'Invalid Quick Quality Check payload'; end if;
  if jsonb_typeof(p_requirement_results)<>'array' or octet_length(p_requirement_results::text)>65536 then raise exception 'Invalid Job Card requirement results'; end if;
  select * into v_session from public.job_card_sessions s
  where upper(s.join_code)=upper(btrim(p_join_code)) and s.status='active' and s.expires_at>clock_timestamp()
  for update;
  if not found then raise exception 'This Live Job Card code is invalid or expired'; end if;
  if p_evidence_type not in ('none','photo','measurement','inspection_test_result') then raise exception 'Invalid evidence type'; end if;
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
  if jsonb_array_length(p_requirement_results)<>jsonb_array_length(v_session.requirements) then raise exception 'Student requirement results do not match this Job Card'; end if;
  for v_req in select value from jsonb_array_elements(v_session.requirements) loop
    select value into v_result from jsonb_array_elements(p_requirement_results)
    where value->>'key'=v_req->>'key' limit 1;
    if v_result is null then raise exception 'A required Job Card result is missing'; end if;
    if greatest(
      char_length(coalesce(v_result->>'actualValue','')),
      char_length(coalesce(v_result->>'issue','')),
      char_length(coalesce(v_result->>'correction','')),
      char_length(coalesce(v_result->>'recheck',''))
    )>2000 then raise exception 'A Job Card response value is too long'; end if;
    v_status:=lower(coalesce(v_result->>'status',''));
    if v_status not in ('pass','correct','na') then raise exception 'Every requirement must be Pass, Correct, or N/A'; end if;
    if v_status<>'na' and btrim(coalesce(v_result->>'actualValue',''))='' then raise exception 'Student Actual is required unless the item is N/A'; end if;
    if v_status='correct' and (
      btrim(coalesce(v_result->>'issue',''))=''
      or btrim(coalesce(v_result->>'correction',''))=''
      or btrim(coalesce(v_result->>'recheck',''))=''
    ) then raise exception 'Corrected items require issue, correction, and recheck'; end if;
    v_sanitized:=v_sanitized||jsonb_build_array(jsonb_build_object(
      'key',v_req->>'key',
      'label',v_req->>'label',
      'requiredValue',v_req->>'requiredValue',
      'actualValue',case when v_status='na' then '' else coalesce(v_result->>'actualValue','') end,
      'status',v_status,
      'issue',case when v_status='correct' then coalesce(v_result->>'issue','') else '' end,
      'correction',case when v_status='correct' then coalesce(v_result->>'correction','') else '' end,
      'recheck',case when v_status='correct' then coalesce(v_result->>'recheck','') else '' end
    ));
  end loop;
  if exists(select 1 from public.job_card_submissions sub where sub.job_card_session_id=v_session.id and lower(btrim(sub.student_id))=lower(btrim(p_student_id))) then
    raise exception 'A Job Card has already been submitted for this Student ID';
  end if;
  select count(*)::integer into v_count from public.job_card_submissions sub where sub.job_card_session_id=v_session.id;
  if v_count>=v_session.expected_students or v_count>=17 then raise exception 'This Live Job Card has reached its student capacity'; end if;
  insert into public.job_card_submissions(
    school_id,job_card_session_id,student_name,student_id,start_check,quality_check,requirement_results,evidence_type,evidence_note
  ) values (
    v_session.school_id,v_session.id,btrim(p_student_name),btrim(p_student_id),p_start_check,p_quality_check,v_sanitized,p_evidence_type,nullif(btrim(p_evidence_note),'')
  ) returning id into v_submission_id;
  return v_submission_id;
end;
$function$;

notify pgrst, 'reload schema';
