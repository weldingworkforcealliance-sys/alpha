begin;
create temp table journey_results(test text, passed boolean) on commit drop;
do $test$
declare v_student_id uuid; class_id uuid; job_id uuid; payload jsonb; submitted uuid;
c text:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
j text:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
slug text:='staging-contract-'||gen_random_uuid()::text;
ok boolean;
begin
insert into public.attendance_students(school_id,display_name,external_student_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic Student','SYNTH-1') returning id into v_student_id;
insert into public.attendance_pair_enrollments(school_id,pair_id,student_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','67c0fcb1-124c-4440-b936-5ac9eedd35b1',v_student_id);
insert into public.assessment_modules(slug,title) values(slug,'Synthetic staging assessment');
insert into public.assessment_questions(assessment_slug,question_key,question_number,question_type,question_text,domain,options,correct_answer)
values(slug,'q1',1,'mc','Synthetic question','test','["A","B"]','A');
insert into public.classroom_sessions(school_id,section_id,instructor_id,assessment_slug,join_code,expires_at,expected_students)
values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000003','11111111-1111-4111-8111-222222222222',slug,c,now()+interval '10 minutes',2) returning id into class_id;
insert into public.job_card_sessions(school_id,section_id,instructor_id,join_code,expected_students,job_title,requirements,expires_at)
values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000003','11111111-1111-4111-8111-222222222222',j,2,'Synthetic staging job','[{"key":"r1","label":"Synthetic dimension","requiredValue":"1"}]',now()+interval '10 minutes') returning id into job_id;
perform set_config('request.jwt.claims','{"role":"anon"}',true);
execute 'set local role anon';
payload:=public.get_classroom_assessment(' '||lower(c)||' ');
execute 'reset role';
insert into journey_results values('anonymous classroom read',payload->'session'->>'session_id'=class_id::text);
insert into journey_results values('answer key omitted',not ((payload->'questions'->0) ? 'correct_answer'));
execute 'set local role anon';
payload:=public.submit_classroom_assessment_v2(c,'Synthetic Student','SYNTH-1',null,'{"q1":"A"}');
execute 'reset role';
insert into journey_results values('classroom valid submission',(payload->>'score')::int=1);
insert into journey_results values('classroom submission persisted in test transaction',exists(select 1 from public.classroom_submissions where classroom_session_id=class_id and student_id='SYNTH-1'));
ok:=false;
begin
execute 'set local role anon';
perform public.submit_classroom_assessment_v2(c,'Synthetic Student',' synth-1 ',null,'{"q1":"A"}');
exception when others then ok:=SQLERRM='This Student ID has already submitted';
end;
execute 'reset role';
insert into journey_results values('classroom duplicate denied',ok);
execute 'set local role anon';
payload:=public.get_job_card_by_code(' '||lower(j)||' ');
execute 'reset role';
insert into journey_results values('anonymous job read',payload->>'sessionId'=job_id::text);
execute 'set local role anon';
submitted:=public.submit_job_card(j,'Synthetic Student','SYNTH-1','{"drawingReviewed":true,"procedureReviewed":true,"materialJointVerified":true}','{"requirementsChecked":true,"correctionsRecorded":true,"readyForInstructor":true}','[{"key":"r1","status":"pass","actualValue":"1"}]');
execute 'reset role';
insert into journey_results values('job submission persisted in test transaction',exists(select 1 from public.job_card_submissions where id=submitted and job_card_session_id=job_id));
ok:=false;
begin
execute 'set local role anon';
perform public.submit_job_card(j,'Synthetic Student',' synth-1 ','{"drawingReviewed":true,"procedureReviewed":true,"materialJointVerified":true}','{"requirementsChecked":true,"correctionsRecorded":true,"readyForInstructor":true}','[{"key":"r1","status":"pass","actualValue":"1"}]');
exception when others then ok:=SQLERRM='A Job Card has already been submitted for this Student ID';
end;
execute 'reset role';
insert into journey_results values('job duplicate denied',ok);
update public.classroom_sessions set expires_at=now()-interval '1 minute' where id=class_id;
update public.job_card_sessions set expires_at=now()-interval '1 minute' where id=job_id;
ok:=false;
begin
execute 'set local role anon';
perform public.get_classroom_assessment(c);
exception when others then ok:=SQLERRM='This class code is invalid or the session has ended';
end;
execute 'reset role';
insert into journey_results values('expired classroom denied',ok);
ok:=false;
begin
execute 'set local role anon';
perform public.get_job_card_by_code(j);
exception when others then ok:=SQLERRM='This Live Job Card code is invalid or expired';
end;
execute 'reset role';
insert into journey_results values('expired job denied',ok);
end $test$;
do $assert$ begin
  if exists(select 1 from journey_results where passed is not true) then
    raise exception 'Staging contract test failed; inspect test results';
  end if;
end $assert$;
select * from journey_results;
rollback;