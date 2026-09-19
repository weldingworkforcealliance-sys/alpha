-- Isolated staging only. Synthetic fixtures; everything rolls back.
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
 values(lvl,school,program,'L1','Level I',1);
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
 board:=public.open_wld110_shop(book);
 if jsonb_array_length(board->'students')<>2 then raise exception 'FAIL roster'; end if;
 select count(*) into n from public.gradebook_items where gradebook_id=book and assessment_slug like 'wld110-shop:%';
 if n<>8 then raise exception 'FAIL eight required core gradebook items'; end if;
 result:=public.preview_gradebook_final(book,student);
 if (result->>'ready')::boolean then raise exception 'FAIL incomplete core finalized'; end if;
 result:=public.coach_wld110_practice(book,student,0,array['Travel speed']);
 if result->'focus'<>'["Travel speed"]'::jsonb or jsonb_array_length(result->'attempts')<>0 then raise exception 'FAIL ungraded practice'; end if;
 select count(*) into n from public.gradebook_attempts where gradebook_id=book;
 if n<>0 then raise exception 'FAIL practice affected gradebook'; end if;
 token:=public.issue_wld110_student_link(book,student);
 token2:=public.issue_wld110_student_link(book,student2);
 execute 'set local role anon';
 result:=public.read_wld110_student(token);
 if result->>'student_id'<>student::text then raise exception 'FAIL personal link identity'; end if;
 result:=public.request_wld110_check(token,0); stamp:=result->>'requested_at';
 result:=public.request_wld110_check(token,0);
 if stamp is null or result->>'requested_at'<>stamp then raise exception 'FAIL duplicate check queue request'; end if;
 denied:=false; begin perform public.read_wld110_student(repeat('x',72)); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FAIL invalid token'; end if;
 denied:=false; begin perform public.open_wld110_shop(book); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FAIL anonymous board access'; end if;
 execute 'reset role';
 -- Six distinct instructional meetings; orientation does not count. These QA
 -- sessions are draft/taken and must count before final attendance closeout.
 update public.wld110_shop_progress set position_started_on=today-10 where gradebook_id=book and student_id=student;
 for i in 1..6 loop
  insert into public.attendance_sessions(school_id,pair_id,attendance_date,attendance_mode)
   values(school,pair,today-i,'standard');
 end loop;
 insert into public.attendance_sessions(school_id,pair_id,attendance_date,attendance_mode,session_type,counts_toward_attendance)
 values(school,pair,today-7,'standard','orientation',false);
 execute 'set local role authenticated';
 board:=public.open_wld110_shop(book);
 select value into result from jsonb_array_elements(board->'students') where value->>'student_id'=student::text;
 if (result->>'position_meetings')::int<>6 or (result->>'current_competency')::int<>0 then raise exception 'FAIL pacing review / no auto advance: %',result; end if;
 first_ratings:='{"straightness":18,"placement":18,"execution":18,"consistency":16,"weldSize":16}';
 first_id:=gen_random_uuid();
 result:=public.grade_wld110_weld(book,student,first_id,0,(result->>'revision')::int,first_ratings,'{}','Sizer verified');
 if (result->'attempts'->0->>'total')::int<>86 or result->>'requested_at' is not null then raise exception 'FAIL Weld 1 math / queue removal'; end if;
 before_state:=result;
 result:=public.grade_wld110_weld(book,student,first_id,0,1,first_ratings,'{}','Sizer verified');
 if result<>before_state then raise exception 'FAIL retry idempotency'; end if;
 denied:=false;
 begin perform public.grade_wld110_weld(book,student,gen_random_uuid(),0,1,first_ratings); exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'FAIL stale concurrent save'; end if;
 ratings:='{"straightness":18,"placement":16,"execution":16,"consistency":16,"weldSize":16}';
 result:=public.grade_wld110_weld(book,student,gen_random_uuid(),0,(result->>'revision')::int,ratings);
 if (result->>'current_competency')::int<>0 or jsonb_array_length(result->'completions')<>0 then raise exception 'FAIL lower Weld 2 advanced'; end if;
 ratings:='{"straightness":18,"placement":18,"execution":18,"consistency":18,"weldSize":18}';
 save_id:=gen_random_uuid();rev:=(result->>'revision')::int;
 result:=public.grade_wld110_weld(book,student,save_id,0,rev,ratings);
 if (result->>'current_competency')::int<>1 or (result->'completions'->0->>'grade')::numeric<>88
  or jsonb_array_length(result->'attempts')<>3 or (result->>'position_meetings')::int<>6 then raise exception 'FAIL 86/82/90 third attempt and position pacing'; end if;
 if result->'completions'->0->>'first_attempt_id'<>first_id::text or result->'completions'->0->>'second_attempt_id'<>save_id::text then raise exception 'FAIL wrong demonstrations'; end if;
 before_state:=result;
 result:=public.grade_wld110_weld(book,student,save_id,0,rev,ratings);
 if result<>before_state then raise exception 'FAIL retry after advancement'; end if;
 select a.score into score from public.gradebook_latest_attempts a where gradebook_id=book and student_id=student;
 if score<>88 then raise exception 'FAIL competency gradebook average'; end if;
 -- Every remaining step needs two new demonstrations; 2G remains enrichment.
 for i in 1..8 loop
  result:=public.grade_wld110_weld(book,student,gen_random_uuid(),i,(result->>'revision')::int,ratings);
  if (result->>'current_competency')::int<>i then raise exception 'FAIL premature advance %',i; end if;
  result:=public.grade_wld110_weld(book,student,gen_random_uuid(),i,(result->>'revision')::int,ratings);
  if (result->>'current_competency')::int<>i+1 then raise exception 'FAIL progression %',i; end if;
  if i=1 and (result->>'position_meetings')::int<>0 then raise exception 'FAIL new position pacing reset'; end if;
 end loop;
 if jsonb_array_length(result->'attempts')<>19 or jsonb_array_length(result->'completions')<>9 then raise exception 'FAIL full progression history'; end if;
 select count(*) into n from public.gradebook_attempts where gradebook_id=book and student_id=student;
 if n<>8 then raise exception 'FAIL advanced 2G affected required course grade'; end if;
 -- One Needs Work blocks completion even when total exceeds the baseline.
 result:=public.grade_wld110_weld(book,student2,gen_random_uuid(),0,0,first_ratings);
 ratings:='{"straightness":20,"placement":20,"execution":20,"consistency":20,"weldSize":12}';
 result:=public.grade_wld110_weld(book,student2,gen_random_uuid(),0,(result->>'revision')::int,ratings,'{"weldSize":["Too wide"]}');
 if (result->>'current_competency')::int<>0 or (result->'attempts'->1->>'total')::int<>92 or result->'focus'<>'["Too wide"]'::jsonb then raise exception 'FAIL Needs Work / focus'; end if;
 ratings:='{"straightness":18,"placement":18,"execution":18,"consistency":18,"weldSize":18}';
 result:=public.grade_wld110_weld(book,student2,gen_random_uuid(),0,(result->>'revision')::int,ratings);
 if (result->>'current_competency')::int<>1 or (result->'completions'->0->>'grade')::numeric<>88 then raise exception 'FAIL later qualification must compare Weld 1, not failed Weld 2'; end if;
 -- Validate client payloads instead of trusting totals or category names.
 denied:=false; begin perform public.grade_wld110_weld(book,student2,gen_random_uuid(),1,(result->>'revision')::int,ratings||'{"weldSize":19}'::jsonb); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'FAIL arbitrary numeric rating'; end if;
 denied:=false; begin perform public.grade_wld110_weld(book,student2,gen_random_uuid(),1,(result->>'revision')::int,ratings,'{"execution":["Travel speed"]}'); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'FAIL tags on Good'; end if;
 denied:=false; begin perform public.grade_wld110_weld(book,student2,gen_random_uuid(),2,(result->>'revision')::int,ratings); exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'FAIL skipped competency'; end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',stranger::text,true);
 execute 'set local role authenticated';
 select count(*) into n from public.wld110_shop_attempts where gradebook_id=book;
 if n<>0 then raise exception 'FAIL cross-school read'; end if;
 denied:=false;begin perform public.open_wld110_shop(book);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL cross-school board';end if;
 execute 'reset role';perform set_config('request.jwt.claim.sub',teacher::text,true);execute 'set local role authenticated';
 denied:=false;begin perform public.open_wld110_shop(book);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL unassigned instructor';end if;
 execute 'reset role';perform set_config('request.jwt.claim.sub',actor::text,true);execute 'set local role authenticated';
 denied:=false;begin delete from public.wld110_shop_attempts where gradebook_id=book;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL direct mutation';end if;
 execute 'reset role';
 update public.attendance_pair_enrollments set active=false where pair_id=pair and student_id=student2;
 execute 'set local role anon';
 denied:=false;begin perform public.read_wld110_student(token2);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL withdrawn student link';end if;
 execute 'reset role';execute 'set local role authenticated';
 denied:=false;begin perform public.grade_wld110_weld(book,student2,gen_random_uuid(),1,(result->>'revision')::int,ratings);exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'FAIL withdrawn grade';end if;
 execute 'reset role';
 -- All evidence remains after withdrawal and reads from a new board load.
 board:=public.open_wld110_shop(book);
 select value into result from jsonb_array_elements(board->'students') where value->>'student_id'=student2::text;
 if (result->>'active')::boolean or jsonb_array_length(result->'attempts')<>3 then raise exception 'FAIL persisted inactive history'; end if;
 raise notice 'PASS: full nine-step progression, math, retries, third attempts, queue, pacing, persistence, gradebook and authorization';
end $$;
rollback;
