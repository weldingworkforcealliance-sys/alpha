-- Run only against an isolated staging database. All fixture changes roll back.
begin;
do $$
declare
 school uuid := gen_random_uuid(); other_school uuid := gen_random_uuid();
 actor uuid := gen_random_uuid(); stranger uuid := gen_random_uuid(); teacher uuid := gen_random_uuid();
 program uuid := gen_random_uuid(); level1 uuid := gen_random_uuid(); level2 uuid := gen_random_uuid();
 theory uuid := gen_random_uuid(); lab uuid := gen_random_uuid();
 section_t uuid := gen_random_uuid(); section_l uuid := gen_random_uuid();
 pair uuid := gen_random_uuid(); student uuid := gen_random_uuid(); student2 uuid := gen_random_uuid();
 book_t uuid; book_l uuid; curriculum_pair uuid; semester4 uuid;
 session1 uuid := gen_random_uuid(); session2 uuid := gen_random_uuid();
 slug text := 'gradebook_test_'||replace(gen_random_uuid()::text,'-','');
 item uuid; attempt uuid; n integer; result jsonb; denied boolean; custom_id uuid:=gen_random_uuid(); custom_definition jsonb;
begin
 insert into public.schools(id,name) values(school,'Gradebook transactional test'),(other_school,'Other gradebook test school');
 insert into auth.users(id) values(actor),(stranger),(teacher);
 insert into public.school_memberships(school_id,user_id,role,status) values(school,actor,'school_admin','active'),(other_school,stranger,'school_admin','active'),(school,teacher,'instructor','active');
 insert into public.programs(id,school_id,name) values(program,school,'Gradebook test program');
 insert into public.program_levels(id,school_id,program_id,level_code,level_name,sequence_number)
 values(level1,school,program,'L1','Level I',1),(level2,school,program,'L2','Level II',2);
 insert into public.courses(id,school_id,program_id,course_code,course_name)
 values(theory,school,program,'GB THEORY','Test theory'),(lab,school,program,'GB LAB','Test lab');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 curriculum_pair := public.configure_gradebook_course_pair(level1,1,'Semester 1','Test linked courses',theory,lab);
 semester4 := public.configure_gradebook_course_pair(level2,4,'Semester 4','Future linked courses',theory,lab);
 if semester4 is null then raise exception 'FAIL no semesters beyond three'; end if;
 insert into public.sections(id,school_id,course_id,section_name) values(section_t,school,theory,'Theory test'),(section_l,school,lab,'Lab test');
 select id into book_t from public.gradebooks where section_id=section_t;
 select id into book_l from public.gradebooks where section_id=section_l;
 if book_t is null or book_l is null or book_t=book_l then raise exception 'FAIL automatic section books'; end if;
 perform public.assign_gradebook_course_pair(book_t,curriculum_pair);
 perform public.assign_gradebook_course_pair(book_l,curriculum_pair);
 insert into public.attendance_pairs(id,school_id,pair_name,primary_section_id,completion_section_id)
 values(pair,school,'Test shared enrollment',section_t,section_l);
 insert into public.attendance_students(id,school_id,display_name,external_student_id)
 values(student,school,'Test Student One','GB-ONE'),(student2,school,'Test Student Two','GB-TWO');
 insert into public.attendance_pair_enrollments(school_id,pair_id,student_id) values(school,pair,student),(school,pair,student2);
 select count(*) into n from public.gradebook_roster where gradebook_id=book_t;
 if n<>2 then raise exception 'FAIL immediate automatic roster: %',n; end if;
 insert into public.assessment_modules(slug,title) values(slug,'Gradebook test assessment');
 insert into public.classroom_sessions(id,school_id,section_id,instructor_id,assessment_slug,join_code)
 values(session1,school,section_t,actor,slug,gen_random_uuid()::text),(session2,school,section_t,actor,slug,gen_random_uuid()::text);
 insert into public.classroom_submissions(classroom_session_id,student_name,student_id,student_uuid,answers,score,possible_score)
 values(session1,'Test One','GB-ONE',student,'{}',0,10),(session2,'Test One','GB-ONE',student,'{}',9,10),
 (session1,'Test Two','GB-TWO',student2,'{}',8,10);
 -- Model a pre-identity-link historical row using only this transaction's synthetic data.
 update public.classroom_submissions set student_uuid=null where classroom_session_id=session1 and student_id='GB-TWO';
 result := public.refresh_gradebook(book_t);
 if (result->>'imported')::integer<>2 or (result->>'unresolved')::integer<>1 then raise exception 'FAIL import counters: %',result; end if;
 result := public.refresh_gradebook(book_t);
 if (result->>'imported')::integer<>0 then raise exception 'FAIL repeated import duplicates'; end if;
 perform public.refresh_gradebook(book_l);
 select count(*) into n from public.gradebook_attempts where gradebook_id=book_l;
 if n<>0 then raise exception 'FAIL theory flowed into lab'; end if;
 perform public.configure_gradebook(book_l,'category','custom','Custom category');
 select id into item from public.gradebook_categories where gradebook_id=book_l and code='custom';
 item := public.create_gradebook_item(book_l,item,'Teacher-defined item');
 perform public.configure_gradebook(book_l,'status','pending_review','Pending review',true,false);
 attempt := public.record_gradebook_attempt(book_l,item,student,'pending_review');
 perform public.record_gradebook_attempt(book_l,item,student,'graded',8,10,'Reviewed',attempt);
 perform public.record_gradebook_attempt(book_l,item,student,'graded',9,10,'Corrected transcription',attempt);
 select count(*) into n from public.gradebook_revisions where attempt_id=attempt;
 if n<>3 then raise exception 'FAIL revision history: %',n; end if;
 select count(*) into n from public.gradebook_latest_attempts where id=attempt and score=9;
 if n<>1 then raise exception 'FAIL latest revision'; end if;
 denied := false;
 begin perform public.record_gradebook_attempt(book_l,item,student,'graded',20,10); exception when check_violation then denied:=true; end;
 if not denied then raise exception 'FAIL invalid score accepted'; end if;
 denied := false;
 begin perform public.record_gradebook_attempt(book_t,item,student,'graded',5,10); exception when foreign_key_violation then denied:=true; end;
 if not denied then raise exception 'FAIL cross-book item accepted'; end if;
 denied := false;
 begin update public.gradebook_revisions set score=1 where attempt_id=attempt; exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'FAIL mutable grade history'; end if;
 update public.attendance_pair_enrollments set active=false where pair_id=pair and student_id=student;
 denied := false;
 begin perform public.record_gradebook_attempt(book_l,item,student,'graded',5,10); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'FAIL stale open roster allowed a withdrawn student attempt'; end if;
 perform public.refresh_gradebook(book_l);
 select count(*) into n from public.gradebook_students where gradebook_id=book_l and student_id=student and not active;
 if n<>1 then raise exception 'FAIL withdrawal roster'; end if;
 select count(*) into n from public.gradebook_revisions where attempt_id=attempt;
 if n<>3 then raise exception 'FAIL withdrawal lost history'; end if;
 denied := false;
 begin perform public.record_gradebook_attempt(book_l,item,student,'graded',5,10); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'FAIL withdrawn new attempt'; end if;
 -- A same-school instructor needs a section assignment; the partner book is not implicitly granted.
 perform set_config('request.jwt.claim.sub',teacher::text,true);
 execute 'set local role authenticated';
 select count(*) into n from public.gradebooks where id in(book_t,book_l);
 if n<>0 then raise exception 'FAIL unassigned instructor access'; end if;
 execute 'reset role';
 insert into public.section_instructors(school_id,section_id,instructor_id,instructor_role,active)
 values(school,section_t,teacher,'instructor',true);
 execute 'set local role authenticated';
 select count(*) into n from public.gradebook_directory where id in(book_t,book_l);
 if n<>1 then raise exception 'FAIL assigned instructor access'; end if;
 select count(*) into n from public.gradebook_roster where gradebook_id=book_t;
 if n<>2 then raise exception 'FAIL assigned instructor roster'; end if;
 denied := false;
 begin perform public.assign_gradebook_course_pair(book_t,curriculum_pair); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FAIL instructor catalog management'; end if;
 execute 'reset role';
 -- Execute RLS reads under the actual authenticated role, with a different school's identity.
 perform set_config('request.jwt.claim.sub',stranger::text,true);
 execute 'set local role authenticated';
 select count(*) into n from public.gradebooks where id in(book_t,book_l);
 if n<>0 then raise exception 'FAIL cross-school RLS'; end if;
 denied := false;
 begin perform public.refresh_gradebook(book_t); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FAIL cross-school RPC'; end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',actor::text,true);
 execute 'set local role authenticated';
 select count(*) into n from public.gradebooks where id in(book_t,book_l);
 if n<>2 then raise exception 'FAIL school manager read'; end if;
 denied := false;
 begin delete from public.gradebook_revisions where attempt_id=attempt; exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FAIL direct delete privilege'; end if;
 execute 'reset role';
 execute 'set local role anon';
 denied := false;
 begin perform public.refresh_gradebook(book_t); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FAIL anonymous RPC'; end if;
 execute 'reset role';

 -- Tower checks use only the synthetic identities above.
 perform set_config('request.jwt.claim.sub',actor::text,true);
 result:=public.open_tower(book_l);
 if jsonb_array_length(result->'students')<>1 then raise exception 'FAIL Tower roster'; end if;
 if not exists(select 1 from public.tower_student_ids where student_id=student2) then raise exception 'FAIL permanent identity'; end if;
 result:=public.save_tower_student(book_l,student2,0,'{"lab":{"smaw-fillet-1F":{"attempt1":{"scores":{"consistency":20,"defects":20,"procedure":20,"restarts":20,"beadSize":20},"defects":[]}}},"exams":{},"competencies":{},"positionQualifications":{},"destructiveTests":[]}'::jsonb);
 if (result->>'revision')::int<>1 then raise exception 'FAIL revision'; end if;
 if not exists(select 1 from public.tower_grade_links l join public.gradebook_latest_attempts a on a.id=l.attempt_id where l.student_id=student2 and a.score=95)
  then raise exception 'FAIL gradebook write'; end if;
 denied:=false;
 begin perform public.save_tower_student(book_l,student2,0,'{"lab":{},"exams":{},"competencies":{},"positionQualifications":{},"destructiveTests":[]}'::jsonb);
 exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'FAIL stale revision'; end if;
 result:=public.save_tower_student(book_l,student2,1,'{"lab":{"smaw-fillet-1F":{"attempt1":{"scores":{"consistency":20,"defects":20,"procedure":20,"restarts":20,"beadSize":20},"defects":["crack"]}}},"exams":{},"competencies":{},"positionQualifications":{},"destructiveTests":[]}'::jsonb);
 if not exists(select 1 from public.tower_grade_links l join public.gradebook_latest_attempts a on a.id=l.attempt_id where l.student_id=student2 and a.score=0)
  then raise exception 'FAIL critical F = 0'; end if;
 if public.tower_attempt_score('{"scores":{"consistency":20,"defects":0,"procedure":20,"restarts":20,"beadSize":20},"defects":["crack"]}',2)<>76
  then raise exception 'FAIL Attempt 2 cap'; end if;
 -- A completed second attempt replaces the first, even when it is lower.
 result:=public.save_tower_student(book_l,student2,2,'{"lab":{"smaw-fillet-1F":{"attempt1":{"scores":{"consistency":20,"defects":20,"procedure":20,"restarts":20,"beadSize":20},"defects":[]},"attempt2":{"scores":{"consistency":10,"defects":10,"procedure":10,"restarts":10,"beadSize":10},"defects":[]}}},"exams":{},"competencies":{},"positionQualifications":{},"destructiveTests":[]}'::jsonb);
 if not exists(select 1 from public.tower_effective_grades where gradebook_id=book_l and student_id=student2 and score=47.5 and attempt_number=2)
  then raise exception 'FAIL lower Attempt 2 replacement'; end if;
 select count(*) into n from public.tower_effective_grades where gradebook_id=book_l and student_id=student2;
 if n<>1 then raise exception 'FAIL duplicate counted Tower score'; end if;
 -- Lost-response retry is idempotent, even with its original revision number.
 result:=public.save_tower_student(book_l,student2,2,(select data from public.tower_records where gradebook_id=book_l and student_id=student2));
 if (result->>'revision')::int<>3 then raise exception 'FAIL retry duplicated revision'; end if;
 denied:=false;
 begin perform public.save_tower_student(book_l,student2,3,
  jsonb_set((select data from public.tower_records where gradebook_id=book_l and student_id=student2),'{lab,smaw-fillet-1F,attempt2,scores}','{}'));
 exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'FAIL cleared completed rubric'; end if;
 custom_definition:=public.create_tower_assignment(book_l,custom_id,'{"name":"Synthetic shop project","process":"SMAW","type":"project"}');
 if public.create_tower_assignment(book_l,custom_id,'{"name":"Synthetic shop project","process":"SMAW","type":"project"}')<>custom_definition
  then raise exception 'FAIL assignment retry'; end if;
 result:=(select data from public.tower_records where gradebook_id=book_l and student_id=student2);
 result:=jsonb_set(result,array['lab',custom_definition->>'id'], '{"attempt1":{"scores":{"consistency":20,"defects":20,"procedure":20,"restarts":20,"beadSize":20},"defects":[]}}');
 perform public.save_tower_student(book_l,student2,3,result);
 if not exists(select 1 from public.tower_effective_grades e join public.gradebook_items i on i.id=e.item_id
  join public.gradebook_categories c on c.id=i.category_id where e.student_id=student2 and e.assignment_id=custom_definition->>'id' and e.score=95 and c.code='shop_projects')
  then raise exception 'FAIL custom shop project grade'; end if;
 -- Passing destructive evidence and its certificate retain immutable snapshots.
 result:=(select data from public.tower_records where gradebook_id=book_l and student_id=student2);
 result:=jsonb_set(result,'{destructiveTests}',jsonb_build_array(jsonb_build_object(
  'id',custom_id,'result','Pass','studentRecordId',student2,'studentName','Test Student Two',
  'weldTestId',(select lpad(weld_test_id::text,4,'0') from public.tower_student_ids where student_id=student2),
  'courseId',book_l,'courseCode','GB LAB','process','SMAW','material','Carbon Steel','specification','Synthetic test',
  'fillerMetal','E7018','plate','3/8','position','1G','testMethod','Bend','inspector','Synthetic Inspector',
  'testDate','2026-09-18','faceBendResult','Satisfactory','rootBendResult','Satisfactory','certificate',null)));
 perform public.save_tower_student(book_l,student2,4,result);
 result:=jsonb_set(result,'{destructiveTests,0,certificate}','{"version":1}');
 perform public.save_tower_student(book_l,student2,5,result);
 if not exists(select 1 from public.tower_certificates where test_id=custom_id and snapshot->>'studentName'='Test Student Two' and snapshot->>'result'='Pass')
  then raise exception 'FAIL certificate snapshot'; end if;
 denied:=false;
 begin perform public.save_tower_student(book_l,student2,6,jsonb_set(result,'{destructiveTests,0,certificate}','null'));
 exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'FAIL certificate removal'; end if;
 denied:=false;
 begin perform public.save_tower_student(book_l,student2,6,jsonb_set(result,'{destructiveTests}','[]'));
 exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'FAIL permanent test removal'; end if;
 update public.attendance_students set display_name='Test Student Two Updated' where id=student2;
 result:=jsonb_set(result,'{aws}','{"registrationStatus":"Pending"}');
 perform public.save_tower_student(book_l,student2,6,result);
 if (select snapshot->>'studentName' from public.tower_certificates where test_id=custom_id)<>'Test Student Two'
  then raise exception 'FAIL historical certificate name changed'; end if;
 denied:=false;
 begin perform public.save_tower_student(book_l,student,0,'{}'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FAIL withdrawn Tower student'; end if;
 perform set_config('request.jwt.claim.sub',stranger::text,true);
 execute 'set local role authenticated';
 select count(*) into n from public.tower_records where gradebook_id=book_l;
 if n<>0 then raise exception 'FAIL Tower cross-school RLS'; end if;
 select count(*) into n from public.tower_assignments where gradebook_id=book_l;
 if n<>0 then raise exception 'FAIL custom assignment cross-school RLS'; end if;
 denied:=false;
 begin perform public.open_tower(book_l); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FAIL Tower unauthorized open'; end if;
 execute 'reset role';
 execute 'set local role anon';
 denied:=false;
 begin perform public.open_tower(book_l); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FAIL Tower anonymous access'; end if;
 execute 'reset role';

end $$;
rollback;
select 'PASS: automatic gradebooks/rosters, future semesters, isolated imports, attempts/revisions, withdrawal, score validation, tenant RLS and anonymous denial' as gradebook_test_result;
