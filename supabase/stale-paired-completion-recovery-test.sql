-- Staging-only regression drill for stale paired completion timers.
-- Uses deterministic Gltg staging fixtures and rolls back every row.
-- Verifies:
--   1) prior-date stale completion timer self-repairs at configured 190 minutes,
--   2) same-day reverse overlap remains blocked,
--   3) unfinalized attendance blocks repair without mutation.

begin;

insert into public.sections
  (id,school_id,course_id,section_name,start_date,end_date,status,planned_instructional_days,start_time,end_time,planned_minutes_per_day)
values
  ('91000000-0000-4000-8000-000000000101','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000002','Synthetic Pair A Primary','2026-09-18','2026-09-30','active',2,'17:00','18:00',65),
  ('91000000-0000-4000-8000-000000000102','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000002','Synthetic Pair A Completion 190','2026-09-18','2026-09-30','active',2,'18:15','21:45',190),
  ('91000000-0000-4000-8000-000000000201','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000002','Synthetic Pair B Primary','2026-09-18','2026-09-30','active',2,'17:00','18:00',65),
  ('91000000-0000-4000-8000-000000000202','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000002','Synthetic Pair B Completion 190','2026-09-18','2026-09-30','active',2,'18:15','21:45',190),
  ('91000000-0000-4000-8000-000000000301','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000002','Synthetic Pair C Primary','2026-09-18','2026-09-30','active',2,'17:00','18:00',65),
  ('91000000-0000-4000-8000-000000000302','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000002','Synthetic Pair C Completion 190','2026-09-18','2026-09-30','active',2,'18:15','21:45',190);

insert into public.section_progress (school_id,section_id,current_planner_day_number)
values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','91000000-0000-4000-8000-000000000101',1),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','91000000-0000-4000-8000-000000000102',1),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','91000000-0000-4000-8000-000000000201',1),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','91000000-0000-4000-8000-000000000202',1),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','91000000-0000-4000-8000-000000000301',1),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','91000000-0000-4000-8000-000000000302',1);

insert into public.planner_days (id,school_id,section_id,course_id,planner_day_number,scheduled_date,title)
values
 ('92000000-0000-4000-8000-000000000101','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','91000000-0000-4000-8000-000000000101','aaaaaaaa-0000-4000-8000-000000000002',1,'2026-09-19','Primary A Day 1'),
 ('92000000-0000-4000-8000-000000000102','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','91000000-0000-4000-8000-000000000101','aaaaaaaa-0000-4000-8000-000000000002',2,'2026-09-20','Primary A Day 2'),
 ('92000000-0000-4000-8000-000000000111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','91000000-0000-4000-8000-000000000102','aaaaaaaa-0000-4000-8000-000000000002',1,'2026-09-18','Completion A Day 1'),
 ('92000000-0000-4000-8000-000000000112','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','91000000-0000-4000-8000-000000000102','aaaaaaaa-0000-4000-8000-000000000002',2,'2026-09-19','Completion A Day 2'),
 ('92000000-0000-4000-8000-000000000201','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','91000000-0000-4000-8000-000000000201','aaaaaaaa-0000-4000-8000-000000000002',1,'2026-09-19','Primary B Day 1'),
 ('92000000-0000-4000-8000-000000000202','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','91000000-0000-4000-8000-000000000201','aaaaaaaa-0000-4000-8000-000000000002',2,'2026-09-20','Primary B Day 2'),
 ('92000000-0000-4000-8000-000000000211','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','91000000-0000-4000-8000-000000000202','aaaaaaaa-0000-4000-8000-000000000002',1,'2026-09-19','Completion B Day 1'),
 ('92000000-0000-4000-8000-000000000212','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','91000000-0000-4000-8000-000000000202','aaaaaaaa-0000-4000-8000-000000000002',2,'2026-09-20','Completion B Day 2'),
 ('92000000-0000-4000-8000-000000000301','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','91000000-0000-4000-8000-000000000301','aaaaaaaa-0000-4000-8000-000000000002',1,'2026-09-19','Primary C Day 1'),
 ('92000000-0000-4000-8000-000000000302','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','91000000-0000-4000-8000-000000000301','aaaaaaaa-0000-4000-8000-000000000002',2,'2026-09-20','Primary C Day 2'),
 ('92000000-0000-4000-8000-000000000311','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','91000000-0000-4000-8000-000000000302','aaaaaaaa-0000-4000-8000-000000000002',1,'2026-09-18','Completion C Day 1'),
 ('92000000-0000-4000-8000-000000000312','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','91000000-0000-4000-8000-000000000302','aaaaaaaa-0000-4000-8000-000000000002',2,'2026-09-19','Completion C Day 2');

insert into public.section_instructors (school_id,section_id,instructor_id,instructor_role,active)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, section_id,
       '11111111-1111-4111-8111-222222222222'::uuid, 'instructor', true
from unnest(array[
 '91000000-0000-4000-8000-000000000101'::uuid,
 '91000000-0000-4000-8000-000000000102'::uuid,
 '91000000-0000-4000-8000-000000000201'::uuid,
 '91000000-0000-4000-8000-000000000202'::uuid,
 '91000000-0000-4000-8000-000000000301'::uuid,
 '91000000-0000-4000-8000-000000000302'::uuid
]) as section_id;

insert into public.attendance_pairs
  (id,school_id,pair_name,primary_section_id,completion_section_id,attendance_mode,active)
values
 ('93000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic stale recovery pair','91000000-0000-4000-8000-000000000101','91000000-0000-4000-8000-000000000102','standard',true),
 ('93000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic same-day block pair','91000000-0000-4000-8000-000000000201','91000000-0000-4000-8000-000000000202','standard',true),
 ('93000000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic attendance guard pair','91000000-0000-4000-8000-000000000301','91000000-0000-4000-8000-000000000302','standard',true);

insert into public.attendance_sessions
  (id,school_id,pair_id,attendance_date,attendance_mode,status,taken_at,taken_by,finalized_at,finalized_by)
values
 ('94000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','93000000-0000-4000-8000-000000000001','2026-09-18','standard','finalized','2026-09-18 17:00:00-04','11111111-1111-4111-8111-222222222222','2026-09-18 18:05:00-04','11111111-1111-4111-8111-222222222222'),
 ('94000000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','93000000-0000-4000-8000-000000000003','2026-09-18','standard','draft','2026-09-18 17:00:00-04','11111111-1111-4111-8111-222222222222',null,null);

insert into public.planner_day_delivery
  (school_id,section_id,planner_day_id,delivery_status,actual_date,started_at,instructor_id)
values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','91000000-0000-4000-8000-000000000102','92000000-0000-4000-8000-000000000111','in_progress','2026-09-18','2026-09-18 18:15:00-04','11111111-1111-4111-8111-222222222222'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','91000000-0000-4000-8000-000000000202','92000000-0000-4000-8000-000000000211','in_progress','2026-09-19','2026-09-19 18:15:00-04','11111111-1111-4111-8111-222222222222'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','91000000-0000-4000-8000-000000000302','92000000-0000-4000-8000-000000000311','in_progress','2026-09-18','2026-09-18 18:15:00-04','11111111-1111-4111-8111-222222222222');

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-222222222222',true);
set local role authenticated;
select public.start_current_planner_day('91000000-0000-4000-8000-000000000101','2026-09-19');
reset role;

do $$
declare v_status text; v_minutes integer; v_completed timestamptz; v_day integer; v_primary text; v_audit integer;
begin
  select delivery_status,actual_minutes,completed_at into v_status,v_minutes,v_completed
  from public.planner_day_delivery where planner_day_id='92000000-0000-4000-8000-000000000111';
  if v_status<>'completed' or v_minutes<>190 or v_completed<>timestamptz '2026-09-18 21:25:00-04' then
    raise exception 'stale repair failed: status %, minutes %, completed %',v_status,v_minutes,v_completed;
  end if;
  select current_planner_day_number into v_day from public.section_progress where section_id='91000000-0000-4000-8000-000000000102';
  if v_day<>2 then raise exception 'completion progress did not advance: %',v_day; end if;
  select delivery_status into v_primary from public.planner_day_delivery where planner_day_id='92000000-0000-4000-8000-000000000101';
  if v_primary<>'in_progress' then raise exception 'primary did not start: %',v_primary; end if;
  select count(*) into v_audit from public.audit_log where action='automatic_stale_paired_completion_repair' and entity_id='92000000-0000-4000-8000-000000000111';
  if v_audit<>1 then raise exception 'repair audit count %',v_audit; end if;
end $$;

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-222222222222',true);
set local role authenticated;
do $$
declare blocked boolean:=false;
begin
  begin
    perform public.start_current_planner_day('91000000-0000-4000-8000-000000000201','2026-09-19');
  exception when others then
    if sqlerrm like 'The second course in Synthetic same-day block pair is already in progress%' then blocked:=true;
    else raise;
    end if;
  end;
  if not blocked then raise exception 'same-day reverse overlap was not blocked'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-222222222222',true);
set local role authenticated;
do $$
declare blocked boolean:=false;
begin
  begin
    perform public.start_current_planner_day('91000000-0000-4000-8000-000000000301','2026-09-19');
  exception when others then
    if sqlerrm like '%attendance for that date is not finalized%' then blocked:=true;
    else raise;
    end if;
  end;
  if not blocked then raise exception 'unfinalized attendance did not block stale repair'; end if;
end $$;
reset role;

do $$
declare v_same_status text; v_same_day integer; v_guard_status text; v_guard_minutes integer; v_guard_day integer; v_primary_count integer;
begin
  select delivery_status into v_same_status from public.planner_day_delivery where planner_day_id='92000000-0000-4000-8000-000000000211';
  select current_planner_day_number into v_same_day from public.section_progress where section_id='91000000-0000-4000-8000-000000000202';
  if v_same_status<>'in_progress' or v_same_day<>1 then raise exception 'same-day state mutated'; end if;

  select delivery_status,actual_minutes into v_guard_status,v_guard_minutes from public.planner_day_delivery where planner_day_id='92000000-0000-4000-8000-000000000311';
  select current_planner_day_number into v_guard_day from public.section_progress where section_id='91000000-0000-4000-8000-000000000302';
  select count(*) into v_primary_count from public.planner_day_delivery where planner_day_id='92000000-0000-4000-8000-000000000301';
  if v_guard_status<>'in_progress' or v_guard_minutes is not null or v_guard_day<>1 or v_primary_count<>0 then
    raise exception 'attendance guard state mutated';
  end if;
end $$;

rollback;

select 'PASS: stale prior-date WLD 110 repaired at 190; same-day overlap and unfinalized attendance remained blocked; rollback complete' as result;
