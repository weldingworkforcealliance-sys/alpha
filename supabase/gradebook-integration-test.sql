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
 item uuid; attempt uuid; n integer; result jsonb; denied boolean;
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
end $$;
rollback;
select 'PASS: automatic gradebooks/rosters, future semesters, isolated imports, attempts/revisions, withdrawal, score validation, tenant RLS and anonymous denial' as gradebook_test_result;



