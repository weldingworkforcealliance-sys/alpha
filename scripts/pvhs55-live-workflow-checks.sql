-- Run only on Gltg staging. All synthetic identities, enrollments and attempts roll back.
begin;
do $fixture$
declare u uuid:=gen_random_uuid(); sc uuid; b uuid; paired uuid; c uuid; book uuid;
        st uuid:=gen_random_uuid(); pair uuid:=gen_random_uuid();
begin
 select id into strict sc from public.schools where id='08ccb452-83ab-482f-bb28-5576e02741b2';
 select id into strict b from public.sections where school_id=sc and section_code='PVHS-B-WLD114-2627-55';
 select id into strict paired from public.sections where school_id=sc and section_code='PVHS-B-WLD115-2627-55';
 select id into strict c from public.sections where school_id=sc and section_code='PVHS-C-WLD114-2627-55';
 select id into strict book from public.gradebooks where section_id=b;
 insert into auth.users(id,email) values(u,'pvhs-rollback-'||u::text||'@example.invalid');
 insert into public.school_memberships(school_id,user_id,role,status) values(sc,u,'instructor','active');
 insert into public.section_instructors(school_id,section_id,instructor_id) values(sc,b,u);
 insert into public.attendance_students(id,school_id,display_name) values(st,sc,'Synthetic rollback learner');
 insert into public.attendance_pairs(id,school_id,pair_name,primary_section_id,completion_section_id)
 values(pair,sc,'Synthetic rollback pair',b,paired);
 insert into public.attendance_pair_enrollments(school_id,pair_id,student_id) values(sc,pair,st);
 insert into public.gradebook_students(gradebook_id,student_id) values(book,st);
 perform set_config('qa.school',sc::text,true);
 perform set_config('qa.b',b::text,true);
 perform set_config('qa.c',c::text,true);
 perform set_config('qa.cbook',(select id::text from public.gradebooks where section_id=c),true);
 perform set_config('qa.book',book::text,true);
 perform set_config('qa.student',st::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 if has_function_privilege('anon','public.start_current_planner_day(uuid,date)','EXECUTE') then
   raise exception 'Anonymous callers can start instruction';
 end if;
end;
$fixture$;

set local role authenticated;
do $checks$
declare b uuid:=current_setting('qa.b')::uuid; c uuid:=current_setting('qa.c')::uuid;
 book uuid:=current_setting('qa.book')::uuid; st uuid:=current_setting('qa.student')::uuid;
 item uuid; a1 uuid; a2 uuid; other_book uuid; denied boolean:=false; n integer; rev bigint;
begin
 -- Assigned instructor can inspect the shared master through normal RLS.
 select count(*) into n from public.planner_days where section_id=b;
 if n<>55 then raise exception 'Assigned instructor cannot inspect 55 days: %',n; end if;
 if not public.can_access_gradebook(book) then raise exception 'Assigned instructor lacks gradebook access'; end if;
 other_book:=current_setting('qa.cbook')::uuid;
 if public.can_access_gradebook(other_book) then raise exception 'Unassigned C gradebook is accessible'; end if;
 -- Draft and hold must be enforced at the database boundary, not only by UI visibility.
 begin
  perform public.start_current_planner_day(b,current_date);
 exception when check_violation or raise_exception then
  if sqlerrm not like 'This planner day is scheduled for %' and sqlerrm not like 'PVHS instruction requires%' then raise; end if;
  denied:=true;
 end;
 if not denied then raise exception 'Draft/undated start was allowed'; end if;
 if exists(select 1 from public.planner_day_delivery where section_id=b) then raise exception 'Blocked start retained delivery'; end if;
 if exists(select 1 from public.section_progress where section_id=b and started_at is not null) then raise exception 'Blocked start retained timer'; end if;
 if (select count(*) from public.planner_days where section_id in(b,c) and scheduled_date is not null)<>110 then raise exception 'Calendar dates changed'; end if;
 select i.id into strict item from public.gradebook_items i join public.gradebook_categories cat on cat.id=i.category_id
 where i.gradebook_id=book and cat.code='machine_practical' limit 1;
 denied:=false;
 begin
  perform public.record_gradebook_attempt(book,item,st,'pending',100,100,'Synthetic check');
 exception when check_violation then
  if sqlerrm<>'PVHS pending assessments must remain unscored' then raise; end if;
  denied:=true;
 end;
 if not denied then raise exception 'Pending score allowed'; end if;
 a1:=public.record_gradebook_attempt(book,item,st,'pending',null,null,'Synthetic pending machine observation');
 if exists(select 1 from public.gradebook_latest_attempts where id=a1 and score is not null) then raise exception 'Pending auto-scored'; end if;
 a2:=public.record_gradebook_attempt(book,item,st,'scored',70,100,'Synthetic observed attempt; not safety authorization');
 if a1=a2 then raise exception 'Retest overwrote previous attempt'; end if;
 select max(id) into rev from public.gradebook_revisions where attempt_id=a2;
 perform public.correct_gradebook_attempt(book,item,st,'scored',75,100,'Synthetic correction reason',a2,rev);
 denied:=false;
 begin
  perform public.correct_gradebook_attempt(book,item,st,'scored',80,100,'Stale synthetic correction',a2,rev);
 exception when serialization_failure then denied:=true;
 end;
 if not denied then raise exception 'Stale correction was accepted'; end if;
 select count(*) into n from public.gradebook_attempts where gradebook_id=book and student_id=st;
 if n<>2 then raise exception 'Attempt history lost'; end if;
 select count(*) into n from public.gradebook_revisions where gradebook_id=book and attempt_id=a2;
 if n<>2 then raise exception 'Correction overwrote revision history'; end if;
 if exists(select 1 from public.gradebook_latest_attempts where gradebook_id=other_book and student_id=st) then raise exception 'B grade copied to C'; end if;
 perform set_config('qa.attempt',a2::text,true);
end;
$checks$;
reset role;
do $history$
declare denied boolean:=false;
begin
 begin
  update public.gradebook_attempts set attempted_at=now() where id=current_setting('qa.attempt')::uuid;
 exception when raise_exception then denied:=true;
 end;
 if not denied then raise exception 'Attempt immutability trigger failed'; end if;
end;
$history$;
rollback;
select 'PASS: instructor access, cross-section grade isolation, draft/calendar hold, no retained start, pending score rejection, unscored pending, separate attempts, append-only corrections, immutable attempts; all fixtures rolled back' result;
