-- Custom assignments belong to one authorized lab gradebook.
alter table public.tower_assignments add column gradebook_id uuid references public.gradebooks(id);
create index tower_assignments_gradebook_idx on public.tower_assignments(gradebook_id);
alter policy tower_catalog_read on public.tower_assignments using(
 (select auth.uid()) is not null and (gradebook_id is null or public.can_access_gradebook(gradebook_id)));

create function public.create_tower_assignment(p_gradebook_id uuid,p_id uuid,p_definition jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare definition jsonb; existing jsonb; assignment_id text:='custom:'||p_id::text;
begin
 perform public.tower_assert_access(p_gradebook_id);
 if p_id is null or jsonb_typeof(p_definition) is distinct from 'object' or octet_length(p_definition::text)>5000
  or length(trim(coalesce(p_definition->>'name',''))) not between 1 and 160
  or length(trim(coalesce(p_definition->>'process',''))) not between 1 and 80
  or coalesce(p_definition->>'type','') not in('position','project') then raise exception 'Enter an assignment name, process and type'; end if;
 definition:=jsonb_build_object('id',assignment_id,'name',trim(p_definition->>'name'),'process',trim(p_definition->>'process'),
  'processId','custom','position',left(coalesce(p_definition->>'position',''),40),'electrode',left(coalesce(p_definition->>'electrode',''),100),
  'type',p_definition->>'type','rubricType','weld','family','Custom','material','','backing','N/A');
 perform pg_advisory_xact_lock(hashtextextended('tower-assignment:'||p_gradebook_id::text,0));
 select a.definition into existing from public.tower_assignments a where id=assignment_id and gradebook_id=p_gradebook_id;
 if existing is not null then
  if existing<>definition then raise exception 'Assignment request changed; use a new assignment'; end if;
  return existing;
 end if;
 if (select count(*) from public.tower_assignments where gradebook_id=p_gradebook_id)>=500 then raise exception 'This class has reached its assignment limit'; end if;
 insert into public.tower_assignments(id,definition,gradebook_id) values(assignment_id,definition,p_gradebook_id);
 return definition;
end $$;
revoke all on function public.create_tower_assignment(uuid,uuid,jsonb) from public,anon;
grant execute on function public.create_tower_assignment(uuid,uuid,jsonb) to authenticated;

create or replace function public.open_tower(p_gradebook_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.tower_assert_access(p_gradebook_id);
 perform public.refresh_gradebook(p_gradebook_id);
 -- The unique student key makes the identity stable across courses and concurrent opens.
 insert into public.tower_student_ids(student_id)
 select r.student_id from public.gradebook_roster r where r.gradebook_id=p_gradebook_id and r.active and not exists(select 1 from public.tower_student_ids i where i.student_id=r.student_id)
 on conflict(student_id) do nothing;
 select jsonb_build_object(
  'book',(select to_jsonb(g) from public.gradebook_directory g where id=p_gradebook_id),
  'students',coalesce((select jsonb_agg(jsonb_build_object(
    'id',r.student_id,'name',r.display_name,'active',r.active,
    'weldTestId',lpad(i.weld_test_id::text,4,'0'),'revision',coalesce(t.revision,0),'data',coalesce(t.data,'{}'::jsonb))
    order by r.display_name,r.student_id)
   from public.gradebook_roster r join public.tower_student_ids i on i.student_id=r.student_id
   left join public.tower_records t on t.gradebook_id=p_gradebook_id and t.student_id=r.student_id
   where r.gradebook_id=p_gradebook_id),'[]'::jsonb),
  'assignments',coalesce((select jsonb_agg(definition order by id) from public.tower_assignments where gradebook_id is null or gradebook_id=p_gradebook_id),'[]'::jsonb)
 ) into result;
 return result;
end $$;

create or replace function public.save_tower_student(p_gradebook_id uuid,p_student_id uuid,p_revision bigint,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old_data jsonb; old_revision bigint; assignment record; attempt jsonb; previous jsonb;
 criterion text; n integer; score numeric; category uuid; item uuid; attempt_id uuid;
 test jsonb; prior_test jsonb; test_id uuid; cert jsonb; identity_text text;
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
   attempt_id:=public.record_gradebook_attempt(p_gradebook_id,item,p_student_id,status,score,
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
  test_id:=(test->>'id')::uuid;
  if coalesce(test->>'result','') not in('Pass','Fail') or test->>'weldTestId' is distinct from identity_text
   or test->>'studentRecordId' is distinct from p_student_id::text or test->>'courseId' is distinct from p_gradebook_id::text
   then raise exception 'Invalid destructive-test identity or result'; end if;
  if not exists(select 1 from public.tower_permanent_tests where id=test_id) and not exists(select 1 from public.gradebook_roster r join public.gradebook_directory g on g.id=r.gradebook_id
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
   values(test_id,p_gradebook_id,p_student_id,test-'certificate',auth.uid()) on conflict(id) do nothing;
  if not exists(select 1 from public.tower_permanent_tests where id=test_id and gradebook_id=p_gradebook_id
   and student_id=p_student_id and evidence=test-'certificate') then raise exception 'Destructive-test identity collision'; end if;
  cert:=test->'certificate';
  if cert is not null and cert<>'null'::jsonb then
   if test->>'result'<>'Pass' then raise exception 'Only passing tests can receive certificates'; end if;
   -- Certificate evidence always derives from the permanent database test, not an editable client snapshot.
   insert into public.tower_certificates(test_id,gradebook_id,student_id,snapshot,issued_by)
    select id,gradebook_id,student_id,evidence,auth.uid() from public.tower_permanent_tests where id=test_id
    on conflict(test_id) do nothing;
  end if;
 end loop;
 update public.tower_records set revision=old_revision+1,data=p_data,updated_at=now(),updated_by=auth.uid()
  where gradebook_id=p_gradebook_id and student_id=p_student_id;
 insert into public.tower_history(gradebook_id,student_id,revision,data,recorded_by)
  values(p_gradebook_id,p_student_id,old_revision+1,p_data,auth.uid());
 return jsonb_build_object('revision',old_revision+1);
end $$;
