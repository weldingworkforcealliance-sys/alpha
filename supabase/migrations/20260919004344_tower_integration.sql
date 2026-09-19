-- Welding Record Tower: authorized course workspaces and append-only evidence.
create table public.tower_assignments (
 id text primary key, definition jsonb not null check(jsonb_typeof(definition)='object')
);
create table public.tower_student_ids (
 student_id uuid primary key references public.attendance_students(id) on delete restrict,
 weld_test_id integer generated always as identity (start with 0 minvalue 0 maxvalue 9999 no cycle) unique,
 issued_at timestamptz not null default now()
);
create table public.tower_records (
 gradebook_id uuid not null references public.gradebooks(id) on delete restrict,
 student_id uuid not null references public.attendance_students(id) on delete restrict,
 revision bigint not null default 0, data jsonb not null default '{}',
 updated_at timestamptz not null default now(), updated_by uuid,
 primary key(gradebook_id,student_id)
);
create table public.tower_history (
 id bigint generated always as identity primary key,
 gradebook_id uuid not null, student_id uuid not null,
 revision bigint not null, data jsonb not null, recorded_at timestamptz not null default now(), recorded_by uuid,
 foreign key(gradebook_id,student_id) references public.tower_records(gradebook_id,student_id),
 unique(gradebook_id,student_id,revision)
);
create table public.tower_grade_links (
 gradebook_id uuid not null references public.gradebooks(id), student_id uuid not null references public.attendance_students(id),
 assignment_id text not null references public.tower_assignments(id), attempt_number integer not null check(attempt_number in(1,2)),
 attempt_id uuid not null references public.gradebook_attempts(id), evidence jsonb not null,
 primary key(gradebook_id,student_id,assignment_id,attempt_number)
);
create table public.tower_permanent_tests (
 id uuid primary key, record_number bigint generated always as identity unique,
 gradebook_id uuid not null references public.gradebooks(id), student_id uuid not null references public.attendance_students(id),
 evidence jsonb not null, recorded_at timestamptz not null default now(), recorded_by uuid not null
);
create table public.tower_certificates (
 id uuid primary key default gen_random_uuid(),
 test_id uuid not null unique references public.tower_permanent_tests(id),
 gradebook_id uuid not null references public.gradebooks(id), student_id uuid not null references public.attendance_students(id),
 snapshot jsonb not null, issued_at timestamptz not null default now(), issued_by uuid not null
);
create index tower_records_student_idx on public.tower_records(student_id);
create index tower_history_student_idx on public.tower_history(gradebook_id,student_id,id desc);
create index tower_grade_links_attempt_idx on public.tower_grade_links(attempt_id);
create index tower_grade_links_assignment_idx on public.tower_grade_links(assignment_id);
create index tower_tests_student_idx on public.tower_permanent_tests(gradebook_id,student_id);
create index tower_certificates_student_idx on public.tower_certificates(gradebook_id,student_id);
alter table public.tower_assignments enable row level security;
alter table public.tower_student_ids enable row level security;
revoke all on public.tower_assignments, public.tower_student_ids from public, anon, authenticated;
grant select on public.tower_assignments, public.tower_student_ids to authenticated;
create policy tower_catalog_read on public.tower_assignments for select to authenticated using(auth.uid() is not null);
create policy tower_id_read on public.tower_student_ids for select to authenticated using(
 exists(select 1 from public.gradebook_students gs where gs.student_id=tower_student_ids.student_id and public.can_access_gradebook(gs.gradebook_id)));
do $$ declare t text; begin
 foreach t in array array['tower_records','tower_history','tower_grade_links','tower_permanent_tests','tower_certificates'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy tower_course_read on public.%I for select to authenticated using(public.can_access_gradebook(gradebook_id))',t);
 end loop;
 foreach t in array array['tower_history','tower_permanent_tests','tower_certificates','tower_student_ids'] loop
  execute format('create trigger tower_preserve before update or delete on public.%I for each row execute function public.reject_gradebook_history_mutation()',t);
 end loop;
end $$;

-- Current enrollment and an assigned lab course are checked for every write.
create function public.tower_assert_access(p_book uuid,p_student uuid default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.can_access_gradebook(p_book) then
  raise exception 'Tower access denied' using errcode='42501';
 end if;
 if not exists(select 1 from public.gradebook_directory where id=p_book and course_role='lab' and section_status='active') then
  raise exception 'Choose an active lab course with a configured course pair';
 end if;
 if p_student is not null and not exists(select 1 from public.gradebook_enrollment_source
  where gradebook_id=p_book and student_id=p_student and active) then
  raise exception 'Student is no longer actively enrolled. Refresh the roster.' using errcode='42501';
 end if;
end $$;
revoke all on function public.tower_assert_access(uuid,uuid) from public,anon,authenticated;

create function public.open_tower(p_gradebook_id uuid)
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
  'assignments',coalesce((select jsonb_agg(definition order by id) from public.tower_assignments),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.open_tower(uuid) from public,anon;
grant execute on function public.open_tower(uuid) to authenticated;

-- A complete rubric is calculated here, never trusted from a browser total.
create function public.tower_attempt_score(p_attempt jsonb,p_number integer)
returns numeric language plpgsql immutable set search_path='' as $$
declare key text; value numeric; total numeric:=0; critical boolean;
begin
 if p_attempt is null or p_attempt='null'::jsonb then return null; end if;
 if jsonb_typeof(p_attempt->'scores') is distinct from 'object' or jsonb_typeof(p_attempt->'defects') is distinct from 'array' then
  raise exception 'Invalid rubric';
 end if;
 critical := (p_attempt->'defects') ?| array['crack','lackFusion'];
 foreach key in array array['consistency','defects','procedure','restarts','beadSize'] loop
  if not (p_attempt->'scores' ? key) then return null; end if;
  if jsonb_typeof(p_attempt->'scores'->key) is distinct from 'number' then raise exception 'Invalid rubric score'; end if;
  value:=(p_attempt->'scores'->>key)::numeric;
  if value not in(10,14,16,18,20) and not(key='defects' and p_number=2 and critical and value=0) then
    raise exception 'Invalid rubric score';
  end if;
  if key='defects' and p_number=2 and critical then value:=0; end if;
  total:=total+value;
 end loop;
 if p_number=1 and critical then return 0; end if;
 return round(total*0.95,1);
end $$;
revoke all on function public.tower_attempt_score(jsonb,integer) from public,anon,authenticated;

create function public.save_tower_student(p_gradebook_id uuid,p_student_id uuid,p_revision bigint,p_data jsonb)
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
  if position.value->>'status' not in('Not Started','Pass','Fail') then raise exception 'Qualification must be Pass or Fail'; end if;
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
 left join public.tower_assignments a on a.id=e.key loop
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
  if not exists(select 1 from public.gradebook_roster r join public.gradebook_directory g on g.id=r.gradebook_id
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
revoke all on function public.save_tower_student(uuid,uuid,bigint,jsonb) from public,anon;
grant execute on function public.save_tower_student(uuid,uuid,bigint,jsonb) to authenticated;

-- One counted result per assignment. Completion of Attempt 2 replaces Attempt 1,
-- including when its score is lower; chronology of later corrections is irrelevant.
create view public.tower_effective_grades with(security_invoker=true) as
 select l.gradebook_id,l.student_id,l.assignment_id,l.attempt_number,l.attempt_id,
 a.item_id,a.score,a.possible_score,a.status_label
 from public.tower_grade_links l join public.gradebook_latest_attempts a on a.id=l.attempt_id
 where not exists(select 1 from public.tower_grade_links later
  where later.gradebook_id=l.gradebook_id and later.student_id=l.student_id
   and later.assignment_id=l.assignment_id and later.attempt_number>l.attempt_number);
revoke all on public.tower_effective_grades from public,anon,authenticated;
grant select on public.tower_effective_grades to authenticated;

insert into public.tower_assignments(id,definition) select value->>'id',value-'courseId' from jsonb_array_elements($catalog$[{"id":"smaw-fillet-1F","processId":"smaw","process":"SMAW","material":"Carbon Steel","family":"Fillet","backing":"N/A","position":"1F","name":"SMAW Carbon Steel 1F Fillet Weld","electrode":"1/8\" electrode","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"smaw-fillet-2F","processId":"smaw","process":"SMAW","material":"Carbon Steel","family":"Fillet","backing":"N/A","position":"2F","name":"SMAW Carbon Steel 2F Fillet Weld","electrode":"1/8\" electrode","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"smaw-fillet-3F","processId":"smaw","process":"SMAW","material":"Carbon Steel","family":"Fillet","backing":"N/A","position":"3F","name":"SMAW Carbon Steel 3F Fillet Weld","electrode":"1/8\" electrode","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"smaw-fillet-4F","processId":"smaw","process":"SMAW","material":"Carbon Steel","family":"Fillet","backing":"N/A","position":"4F","name":"SMAW Carbon Steel 4F Fillet Weld","electrode":"1/8\" electrode","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"smaw-groove-backing-1G","processId":"smaw","process":"SMAW","material":"Carbon Steel","family":"Groove","backing":"Backing","position":"1G","name":"SMAW Carbon Steel 1G Groove — Backing","electrode":"1/8\" electrode","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"smaw-groove-backing-2G","processId":"smaw","process":"SMAW","material":"Carbon Steel","family":"Groove","backing":"Backing","position":"2G","name":"SMAW Carbon Steel 2G Groove — Backing","electrode":"1/8\" electrode","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"smaw-groove-backing-3G","processId":"smaw","process":"SMAW","material":"Carbon Steel","family":"Groove","backing":"Backing","position":"3G","name":"SMAW Carbon Steel 3G Groove — Backing","electrode":"1/8\" electrode","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"smaw-groove-backing-4G","processId":"smaw","process":"SMAW","material":"Carbon Steel","family":"Groove","backing":"Backing","position":"4G","name":"SMAW Carbon Steel 4G Groove — Backing","electrode":"1/8\" electrode","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"smaw-groove-no-backing-1G","processId":"smaw","process":"SMAW","material":"Carbon Steel","family":"Groove","backing":"No Backing","position":"1G","name":"SMAW Carbon Steel 1G Groove — No Backing","electrode":"1/8\" electrode","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"smaw-groove-no-backing-2G","processId":"smaw","process":"SMAW","material":"Carbon Steel","family":"Groove","backing":"No Backing","position":"2G","name":"SMAW Carbon Steel 2G Groove — No Backing","electrode":"1/8\" electrode","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"smaw-groove-no-backing-3G","processId":"smaw","process":"SMAW","material":"Carbon Steel","family":"Groove","backing":"No Backing","position":"3G","name":"SMAW Carbon Steel 3G Groove — No Backing","electrode":"1/8\" electrode","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"smaw-groove-no-backing-4G","processId":"smaw","process":"SMAW","material":"Carbon Steel","family":"Groove","backing":"No Backing","position":"4G","name":"SMAW Carbon Steel 4G Groove — No Backing","electrode":"1/8\" electrode","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gmaw-s-fillet-1F","processId":"gmaw-s","process":"GMAW-S","material":"Carbon Steel","family":"Fillet","backing":"N/A","position":"1F","name":"GMAW-S Carbon Steel 1F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gmaw-s-fillet-2F","processId":"gmaw-s","process":"GMAW-S","material":"Carbon Steel","family":"Fillet","backing":"N/A","position":"2F","name":"GMAW-S Carbon Steel 2F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gmaw-s-fillet-3F","processId":"gmaw-s","process":"GMAW-S","material":"Carbon Steel","family":"Fillet","backing":"N/A","position":"3F","name":"GMAW-S Carbon Steel 3F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gmaw-s-fillet-4F","processId":"gmaw-s","process":"GMAW-S","material":"Carbon Steel","family":"Fillet","backing":"N/A","position":"4F","name":"GMAW-S Carbon Steel 4F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gmaw-s-groove-backing-1G","processId":"gmaw-s","process":"GMAW-S","material":"Carbon Steel","family":"Groove","backing":"Backing","position":"1G","name":"GMAW-S Carbon Steel 1G Groove — Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gmaw-s-groove-backing-2G","processId":"gmaw-s","process":"GMAW-S","material":"Carbon Steel","family":"Groove","backing":"Backing","position":"2G","name":"GMAW-S Carbon Steel 2G Groove — Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gmaw-s-groove-backing-3G","processId":"gmaw-s","process":"GMAW-S","material":"Carbon Steel","family":"Groove","backing":"Backing","position":"3G","name":"GMAW-S Carbon Steel 3G Groove — Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gmaw-s-groove-backing-4G","processId":"gmaw-s","process":"GMAW-S","material":"Carbon Steel","family":"Groove","backing":"Backing","position":"4G","name":"GMAW-S Carbon Steel 4G Groove — Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gmaw-s-groove-no-backing-1G","processId":"gmaw-s","process":"GMAW-S","material":"Carbon Steel","family":"Groove","backing":"No Backing","position":"1G","name":"GMAW-S Carbon Steel 1G Groove — No Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gmaw-s-groove-no-backing-2G","processId":"gmaw-s","process":"GMAW-S","material":"Carbon Steel","family":"Groove","backing":"No Backing","position":"2G","name":"GMAW-S Carbon Steel 2G Groove — No Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gmaw-s-groove-no-backing-3G","processId":"gmaw-s","process":"GMAW-S","material":"Carbon Steel","family":"Groove","backing":"No Backing","position":"3G","name":"GMAW-S Carbon Steel 3G Groove — No Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gmaw-s-groove-no-backing-4G","processId":"gmaw-s","process":"GMAW-S","material":"Carbon Steel","family":"Groove","backing":"No Backing","position":"4G","name":"GMAW-S Carbon Steel 4G Groove — No Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gmaw-spray-fillet-1F","processId":"gmaw-spray","process":"GMAW Spray","material":"Carbon Steel","family":"Fillet","backing":"N/A","position":"1F","name":"GMAW Spray Carbon Steel 1F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gmaw-spray-fillet-2F","processId":"gmaw-spray","process":"GMAW Spray","material":"Carbon Steel","family":"Fillet","backing":"N/A","position":"2F","name":"GMAW Spray Carbon Steel 2F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gmaw-spray-groove-backing-1G","processId":"gmaw-spray","process":"GMAW Spray","material":"Carbon Steel","family":"Groove","backing":"Backing","position":"1G","name":"GMAW Spray Carbon Steel 1G Groove — Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gmaw-spray-groove-no-backing-1G","processId":"gmaw-spray","process":"GMAW Spray","material":"Carbon Steel","family":"Groove","backing":"No Backing","position":"1G","name":"GMAW Spray Carbon Steel 1G Groove — No Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-g-fillet-1F","processId":"fcaw-g","process":"FCAW-G","material":"Carbon Steel","family":"Fillet","backing":"N/A","position":"1F","name":"FCAW-G Carbon Steel 1F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-g-fillet-2F","processId":"fcaw-g","process":"FCAW-G","material":"Carbon Steel","family":"Fillet","backing":"N/A","position":"2F","name":"FCAW-G Carbon Steel 2F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-g-fillet-3F","processId":"fcaw-g","process":"FCAW-G","material":"Carbon Steel","family":"Fillet","backing":"N/A","position":"3F","name":"FCAW-G Carbon Steel 3F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-g-fillet-4F","processId":"fcaw-g","process":"FCAW-G","material":"Carbon Steel","family":"Fillet","backing":"N/A","position":"4F","name":"FCAW-G Carbon Steel 4F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-g-groove-backing-1G","processId":"fcaw-g","process":"FCAW-G","material":"Carbon Steel","family":"Groove","backing":"Backing","position":"1G","name":"FCAW-G Carbon Steel 1G Groove — Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-g-groove-backing-2G","processId":"fcaw-g","process":"FCAW-G","material":"Carbon Steel","family":"Groove","backing":"Backing","position":"2G","name":"FCAW-G Carbon Steel 2G Groove — Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-g-groove-backing-3G","processId":"fcaw-g","process":"FCAW-G","material":"Carbon Steel","family":"Groove","backing":"Backing","position":"3G","name":"FCAW-G Carbon Steel 3G Groove — Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-g-groove-backing-4G","processId":"fcaw-g","process":"FCAW-G","material":"Carbon Steel","family":"Groove","backing":"Backing","position":"4G","name":"FCAW-G Carbon Steel 4G Groove — Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-g-groove-no-backing-1G","processId":"fcaw-g","process":"FCAW-G","material":"Carbon Steel","family":"Groove","backing":"No Backing","position":"1G","name":"FCAW-G Carbon Steel 1G Groove — No Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-g-groove-no-backing-2G","processId":"fcaw-g","process":"FCAW-G","material":"Carbon Steel","family":"Groove","backing":"No Backing","position":"2G","name":"FCAW-G Carbon Steel 2G Groove — No Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-g-groove-no-backing-3G","processId":"fcaw-g","process":"FCAW-G","material":"Carbon Steel","family":"Groove","backing":"No Backing","position":"3G","name":"FCAW-G Carbon Steel 3G Groove — No Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-g-groove-no-backing-4G","processId":"fcaw-g","process":"FCAW-G","material":"Carbon Steel","family":"Groove","backing":"No Backing","position":"4G","name":"FCAW-G Carbon Steel 4G Groove — No Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-s-fillet-1F","processId":"fcaw-s","process":"FCAW-S","material":"Carbon Steel","family":"Fillet","backing":"N/A","position":"1F","name":"FCAW-S Carbon Steel 1F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-s-fillet-2F","processId":"fcaw-s","process":"FCAW-S","material":"Carbon Steel","family":"Fillet","backing":"N/A","position":"2F","name":"FCAW-S Carbon Steel 2F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-s-fillet-3F","processId":"fcaw-s","process":"FCAW-S","material":"Carbon Steel","family":"Fillet","backing":"N/A","position":"3F","name":"FCAW-S Carbon Steel 3F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-s-fillet-4F","processId":"fcaw-s","process":"FCAW-S","material":"Carbon Steel","family":"Fillet","backing":"N/A","position":"4F","name":"FCAW-S Carbon Steel 4F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-s-groove-backing-1G","processId":"fcaw-s","process":"FCAW-S","material":"Carbon Steel","family":"Groove","backing":"Backing","position":"1G","name":"FCAW-S Carbon Steel 1G Groove — Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-s-groove-backing-2G","processId":"fcaw-s","process":"FCAW-S","material":"Carbon Steel","family":"Groove","backing":"Backing","position":"2G","name":"FCAW-S Carbon Steel 2G Groove — Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-s-groove-backing-3G","processId":"fcaw-s","process":"FCAW-S","material":"Carbon Steel","family":"Groove","backing":"Backing","position":"3G","name":"FCAW-S Carbon Steel 3G Groove — Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-s-groove-backing-4G","processId":"fcaw-s","process":"FCAW-S","material":"Carbon Steel","family":"Groove","backing":"Backing","position":"4G","name":"FCAW-S Carbon Steel 4G Groove — Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-s-groove-no-backing-1G","processId":"fcaw-s","process":"FCAW-S","material":"Carbon Steel","family":"Groove","backing":"No Backing","position":"1G","name":"FCAW-S Carbon Steel 1G Groove — No Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-s-groove-no-backing-2G","processId":"fcaw-s","process":"FCAW-S","material":"Carbon Steel","family":"Groove","backing":"No Backing","position":"2G","name":"FCAW-S Carbon Steel 2G Groove — No Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-s-groove-no-backing-3G","processId":"fcaw-s","process":"FCAW-S","material":"Carbon Steel","family":"Groove","backing":"No Backing","position":"3G","name":"FCAW-S Carbon Steel 3G Groove — No Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"fcaw-s-groove-no-backing-4G","processId":"fcaw-s","process":"FCAW-S","material":"Carbon Steel","family":"Groove","backing":"No Backing","position":"4G","name":"FCAW-S Carbon Steel 4G Groove — No Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-carbon-fillet-1F","processId":"gtaw-carbon","process":"GTAW","material":"Carbon Steel","family":"Fillet","backing":"N/A","position":"1F","name":"GTAW Carbon Steel 1F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-carbon-fillet-2F","processId":"gtaw-carbon","process":"GTAW","material":"Carbon Steel","family":"Fillet","backing":"N/A","position":"2F","name":"GTAW Carbon Steel 2F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-carbon-fillet-3F","processId":"gtaw-carbon","process":"GTAW","material":"Carbon Steel","family":"Fillet","backing":"N/A","position":"3F","name":"GTAW Carbon Steel 3F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-carbon-fillet-4F","processId":"gtaw-carbon","process":"GTAW","material":"Carbon Steel","family":"Fillet","backing":"N/A","position":"4F","name":"GTAW Carbon Steel 4F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-carbon-groove-backing-1G","processId":"gtaw-carbon","process":"GTAW","material":"Carbon Steel","family":"Groove","backing":"Backing","position":"1G","name":"GTAW Carbon Steel 1G Groove — Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-carbon-groove-backing-2G","processId":"gtaw-carbon","process":"GTAW","material":"Carbon Steel","family":"Groove","backing":"Backing","position":"2G","name":"GTAW Carbon Steel 2G Groove — Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-carbon-groove-backing-3G","processId":"gtaw-carbon","process":"GTAW","material":"Carbon Steel","family":"Groove","backing":"Backing","position":"3G","name":"GTAW Carbon Steel 3G Groove — Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-carbon-groove-backing-4G","processId":"gtaw-carbon","process":"GTAW","material":"Carbon Steel","family":"Groove","backing":"Backing","position":"4G","name":"GTAW Carbon Steel 4G Groove — Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-carbon-groove-no-backing-1G","processId":"gtaw-carbon","process":"GTAW","material":"Carbon Steel","family":"Groove","backing":"No Backing","position":"1G","name":"GTAW Carbon Steel 1G Groove — No Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-carbon-groove-no-backing-2G","processId":"gtaw-carbon","process":"GTAW","material":"Carbon Steel","family":"Groove","backing":"No Backing","position":"2G","name":"GTAW Carbon Steel 2G Groove — No Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-carbon-groove-no-backing-3G","processId":"gtaw-carbon","process":"GTAW","material":"Carbon Steel","family":"Groove","backing":"No Backing","position":"3G","name":"GTAW Carbon Steel 3G Groove — No Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-carbon-groove-no-backing-4G","processId":"gtaw-carbon","process":"GTAW","material":"Carbon Steel","family":"Groove","backing":"No Backing","position":"4G","name":"GTAW Carbon Steel 4G Groove — No Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-stainless-fillet-1F","processId":"gtaw-stainless","process":"GTAW","material":"Stainless Steel","family":"Fillet","backing":"N/A","position":"1F","name":"GTAW Stainless Steel 1F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-stainless-fillet-2F","processId":"gtaw-stainless","process":"GTAW","material":"Stainless Steel","family":"Fillet","backing":"N/A","position":"2F","name":"GTAW Stainless Steel 2F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-stainless-fillet-3F","processId":"gtaw-stainless","process":"GTAW","material":"Stainless Steel","family":"Fillet","backing":"N/A","position":"3F","name":"GTAW Stainless Steel 3F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-stainless-groove-backing-1G","processId":"gtaw-stainless","process":"GTAW","material":"Stainless Steel","family":"Groove","backing":"Backing","position":"1G","name":"GTAW Stainless Steel 1G Groove — Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-stainless-groove-backing-2G","processId":"gtaw-stainless","process":"GTAW","material":"Stainless Steel","family":"Groove","backing":"Backing","position":"2G","name":"GTAW Stainless Steel 2G Groove — Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-stainless-groove-backing-3G","processId":"gtaw-stainless","process":"GTAW","material":"Stainless Steel","family":"Groove","backing":"Backing","position":"3G","name":"GTAW Stainless Steel 3G Groove — Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-stainless-groove-backing-4G","processId":"gtaw-stainless","process":"GTAW","material":"Stainless Steel","family":"Groove","backing":"Backing","position":"4G","name":"GTAW Stainless Steel 4G Groove — Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-stainless-groove-no-backing-1G","processId":"gtaw-stainless","process":"GTAW","material":"Stainless Steel","family":"Groove","backing":"No Backing","position":"1G","name":"GTAW Stainless Steel 1G Groove — No Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-stainless-groove-no-backing-2G","processId":"gtaw-stainless","process":"GTAW","material":"Stainless Steel","family":"Groove","backing":"No Backing","position":"2G","name":"GTAW Stainless Steel 2G Groove — No Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-stainless-groove-no-backing-3G","processId":"gtaw-stainless","process":"GTAW","material":"Stainless Steel","family":"Groove","backing":"No Backing","position":"3G","name":"GTAW Stainless Steel 3G Groove — No Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-stainless-groove-no-backing-4G","processId":"gtaw-stainless","process":"GTAW","material":"Stainless Steel","family":"Groove","backing":"No Backing","position":"4G","name":"GTAW Stainless Steel 4G Groove — No Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-aluminum-fillet-1F","processId":"gtaw-aluminum","process":"GTAW","material":"Aluminum","family":"Fillet","backing":"N/A","position":"1F","name":"GTAW Aluminum 1F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-aluminum-fillet-2F","processId":"gtaw-aluminum","process":"GTAW","material":"Aluminum","family":"Fillet","backing":"N/A","position":"2F","name":"GTAW Aluminum 2F Fillet Weld","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-aluminum-groove-backing-1G","processId":"gtaw-aluminum","process":"GTAW","material":"Aluminum","family":"Groove","backing":"Backing","position":"1G","name":"GTAW Aluminum 1G Groove — Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"},{"id":"gtaw-aluminum-groove-no-backing-1G","processId":"gtaw-aluminum","process":"GTAW","material":"Aluminum","family":"Groove","backing":"No Backing","position":"1G","name":"GTAW Aluminum 1G Groove — No Backing","electrode":"","type":"position","rubricType":"weld","courseId":"wld110"}]$catalog$::jsonb);
