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
 item uuid; item2 uuid; attempt uuid; fingerprint text; final_id uuid; n integer; result jsonb; denied boolean; custom_id uuid:=gen_random_uuid(); custom_definition jsonb;
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

 perform public.refresh_gradebook(book_l);
 perform public.configure_gradebook(book_l,'category','weld_performance','Weld Performance');
 perform public.configure_gradebook(book_l,'category','shop_projects','Shop Projects');
 select public.create_gradebook_item(book_l,id,'Required welding') into item from public.gradebook_categories where gradebook_id=book_l and code='weld_performance';
 select public.create_gradebook_item(book_l,id,'Required project') into item2 from public.gradebook_categories where gradebook_id=book_l and code='shop_projects';
 result:=public.preview_gradebook_final(book_l,student);
 if (result->>'ready')::boolean then raise exception 'FAIL blank course finalized'; end if;
 attempt:=public.record_gradebook_attempt(book_l,item,student,'graded',80,100);
 perform public.record_gradebook_attempt(book_l,item2,student,'graded',20,100);
 result:=public.preview_gradebook_final(book_l,student);
 if not (result->>'ready')::boolean or (result->>'grade')::numeric<>65 then raise exception 'FAIL weighted grade: %',result; end if;
 fingerprint:=result->>'fingerprint';
 final_id:=public.finalize_gradebook_student(book_l,student,fingerprint,'Synthetic initial final');
 if public.finalize_gradebook_student(book_l,student,fingerprint,'Retry')<>final_id then raise exception 'FAIL duplicate final'; end if;
 perform public.record_gradebook_attempt(book_l,item,student,'graded',60,100,'Synthetic correction',attempt);
 denied:=false;
 begin perform public.finalize_gradebook_student(book_l,student,fingerprint,'Stale final'); exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'FAIL stale final accepted'; end if;
 result:=public.preview_gradebook_final(book_l,student);
 if (result->>'grade')::numeric<>50 then raise exception 'FAIL corrected total'; end if;
 perform public.finalize_gradebook_student(book_l,student,result->>'fingerprint','Synthetic corrected final');
 if (select count(*) from public.gradebook_finalizations where gradebook_id=book_l)<>2 then raise exception 'FAIL final history'; end if;
 denied:=false;begin update public.gradebook_finalizations set reason='changed' where id=final_id; exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'FAIL mutable final'; end if;
 perform public.record_gradebook_attempt(book_l,item,student,'graded',80,100,'Restore original score',attempt);
 result:=public.preview_gradebook_final(book_l,student);
 perform public.finalize_gradebook_student(book_l,student,result->>'fingerprint','Restore original reviewed grade');
 if (select count(*) from public.gradebook_finalizations where gradebook_id=book_l)<>3 then raise exception 'FAIL restoration did not append history';end if;
 if (select (snapshot->>'grade')::numeric from public.gradebook_finalizations where gradebook_id=book_l order by revision desc limit 1)<>65 then raise exception 'FAIL restored current final';end if;
 perform public.record_gradebook_attempt(book_l,item,student,'missing',0,100,'Missing work',attempt);
 result:=public.preview_gradebook_final(book_l,student);
 if (result->>'grade')::numeric<>5 then raise exception 'FAIL missing grade'; end if;
 perform public.record_gradebook_attempt(book_l,item,student,'excused',null,null,'Excused',attempt);
 result:=public.preview_gradebook_final(book_l,student);
 if (result->>'ready')::boolean then raise exception 'FAIL empty weighted category'; end if;
 perform public.refresh_gradebook(book_t);
 perform public.configure_gradebook(book_t,'category','theory_assessments','Theory');
 perform public.configure_gradebook(book_t,'category','fabrication_projects','Fabrication');
 perform public.configure_gradebook(book_t,'category','homework','Homework');
 select public.create_gradebook_item(book_t,id,'Theory requirement') into item from public.gradebook_categories where gradebook_id=book_t and code='theory_assessments';
 perform public.record_gradebook_attempt(book_t,item,student,'graded',75,100);
 select public.create_gradebook_item(book_t,id,'Fabrication requirement') into item from public.gradebook_categories where gradebook_id=book_t and code='fabrication_projects';
 perform public.record_gradebook_attempt(book_t,item,student,'graded',80,100);
 select public.create_gradebook_item(book_t,id,'Homework requirement') into item from public.gradebook_categories where gradebook_id=book_t and code='homework';
 perform public.record_gradebook_attempt(book_t,item,student,'graded',40,100);
 result:=public.preview_gradebook_final(book_t,student);
 if not (result->>'ready')::boolean or (result->>'grade')::numeric<>67.5 then raise exception 'FAIL theory weights: %',result;end if;
 perform set_config('request.jwt.claim.sub',stranger::text,true);
 denied:=false;begin perform public.preview_gradebook_final(book_l,student);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL cross-school preview';end if;
 execute 'set local role authenticated';
 if exists(select 1 from public.gradebook_finalizations where gradebook_id=book_l) then raise exception 'FAIL cross-school snapshot';end if;
 execute 'reset role';
end $$;
rollback;

