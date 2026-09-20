-- Staging-only synthetic verification. No retained students, grades, coaching or links.
begin;
do $$
declare
 school uuid:=gen_random_uuid(); other_school uuid:=gen_random_uuid();
 actor uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid(); teacher uuid:=gen_random_uuid();
 program uuid:=gen_random_uuid(); lvl uuid:=gen_random_uuid();
 theory uuid:=gen_random_uuid(); lab uuid:=gen_random_uuid();
 section_t uuid:=gen_random_uuid(); section_l uuid:=gen_random_uuid();
 pair uuid:=gen_random_uuid(); student uuid:=gen_random_uuid(); student2 uuid:=gen_random_uuid();
 book uuid; course_pair uuid; token text; token2 text; save_id uuid; first_id uuid;
 result jsonb; before_state jsonb; board jsonb; ratings jsonb; first_ratings jsonb;
 denied boolean; n integer; i integer; rev integer; stamp text; score numeric;
 today date:=(now() at time zone 'America/New_York')::date;
begin
 insert into public.schools(id,name) values(school,'WLD110 synthetic QA'),(other_school,'WLD110 other QA');
 insert into auth.users(id) values(actor),(stranger),(teacher);
 insert into public.school_memberships(school_id,user_id,role,status)
 values(school,actor,'school_admin','active'),(other_school,stranger,'school_admin','active'),(school,teacher,'instructor','active');
 insert into public.programs(id,school_id,name) values(program,school,'WLD110 QA program');
 insert into public.program_levels(id,school_id,program_id,level_code,level_name,sequence_number)
 values(lvl,school,program,'L2','Level II',2);
 insert into public.courses(id,school_id,program_id,course_code,course_name)
 values(theory,school,program,'WLD 105','QA theory'),(lab,school,program,'WLD 110','QA lab');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 course_pair:=public.configure_gradebook_course_pair(lvl,1,'Semester 1','QA courses',theory,lab);
 insert into public.sections(id,school_id,course_id,section_name)
 values(section_t,school,theory,'QA theory'),(section_l,school,lab,'QA lab');
 select id into book from public.gradebooks where section_id=section_l;
 perform public.assign_gradebook_course_pair(book,course_pair);
 insert into public.attendance_pairs(id,school_id,pair_name,primary_section_id,completion_section_id)
 values(pair,school,'QA shared enrollment',section_t,section_l);
 insert into public.attendance_students(id,school_id,display_name,external_student_id)
 values(student,school,'Synthetic One','SHOP-QA-1'),(student2,school,'Synthetic Two','SHOP-QA-2');
 insert into public.attendance_pair_enrollments(school_id,pair_id,student_id)
 values(school,pair,student),(school,pair,student2);
 execute 'set local role authenticated';
 board:=public.open_tower(book);
 result:=public.open_lab_coaching(book);
 if jsonb_array_length(result)<>2 then raise exception 'FAIL lab roster'; end if;
 save_id:=gen_random_uuid();
 result:=public.save_lab_coaching(book,student,0,save_id,'smaw-fillet-1F',array['Travel speed'],'Steady arc');
 if result->>'revision'<>'1' or result->'focus'<>'["Travel speed"]'::jsonb then raise exception 'FAIL coaching save'; end if;
 if (select data from public.tower_records where gradebook_id=book and student_id=student)<>'{}'::jsonb
  or (select revision from public.tower_records where gradebook_id=book and student_id=student)<>0
  or exists(select 1 from public.gradebook_attempts where gradebook_id=book) then raise exception 'FAIL coaching changed grades'; end if;
 result:=public.save_lab_coaching(book,student,0,save_id,'smaw-fillet-1F',array['Travel speed'],'Steady arc');
 if result->>'revision'<>'1' then raise exception 'FAIL duplicate save'; end if;
 denied:=false;begin perform public.save_lab_coaching(book,student,0,gen_random_uuid(),'smaw-fillet-1F',array['Arc length'],'');
 exception when serialization_failure then denied:=true;end;
 if not denied then raise exception 'FAIL stale coaching accepted';end if;
 denied:=false;begin perform public.save_lab_coaching(book,student,1,save_id,'smaw-fillet-1F',array['Arc length'],'');
 exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'FAIL changed retry accepted';end if;
 token:=public.issue_lab_student_link(book,student);token2:=public.issue_lab_student_link(book,student2);
 execute 'set local role anon';
 result:=public.read_lab_student(token);
 if result->>'student_id'<>student::text or result->>'note'<>'Steady arc' or result?'history' or result?'saved_by' then raise exception 'FAIL student snapshot';end if;
 if public.read_lab_student(token2)->>'student_id'<>student2::text then raise exception 'FAIL student isolation';end if;
 result:=public.request_lab_check(token,1);stamp:=result->>'requested_at';
 if stamp is null then raise exception 'FAIL check request';end if;
 result:=public.request_lab_check(token,1);
 if result->>'requested_at'<>stamp then raise exception 'FAIL request duplicate';end if;
 denied:=false;begin perform public.request_lab_check(token,0);exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'FAIL stale request accepted';end if;
 if has_function_privilege(current_user,'public.save_lab_coaching(uuid,uuid,integer,uuid,text,text[],text)','execute')
  or has_table_privilege(current_user,'public.tower_records','select')
  or has_table_privilege(current_user,'private.lab_student_links','select') then raise exception 'FAIL anonymous grant';end if;
 execute 'set local role authenticated';
 result:=public.mark_lab_check_handled(book,student,stamp::timestamptz);
 if result->>'requested_at' is not null then raise exception 'FAIL clear request';end if;
 result:=public.save_tower_student(book,student,0,'{"lab":{},"exams":{},"competencies":{},"positionQualifications":{},"destructiveTests":[]}'::jsonb);
 if (select lab_coaching->>'revision' from public.tower_records where gradebook_id=book and student_id=student)<>'1' then raise exception 'FAIL grading erased coaching';end if;
 before_state:=(select data from public.tower_records where gradebook_id=book and student_id=student);
 result:=public.save_lab_coaching(book,student,1,gen_random_uuid(),'smaw-fillet-1F',array['Arc length'],'Next practice');
 if result->>'revision'<>'2' or (select data from public.tower_records where gradebook_id=book and student_id=student)<>before_state
  or (select jsonb_array_length(lab_coaching->'history') from public.tower_records where gradebook_id=book and student_id=student)<>2 then raise exception 'FAIL coaching history or grade preservation';end if;
 token2:=public.issue_lab_student_link(book,student);
 execute 'set local role anon';
 denied:=false;begin perform public.read_lab_student(token);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL old link not revoked';end if;
 token:=token2;
 execute 'reset role';
 update private.lab_student_links set expires_at=now()-interval '1 day' where gradebook_id=book and student_id=student;
 execute 'set local role anon';
 denied:=false;begin perform public.read_lab_student(token);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL expired link';end if;
 execute 'reset role';
 update private.lab_student_links set expires_at=now()+interval '1 day' where gradebook_id=book and student_id=student;
 update public.attendance_pair_enrollments set active=false where pair_id=pair and student_id=student;
 execute 'set local role anon';
 denied:=false;begin perform public.read_lab_student(token);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL withdrawn student';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',stranger::text,true);
 execute 'set local role authenticated';
 denied:=false;begin perform public.issue_lab_student_link(book,student2);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL cross-school link';end if;
 denied:=false;begin perform public.open_lab_coaching(book);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL cross-school roster';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',actor::text,true);
 execute 'set local role authenticated';
 denied:=false;begin perform public.issue_lab_student_link((select id from public.gradebooks where section_id=section_t),student2);exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'FAIL theory accepted as lab';end if;
 execute 'reset role';
end $$;
do $$
declare
 school uuid:=gen_random_uuid(); other_school uuid:=gen_random_uuid();
 actor uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid(); teacher uuid:=gen_random_uuid();
 program uuid:=gen_random_uuid(); lvl uuid:=gen_random_uuid();
 theory uuid:=gen_random_uuid(); lab uuid:=gen_random_uuid();
 section_t uuid:=gen_random_uuid(); section_l uuid:=gen_random_uuid();
 pair uuid:=gen_random_uuid(); student uuid:=gen_random_uuid(); student2 uuid:=gen_random_uuid();
 book uuid; course_pair uuid; token text; token2 text; save_id uuid; first_id uuid;
 result jsonb; before_state jsonb; board jsonb; ratings jsonb; first_ratings jsonb;
 denied boolean; n integer; i integer; rev integer; stamp text; score numeric;
 today date:=(now() at time zone 'America/New_York')::date;
begin
 insert into public.schools(id,name) values(school,'WLD110 synthetic QA'),(other_school,'WLD110 other QA');
 insert into auth.users(id) values(actor),(stranger),(teacher);
 insert into public.school_memberships(school_id,user_id,role,status)
 values(school,actor,'school_admin','active'),(other_school,stranger,'school_admin','active'),(school,teacher,'instructor','active');
 insert into public.programs(id,school_id,name) values(program,school,'WLD110 QA program');
 insert into public.program_levels(id,school_id,program_id,level_code,level_name,sequence_number)
 values(lvl,school,program,'L2','Level II',2);
 insert into public.courses(id,school_id,program_id,course_code,course_name)
 values(theory,school,program,'WLD 105','QA theory'),(lab,school,program,'WLD 210','QA lab');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 course_pair:=public.configure_gradebook_course_pair(lvl,1,'Semester 1','QA courses',theory,lab);
 insert into public.sections(id,school_id,course_id,section_name)
 values(section_t,school,theory,'QA theory'),(section_l,school,lab,'QA lab');
 select id into book from public.gradebooks where section_id=section_l;
 perform public.assign_gradebook_course_pair(book,course_pair);
 insert into public.attendance_pairs(id,school_id,pair_name,primary_section_id,completion_section_id)
 values(pair,school,'QA shared enrollment',section_t,section_l);
 insert into public.attendance_students(id,school_id,display_name,external_student_id)
 values(student,school,'Synthetic One','SHOP-QA-1'),(student2,school,'Synthetic Two','SHOP-QA-2');
 insert into public.attendance_pair_enrollments(school_id,pair_id,student_id)
 values(school,pair,student),(school,pair,student2);
 execute 'set local role authenticated';
 board:=public.open_tower(book);
 result:=public.open_lab_coaching(book);
 if jsonb_array_length(result)<>2 then raise exception 'FAIL lab roster'; end if;
 save_id:=gen_random_uuid();
 result:=public.save_lab_coaching(book,student,0,save_id,'smaw-fillet-1F',array['Travel speed'],'Steady arc');
 if result->>'revision'<>'1' or result->'focus'<>'["Travel speed"]'::jsonb then raise exception 'FAIL coaching save'; end if;
 if (select data from public.tower_records where gradebook_id=book and student_id=student)<>'{}'::jsonb
  or (select revision from public.tower_records where gradebook_id=book and student_id=student)<>0
  or exists(select 1 from public.gradebook_attempts where gradebook_id=book) then raise exception 'FAIL coaching changed grades'; end if;
 result:=public.save_lab_coaching(book,student,0,save_id,'smaw-fillet-1F',array['Travel speed'],'Steady arc');
 if result->>'revision'<>'1' then raise exception 'FAIL duplicate save'; end if;
 denied:=false;begin perform public.save_lab_coaching(book,student,0,gen_random_uuid(),'smaw-fillet-1F',array['Arc length'],'');
 exception when serialization_failure then denied:=true;end;
 if not denied then raise exception 'FAIL stale coaching accepted';end if;
 denied:=false;begin perform public.save_lab_coaching(book,student,1,save_id,'smaw-fillet-1F',array['Arc length'],'');
 exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'FAIL changed retry accepted';end if;
 token:=public.issue_lab_student_link(book,student);token2:=public.issue_lab_student_link(book,student2);
 execute 'set local role anon';
 result:=public.read_lab_student(token);
 if result->>'student_id'<>student::text or result->>'note'<>'Steady arc' or result?'history' or result?'saved_by' then raise exception 'FAIL student snapshot';end if;
 if public.read_lab_student(token2)->>'student_id'<>student2::text then raise exception 'FAIL student isolation';end if;
 result:=public.request_lab_check(token,1);stamp:=result->>'requested_at';
 if stamp is null then raise exception 'FAIL check request';end if;
 result:=public.request_lab_check(token,1);
 if result->>'requested_at'<>stamp then raise exception 'FAIL request duplicate';end if;
 denied:=false;begin perform public.request_lab_check(token,0);exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'FAIL stale request accepted';end if;
 if has_function_privilege(current_user,'public.save_lab_coaching(uuid,uuid,integer,uuid,text,text[],text)','execute')
  or has_table_privilege(current_user,'public.tower_records','select')
  or has_table_privilege(current_user,'private.lab_student_links','select') then raise exception 'FAIL anonymous grant';end if;
 execute 'set local role authenticated';
 result:=public.mark_lab_check_handled(book,student,stamp::timestamptz);
 if result->>'requested_at' is not null then raise exception 'FAIL clear request';end if;
 result:=public.save_tower_student(book,student,0,'{"lab":{},"exams":{},"competencies":{},"positionQualifications":{},"destructiveTests":[]}'::jsonb);
 if (select lab_coaching->>'revision' from public.tower_records where gradebook_id=book and student_id=student)<>'1' then raise exception 'FAIL grading erased coaching';end if;
 before_state:=(select data from public.tower_records where gradebook_id=book and student_id=student);
 result:=public.save_lab_coaching(book,student,1,gen_random_uuid(),'smaw-fillet-1F',array['Arc length'],'Next practice');
 if result->>'revision'<>'2' or (select data from public.tower_records where gradebook_id=book and student_id=student)<>before_state
  or (select jsonb_array_length(lab_coaching->'history') from public.tower_records where gradebook_id=book and student_id=student)<>2 then raise exception 'FAIL coaching history or grade preservation';end if;
 token2:=public.issue_lab_student_link(book,student);
 execute 'set local role anon';
 denied:=false;begin perform public.read_lab_student(token);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL old link not revoked';end if;
 token:=token2;
 execute 'reset role';
 update private.lab_student_links set expires_at=now()-interval '1 day' where gradebook_id=book and student_id=student;
 execute 'set local role anon';
 denied:=false;begin perform public.read_lab_student(token);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL expired link';end if;
 execute 'reset role';
 update private.lab_student_links set expires_at=now()+interval '1 day' where gradebook_id=book and student_id=student;
 update public.attendance_pair_enrollments set active=false where pair_id=pair and student_id=student;
 execute 'set local role anon';
 denied:=false;begin perform public.read_lab_student(token);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL withdrawn student';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',stranger::text,true);
 execute 'set local role authenticated';
 denied:=false;begin perform public.issue_lab_student_link(book,student2);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL cross-school link';end if;
 denied:=false;begin perform public.open_lab_coaching(book);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL cross-school roster';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',actor::text,true);
 execute 'set local role authenticated';
 denied:=false;begin perform public.issue_lab_student_link((select id from public.gradebooks where section_id=section_t),student2);exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'FAIL theory accepted as lab';end if;
 execute 'reset role';
end $$;
do $$
declare
 school uuid:=gen_random_uuid(); other_school uuid:=gen_random_uuid();
 actor uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid(); teacher uuid:=gen_random_uuid();
 program uuid:=gen_random_uuid(); lvl uuid:=gen_random_uuid();
 theory uuid:=gen_random_uuid(); lab uuid:=gen_random_uuid();
 section_t uuid:=gen_random_uuid(); section_l uuid:=gen_random_uuid();
 pair uuid:=gen_random_uuid(); student uuid:=gen_random_uuid(); student2 uuid:=gen_random_uuid();
 book uuid; course_pair uuid; token text; token2 text; save_id uuid; first_id uuid;
 result jsonb; before_state jsonb; board jsonb; ratings jsonb; first_ratings jsonb;
 denied boolean; n integer; i integer; rev integer; stamp text; score numeric;
 today date:=(now() at time zone 'America/New_York')::date;
begin
 insert into public.schools(id,name) values(school,'WLD110 synthetic QA'),(other_school,'WLD110 other QA');
 insert into auth.users(id) values(actor),(stranger),(teacher);
 insert into public.school_memberships(school_id,user_id,role,status)
 values(school,actor,'school_admin','active'),(other_school,stranger,'school_admin','active'),(school,teacher,'instructor','active');
 insert into public.programs(id,school_id,name) values(program,school,'WLD110 QA program');
 insert into public.program_levels(id,school_id,program_id,level_code,level_name,sequence_number)
 values(lvl,school,program,'L2','Level II',2);
 insert into public.courses(id,school_id,program_id,course_code,course_name)
 values(theory,school,program,'WLD 105','QA theory'),(lab,school,program,'FAB 900','QA lab');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 course_pair:=public.configure_gradebook_course_pair(lvl,1,'Semester 1','QA courses',theory,lab);
 insert into public.sections(id,school_id,course_id,section_name)
 values(section_t,school,theory,'QA theory'),(section_l,school,lab,'QA lab');
 select id into book from public.gradebooks where section_id=section_l;
 perform public.assign_gradebook_course_pair(book,course_pair);
 insert into public.attendance_pairs(id,school_id,pair_name,primary_section_id,completion_section_id)
 values(pair,school,'QA shared enrollment',section_t,section_l);
 insert into public.attendance_students(id,school_id,display_name,external_student_id)
 values(student,school,'Synthetic One','SHOP-QA-1'),(student2,school,'Synthetic Two','SHOP-QA-2');
 insert into public.attendance_pair_enrollments(school_id,pair_id,student_id)
 values(school,pair,student),(school,pair,student2);
 execute 'set local role authenticated';
 board:=public.open_tower(book);
 result:=public.open_lab_coaching(book);
 if jsonb_array_length(result)<>2 then raise exception 'FAIL lab roster'; end if;
 save_id:=gen_random_uuid();
 result:=public.save_lab_coaching(book,student,0,save_id,'smaw-fillet-1F',array['Travel speed'],'Steady arc');
 if result->>'revision'<>'1' or result->'focus'<>'["Travel speed"]'::jsonb then raise exception 'FAIL coaching save'; end if;
 if (select data from public.tower_records where gradebook_id=book and student_id=student)<>'{}'::jsonb
  or (select revision from public.tower_records where gradebook_id=book and student_id=student)<>0
  or exists(select 1 from public.gradebook_attempts where gradebook_id=book) then raise exception 'FAIL coaching changed grades'; end if;
 result:=public.save_lab_coaching(book,student,0,save_id,'smaw-fillet-1F',array['Travel speed'],'Steady arc');
 if result->>'revision'<>'1' then raise exception 'FAIL duplicate save'; end if;
 denied:=false;begin perform public.save_lab_coaching(book,student,0,gen_random_uuid(),'smaw-fillet-1F',array['Arc length'],'');
 exception when serialization_failure then denied:=true;end;
 if not denied then raise exception 'FAIL stale coaching accepted';end if;
 denied:=false;begin perform public.save_lab_coaching(book,student,1,save_id,'smaw-fillet-1F',array['Arc length'],'');
 exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'FAIL changed retry accepted';end if;
 token:=public.issue_lab_student_link(book,student);token2:=public.issue_lab_student_link(book,student2);
 execute 'set local role anon';
 result:=public.read_lab_student(token);
 if result->>'student_id'<>student::text or result->>'note'<>'Steady arc' or result?'history' or result?'saved_by' then raise exception 'FAIL student snapshot';end if;
 if public.read_lab_student(token2)->>'student_id'<>student2::text then raise exception 'FAIL student isolation';end if;
 result:=public.request_lab_check(token,1);stamp:=result->>'requested_at';
 if stamp is null then raise exception 'FAIL check request';end if;
 result:=public.request_lab_check(token,1);
 if result->>'requested_at'<>stamp then raise exception 'FAIL request duplicate';end if;
 denied:=false;begin perform public.request_lab_check(token,0);exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'FAIL stale request accepted';end if;
 if has_function_privilege(current_user,'public.save_lab_coaching(uuid,uuid,integer,uuid,text,text[],text)','execute')
  or has_table_privilege(current_user,'public.tower_records','select')
  or has_table_privilege(current_user,'private.lab_student_links','select') then raise exception 'FAIL anonymous grant';end if;
 execute 'set local role authenticated';
 result:=public.mark_lab_check_handled(book,student,stamp::timestamptz);
 if result->>'requested_at' is not null then raise exception 'FAIL clear request';end if;
 result:=public.save_tower_student(book,student,0,'{"lab":{},"exams":{},"competencies":{},"positionQualifications":{},"destructiveTests":[]}'::jsonb);
 if (select lab_coaching->>'revision' from public.tower_records where gradebook_id=book and student_id=student)<>'1' then raise exception 'FAIL grading erased coaching';end if;
 before_state:=(select data from public.tower_records where gradebook_id=book and student_id=student);
 result:=public.save_lab_coaching(book,student,1,gen_random_uuid(),'smaw-fillet-1F',array['Arc length'],'Next practice');
 if result->>'revision'<>'2' or (select data from public.tower_records where gradebook_id=book and student_id=student)<>before_state
  or (select jsonb_array_length(lab_coaching->'history') from public.tower_records where gradebook_id=book and student_id=student)<>2 then raise exception 'FAIL coaching history or grade preservation';end if;
 token2:=public.issue_lab_student_link(book,student);
 execute 'set local role anon';
 denied:=false;begin perform public.read_lab_student(token);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL old link not revoked';end if;
 token:=token2;
 execute 'reset role';
 update private.lab_student_links set expires_at=now()-interval '1 day' where gradebook_id=book and student_id=student;
 execute 'set local role anon';
 denied:=false;begin perform public.read_lab_student(token);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL expired link';end if;
 execute 'reset role';
 update private.lab_student_links set expires_at=now()+interval '1 day' where gradebook_id=book and student_id=student;
 update public.attendance_pair_enrollments set active=false where pair_id=pair and student_id=student;
 execute 'set local role anon';
 denied:=false;begin perform public.read_lab_student(token);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL withdrawn student';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',stranger::text,true);
 execute 'set local role authenticated';
 denied:=false;begin perform public.issue_lab_student_link(book,student2);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL cross-school link';end if;
 denied:=false;begin perform public.open_lab_coaching(book);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL cross-school roster';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',actor::text,true);
 execute 'set local role authenticated';
 denied:=false;begin perform public.issue_lab_student_link((select id from public.gradebooks where section_id=section_t),student2);exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'FAIL theory accepted as lab';end if;
 execute 'reset role';
end $$;
rollback;
