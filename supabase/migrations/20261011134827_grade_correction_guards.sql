-- Preserve immutable history; generic corrections require the displayed revision.
begin;
create function private.record_gradebook_attempt(p_gradebook_id uuid,p_item_id uuid,p_student_id uuid,
 p_status_code text,p_score numeric default null,p_possible_score numeric default null,p_note text default '',p_attempt_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_attempt uuid; v_status public.gradebook_statuses;
begin
 if not public.can_access_gradebook(p_gradebook_id) then raise exception 'Gradebook access denied' using errcode='42501'; end if;
 select * into v_status from public.gradebook_statuses where gradebook_id=p_gradebook_id and code=p_status_code and active;
 if not found then raise exception 'Choose an active grade status'; end if;
 if v_status.requires_score and (p_score is null or p_possible_score is null) then raise exception 'This status requires a score'; end if;
 if p_attempt_id is null then
   if not exists(select 1 from public.gradebook_students where gradebook_id=p_gradebook_id and student_id=p_student_id and active)
   then raise exception 'Student is not actively enrolled'; end if;
   insert into public.gradebook_attempts(gradebook_id,item_id,student_id) values(p_gradebook_id,p_item_id,p_student_id) returning id into v_attempt;
 else
   select id into v_attempt from public.gradebook_attempts where id=p_attempt_id and gradebook_id=p_gradebook_id
     and item_id=p_item_id and student_id=p_student_id for update;
   if not found then raise exception 'Attempt does not belong to this student and item'; end if;
   if length(trim(coalesce(p_note,'')))=0 then raise exception 'A correction requires a reason'; end if;
 end if;
 insert into public.gradebook_revisions(gradebook_id,attempt_id,status_code,status_label,score,possible_score,note,recorded_by)
 values(p_gradebook_id,v_attempt,p_status_code,v_status.label,p_score,p_possible_score,coalesce(p_note,''),auth.uid());
 return v_attempt;
end $$;
revoke all on function private.record_gradebook_attempt(uuid,uuid,uuid,text,numeric,numeric,text,uuid) from public,anon,authenticated;

create or replace function public.record_gradebook_attempt(p_gradebook_id uuid,p_item_id uuid,p_student_id uuid,
 p_status_code text,p_score numeric default null,p_possible_score numeric default null,p_note text default '',p_attempt_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not public.can_access_gradebook(p_gradebook_id) then raise exception 'Gradebook access denied' using errcode='42501'; end if;
 if exists(select 1 from public.gradebook_items where gradebook_id=p_gradebook_id and id=p_item_id and assessment_slug ~ '^(tower:|wld110-shop:)') then
  raise exception 'Use the welding assessment to record or correct this grade';
 end if;
 if p_attempt_id is not null then
  raise exception 'Reload the gradebook before correcting this grade' using errcode='40001';
 end if;
 return private.record_gradebook_attempt(p_gradebook_id,p_item_id,p_student_id,p_status_code,p_score,p_possible_score,p_note,null);
end $$;

create function public.correct_gradebook_attempt(p_gradebook_id uuid,p_item_id uuid,p_student_id uuid,
 p_status_code text,p_score numeric,p_possible_score numeric,p_note text,p_attempt_id uuid,p_expected_revision bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_revision bigint;
begin
 if not public.can_access_gradebook(p_gradebook_id) then raise exception 'Gradebook access denied' using errcode='42501'; end if;
 if exists(select 1 from public.gradebook_items where gradebook_id=p_gradebook_id and id=p_item_id and assessment_slug ~ '^(tower:|wld110-shop:)') then
  raise exception 'Use the welding assessment to record or correct this grade';
 end if;
 perform 1 from public.gradebook_attempts where id=p_attempt_id and gradebook_id=p_gradebook_id
  and item_id=p_item_id and student_id=p_student_id for update;
 if not found then raise exception 'Attempt does not belong to this student and item'; end if;
 select max(id) into v_revision from public.gradebook_revisions where gradebook_id=p_gradebook_id and attempt_id=p_attempt_id;
 if p_expected_revision is null or v_revision is distinct from p_expected_revision then
  raise exception 'Another instructor changed this grade. Close this form and reload the gradebook before correcting it.' using errcode='40001';
 end if;
 return private.record_gradebook_attempt(p_gradebook_id,p_item_id,p_student_id,p_status_code,p_score,p_possible_score,p_note,p_attempt_id);
end $$;
revoke all on function public.correct_gradebook_attempt(uuid,uuid,uuid,text,numeric,numeric,text,uuid,bigint) from public,anon;
grant execute on function public.correct_gradebook_attempt(uuid,uuid,uuid,text,numeric,numeric,text,uuid,bigint) to authenticated;

-- Existing rubric, evidence and authorization checks stay in their owning workflows.
create or replace function public.save_tower_student(p_gradebook_id uuid,p_student_id uuid,p_revision bigint,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old_data jsonb; old_revision bigint; assignment record; attempt jsonb; previous jsonb;
 criterion text; n integer; score numeric; category uuid; item uuid; attempt_id uuid;
 test jsonb; prior_test jsonb; v_test_id uuid; cert jsonb; identity_text text;
 status text; complete boolean; exam record; position record;
begin
 perform public.tower_assert_access(p_gradebook_id,p_student_id);
 if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>500000 then raise exception 'Invalid Tower record'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_gradebook_id::text||p_student_id::text,0));
 insert into public.tower_records(gradebook_id,student_id) values(p_gradebook_id,p_student_id) on conflict do nothing;
 select data,revision into old_data,old_revision from public.tower_records
 where gradebook_id=p_gradebook_id and student_id=p_student_id for update;
 if old_data=p_data then return jsonb_build_object('revision',old_revision); end if;
 if old_revision<>p_revision then raise exception 'Another instructor changed this record. Reload before editing.' using errcode='40001'; end if;
 if jsonb_typeof(p_data->'lab') is distinct from 'object'
 or jsonb_typeof(p_data->'exams') is distinct from 'object'
 or jsonb_typeof(p_data->'competencies') is distinct from 'object'
 or jsonb_typeof(p_data->'positionQualifications') is distinct from 'object'
 or jsonb_typeof(p_data->'destructiveTests') is distinct from 'array' then raise exception 'Incomplete Tower record'; end if;
 -- Historical exams and destructive tests cannot be removed or replaced.
 for exam in select * from jsonb_each(coalesce(old_data->'exams','{}')) loop
  if not coalesce(p_data->'exams'->exam.key->'attempts','[]') @> coalesce(exam.value->'attempts','[]') then
   raise exception 'Exam attempts are permanent; existing attempts cannot be removed or edited';
  end if;
 end loop;
 for exam in select * from jsonb_each(p_data->'exams') loop
  if exam.key not in('m2','m3','m4','m5','m6','m7','m8','m9') or jsonb_typeof(exam.value->'attempts') is distinct from 'array'
   or jsonb_array_length(exam.value->'attempts')>3 then raise exception 'Invalid knowledge exam'; end if;
  if jsonb_array_length(exam.value->'attempts')=3 and not coalesce((exam.value->>'retrainingConfirmed')::boolean,false)
   then raise exception 'Retraining is required before the third exam'; end if;
  for attempt in select value from jsonb_array_elements(exam.value->'attempts') loop
   if jsonb_typeof(attempt->'score') is distinct from 'number' or (attempt->>'score')::numeric not between 0 and 100
    then raise exception 'Exam score must be from 0 to 100'; end if;
  end loop;
 end loop;
 for position in select * from jsonb_each(p_data->'positionQualifications') loop
  if coalesce(position.value->>'status','') not in('Not Started','Pass','Fail') then raise exception 'Qualification must be Pass or Fail'; end if;
 end loop;
 -- Preserve any previously recorded lab attempt; corrections get a new history revision.
 for assignment in select * from jsonb_each(coalesce(old_data->'lab','{}')) loop
  if not p_data->'lab' ? assignment.key then raise exception 'Existing lab attempts cannot be removed'; end if;
  for n in 1..2 loop
   if public.tower_attempt_score(assignment.value->('attempt'||n),n) is not null
    and public.tower_attempt_score(p_data->'lab'->assignment.key->('attempt'||n),n) is null then
    raise exception 'A completed attempt cannot be cleared; enter a correction instead';
   end if;
  end loop;
  if assignment.value->'attempt2' is not null and assignment.value->'attempt2'<>'null'::jsonb
   and (p_data->'lab'->assignment.key->'attempt2' is null or p_data->'lab'->assignment.key->'attempt2'='null'::jsonb)
   then raise exception 'Attempt 2 cannot be removed'; end if;
 end loop;
 for assignment in select e.key,e.value,a.definition from jsonb_each(p_data->'lab') e
 left join public.tower_assignments a on a.id=e.key and (a.gradebook_id is null or a.gradebook_id=p_gradebook_id) loop
  if assignment.definition is null then raise exception 'Unknown Tower assignment'; end if;
  for n in 1..2 loop
   attempt:=assignment.value->('attempt'||n);
   if attempt is null or attempt='null'::jsonb then continue; end if;
   score:=public.tower_attempt_score(attempt,n);
   complete:=true;
   foreach criterion in array array['consistency','defects','procedure','restarts','beadSize'] loop
    if not(attempt->'scores' ? criterion) then complete:=false; end if;
   end loop;
   if not complete then continue; end if;
   if n=2 and not (assignment.value->'attempt1'->'scores' ?& array['consistency','defects','procedure','restarts','beadSize'])
     then raise exception 'Complete Attempt 1 before Attempt 2'; end if;
   select l.attempt_id,l.evidence into attempt_id,previous from public.tower_grade_links l
    where gradebook_id=p_gradebook_id and student_id=p_student_id and assignment_id=assignment.key and attempt_number=n;
   if previous=attempt then continue; end if;
   insert into public.gradebook_categories(gradebook_id,code,label)
    values(p_gradebook_id,case when assignment.definition->>'type'='project' then 'shop_projects' else 'weld_performance' end,
     case when assignment.definition->>'type'='project' then 'Shop Projects' else 'Weld Performance' end)
    on conflict(gradebook_id,code) do nothing;
   select id into category from public.gradebook_categories where gradebook_id=p_gradebook_id
    and code=case when assignment.definition->>'type'='project' then 'shop_projects' else 'weld_performance' end;
   select i.id into item from public.gradebook_items i where i.gradebook_id=p_gradebook_id and i.assessment_slug='tower:'||assignment.key;
   if item is null then
    insert into public.gradebook_items(gradebook_id,category_id,title,assessment_slug)
    values(p_gradebook_id,category,assignment.definition->>'name','tower:'||assignment.key) returning id into item;
   end if;
   status:=case when score is null then 'tower_f' else 'graded' end;
   insert into public.gradebook_statuses(gradebook_id,code,label,requires_score)
    values(p_gradebook_id,'tower_f','F — retest required',false) on conflict do nothing;
   attempt_id:=private.record_gradebook_attempt(p_gradebook_id,item,p_student_id,status,score,
     case when score is null then null else 100 end,'Tower rubric revision '||(old_revision+1)||', attempt '||n,attempt_id);
   insert into public.tower_grade_links values(p_gradebook_id,p_student_id,assignment.key,n,attempt_id,attempt)
    on conflict(gradebook_id,student_id,assignment_id,attempt_number) do update set evidence=excluded.evidence;
  end loop;
 end loop;
 select lpad(weld_test_id::text,4,'0') into identity_text from public.tower_student_ids where student_id=p_student_id;
 if identity_text is null then raise exception 'Open the Tower roster before recording evidence'; end if;
 for prior_test in select value from jsonb_array_elements(coalesce(old_data->'destructiveTests','[]')) loop
  select value into test from jsonb_array_elements(p_data->'destructiveTests') where value->>'id'=prior_test->>'id';
  if test is null or (test-'certificate')<>(prior_test-'certificate') then raise exception 'Destructive tests are permanent'; end if;
  if prior_test->'certificate' is not null and prior_test->'certificate'<>'null'::jsonb and test->'certificate' is distinct from prior_test->'certificate'
   then raise exception 'Issued certificates are permanent'; end if;
 end loop;
 for test in select value from jsonb_array_elements(p_data->'destructiveTests') loop
  v_test_id:=(test->>'id')::uuid;
  if coalesce(test->>'result','') not in('Pass','Fail') or test->>'weldTestId' is distinct from identity_text
   or test->>'studentRecordId' is distinct from p_student_id::text or test->>'courseId' is distinct from p_gradebook_id::text
   then raise exception 'Invalid destructive-test identity or result'; end if;
  if not exists(select 1 from public.tower_permanent_tests where id=v_test_id) and not exists(select 1 from public.gradebook_roster r join public.gradebook_directory g on g.id=r.gradebook_id
   where r.gradebook_id=p_gradebook_id and r.student_id=p_student_id
   and r.display_name=test->>'studentName' and g.course_code=test->>'courseCode') then
   raise exception 'Test name and course must match the enrolled student';
  end if;
  foreach criterion in array array['process','material','specification','fillerMetal','plate','position','testMethod','inspector','testDate'] loop
   if length(trim(coalesce(test->>criterion,'')))=0 then raise exception 'Complete all destructive-test fields'; end if;
  end loop;
  if coalesce(test->>'faceBendResult','') not in('Satisfactory','Unsatisfactory') or coalesce(test->>'rootBendResult','') not in('Satisfactory','Unsatisfactory')
   then raise exception 'Complete bend-test results'; end if;
  if test->>'result'='Pass' and (test->>'faceBendResult'<>'Satisfactory' or test->>'rootBendResult'<>'Satisfactory')
   then raise exception 'A passing test requires satisfactory bend results'; end if;
  insert into public.tower_permanent_tests(id,gradebook_id,student_id,evidence,recorded_by)
   values(v_test_id,p_gradebook_id,p_student_id,test-'certificate',auth.uid()) on conflict(id) do nothing;
  if not exists(select 1 from public.tower_permanent_tests where id=v_test_id and gradebook_id=p_gradebook_id
   and student_id=p_student_id and evidence=test-'certificate') then raise exception 'Destructive-test identity collision'; end if;
  cert:=test->'certificate';
  if cert is not null and cert<>'null'::jsonb then
   if test->>'result'<>'Pass' then raise exception 'Only passing tests can receive certificates'; end if;
   -- Certificate evidence always derives from the permanent database test, not an editable client snapshot.
   insert into public.tower_certificates(test_id,gradebook_id,student_id,snapshot,issued_by)
    select id,gradebook_id,student_id,evidence,auth.uid() from public.tower_permanent_tests where id=v_test_id
    on conflict(test_id) do nothing;
  end if;
 end loop;
 update public.tower_records set revision=old_revision+1,data=p_data,updated_at=now(),updated_by=auth.uid()
  where gradebook_id=p_gradebook_id and student_id=p_student_id;
 insert into public.tower_history(gradebook_id,student_id,revision,data,recorded_by)
  values(p_gradebook_id,p_student_id,old_revision+1,p_data,auth.uid());
 return jsonb_build_object('revision',old_revision+1);
end $$;

create or replace function private.wld110_grade_decision(p_book uuid,p_student uuid,p_id uuid,p_competency integer,
 p_revision integer,p_ratings jsonb,p_tags jsonb,p_sizer_note text,p_decision text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare progress public.wld110_shop_progress;
 prior public.wld110_shop_attempts; k text; v integer; total integer:=0;
 attempt_no integer; tag text; v_focus text[]:='{}'; grade numeric; item uuid; grade_attempt uuid; next_competency integer;
begin
 perform private.wld110_assert(p_book,p_student);
 if p_decision is null or p_decision not in ('grade','retry') then raise exception 'Choose Grade or Try again'; end if;
 if p_id is null then raise exception 'Save identifier required'; end if;
 select * into progress from public.wld110_shop_progress where gradebook_id=p_book and student_id=p_student for update;
 if not found then raise exception 'Open the shop board first'; end if;
 select * into prior from public.wld110_shop_attempts where id=p_id;
 if found then
  if prior.gradebook_id<>p_book or prior.student_id<>p_student or prior.competency<>p_competency
   or prior.ratings is distinct from p_ratings or prior.tags is distinct from p_tags
   or prior.decision is distinct from p_decision
   or prior.sizer_note is distinct from coalesce(p_sizer_note,'') then raise exception 'Save identifier already used'; end if;
  return private.wld110_snapshot(p_book,p_student);
 end if;
 if progress.revision is distinct from p_revision then
  raise serialization_failure using message='This student changed. Reload before grading.';
 end if;
 if p_competency is null or p_competency not between 0 and 8 then raise exception 'Choose a valid SMAW competency'; end if;
 if exists(select 1 from public.wld110_shop_completions where gradebook_id=p_book and student_id=p_student and competency=p_competency) then
  raise exception 'Competency already complete. Review its retained history.';
 end if;
 if p_competency=8 and (select count(*) from public.wld110_shop_completions where gradebook_id=p_book and student_id=p_student and competency<8)<>8 then
  raise exception 'Complete all eight core competencies before advanced 2G';
 end if;
 if jsonb_typeof(p_ratings) is distinct from 'object' or
  (select count(*) from jsonb_object_keys(p_ratings))<>5 then raise exception 'Five category ratings required'; end if;
 if jsonb_typeof(p_tags) is distinct from 'object' or octet_length(p_tags::text)>4000 then raise exception 'Invalid deficiency tags'; end if;
 foreach k in array array['straightness','placement','execution','consistency','weldSize'] loop
  if jsonb_typeof(p_ratings->k) is distinct from 'number' or p_ratings->>k not in('12','16','18','20') then
   raise exception 'Choose Excellent, Good, Acceptable or Needs Work for every category';
  end if;
  v:=(p_ratings->>k)::integer; total:=total+v;
 end loop;
 for k in select jsonb_object_keys(p_tags) loop
  if not p_ratings ? k or p_ratings->>k<>'12' or jsonb_typeof(p_tags->k) is distinct from 'array'
    or jsonb_array_length(p_tags->k)>12 then raise exception 'Tags apply only to Needs Work'; end if;
  for tag in select jsonb_array_elements_text(p_tags->k) loop
   if length(trim(tag)) not between 1 and 80 then raise exception 'Invalid deficiency tag'; end if;
   v_focus:=array_append(v_focus,tag);
  end loop;
 end loop;
 -- A category label remains useful feedback if no optional quick tag was chosen.
 foreach k in array array['straightness','placement','execution','consistency','weldSize'] loop
  if p_ratings->>k='12' and coalesce(jsonb_array_length(p_tags->k),0)=0 then v_focus:=array_append(v_focus,k); end if;
 end loop;
 select count(*)+1 into attempt_no from public.wld110_shop_attempts
  where gradebook_id=p_book and student_id=p_student and competency=p_competency;
 insert into public.wld110_shop_attempts(id,gradebook_id,student_id,competency,attempt_number,ratings,total,tags,sizer_note,recorded_by,decision)
 values(p_id,p_book,p_student,p_competency,attempt_no,p_ratings,total,p_tags,coalesce(p_sizer_note,''),auth.uid(),p_decision);
 if p_decision='grade' then
  grade:=total;
  if p_competency<8 then
   select id into item from public.gradebook_items where gradebook_id=p_book and assessment_slug='wld110-shop:'||p_competency;
   if item is null then raise exception 'Open the shop board to prepare competency gradebook items'; end if;
   grade_attempt:=private.record_gradebook_attempt(p_book,item,p_student,'graded',grade,100,
    'WLD 110 instructor accepted demonstration '||attempt_no||'; earlier attempts retained in history; no averaging.');
  end if;
  insert into public.wld110_shop_completions(gradebook_id,student_id,competency,first_attempt_id,second_attempt_id,grade,gradebook_attempt_id)
   values(p_book,p_student,p_competency,p_id,null,grade,grade_attempt);
  -- The selected project may be ahead of the recommended one. Do not skip gaps.
  select coalesce(min(n),9) into next_competency from generate_series(0,8) n
   where not exists(select 1 from public.wld110_shop_completions c where c.gradebook_id=p_book and c.student_id=p_student and c.competency=n);
  update public.wld110_shop_progress set current_competency=next_competency,revision=revision+1,
    requested_at=case when next_competency<>progress.current_competency then null else requested_at end,
    focus=case when next_competency<>progress.current_competency then '{}'::text[] else focus end,
    position_started_on=case when next_competency/2<>progress.current_competency/2 then (now() at time zone 'America/New_York')::date else position_started_on end
   where gradebook_id=p_book and student_id=p_student;
 else
  update public.wld110_shop_progress set revision=revision+1,requested_at=case when p_competency=progress.current_competency then null else requested_at end,focus=case when p_competency=progress.current_competency then v_focus else focus end
   where gradebook_id=p_book and student_id=p_student;
 end if;
 return private.wld110_snapshot(p_book,p_student);
end $$;

create or replace function public.record_wld105_homework_status(
  p_gradebook_id uuid,
  p_student_id uuid,
  p_chapter_code text,
  p_complete boolean,
  p_completed_on date default null,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item uuid;
  v_attempt uuid;
  v_final_day date;
  v_local_today date := (now() at time zone 'America/New_York')::date;
  v_completed_on date;
begin
  perform public.ensure_wld105_gradebook_setup(p_gradebook_id);

  if p_chapter_code not in ('fundamental_smaw','ofc','welding_joint_design','weld_symbols') then
    raise exception 'Unknown WLD 105 homework chapter';
  end if;

  if not exists (
    select 1 from public.gradebook_students
    where gradebook_id=p_gradebook_id and student_id=p_student_id and active
  ) then
    raise exception 'Student is not actively enrolled';
  end if;

  select max(pd.scheduled_date) into v_final_day
  from public.gradebooks g
  join public.planner_days pd on pd.section_id=g.section_id
  where g.id=p_gradebook_id;

  if v_final_day is null then
    raise exception 'Final instructional day is not configured for this section';
  end if;

  if p_complete then
    v_completed_on := coalesce(p_completed_on,v_local_today);
    if v_completed_on > v_local_today then
      raise exception 'Homework completion date cannot be in the future';
    end if;
    if v_completed_on > v_final_day then
      raise exception 'Homework completed after the final instructional day does not earn course credit';
    end if;
  else
    v_completed_on := null;
  end if;

  select id into v_item
  from public.gradebook_items
  where gradebook_id=p_gradebook_id
    and assessment_slug='homework:'||p_chapter_code;

  if v_item is null then
    raise exception 'Homework item is not configured';
  end if;

  select a.id into v_attempt
  from public.gradebook_attempts a
  where a.gradebook_id=p_gradebook_id
    and a.item_id=v_item
    and a.student_id=p_student_id
    and a.source_submission_id is null
  order by a.attempted_at desc,a.id desc
  limit 1;

  if v_attempt is null then
    v_attempt := private.record_gradebook_attempt(
      p_gradebook_id,v_item,p_student_id,
      case when p_complete then 'graded' else 'ungraded' end,
      case when p_complete then 100 else null end,
      case when p_complete then 100 else null end,
      case when p_complete then 'AWS homework completed' else 'AWS homework pending' end,
      null
    );
  else
    perform private.record_gradebook_attempt(
      p_gradebook_id,v_item,p_student_id,
      case when p_complete then 'graded' else 'ungraded' end,
      case when p_complete then 100 else null end,
      case when p_complete then 100 else null end,
      coalesce(nullif(trim(p_note),''),
        case when p_complete then 'AWS homework corrected to complete' else 'AWS homework corrected to pending' end),
      v_attempt
    );
  end if;

  insert into public.wld105_homework_events(
    gradebook_id,student_id,chapter_code,status,completed_on,note,recorded_by
  ) values (
    p_gradebook_id,p_student_id,p_chapter_code,
    case when p_complete then 'complete' else 'pending' end,
    v_completed_on,coalesce(p_note,''),auth.uid()
  );

  return jsonb_build_object(
    'chapter_code',p_chapter_code,
    'status',case when p_complete then 'complete' else 'pending' end,
    'completed_on',v_completed_on,
    'final_day',v_final_day,
    'course_points',case when p_complete then 12.5 else 0 end
  );
end;
$$;

commit;
