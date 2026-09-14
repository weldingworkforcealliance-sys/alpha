-- PCCC Day Level II review activation.
--
-- Safe review state only:
-- - creates/updates WLD 205 + WLD 210 sections and workspace
-- - assigns Anthony Ruffino for instructor review
-- - creates 23 dated planner days linked to the approved draft guides
-- - adds the split WLD 210 shop blocks around shared WLD 205 theory
-- - holds both sections at Day 1 with started_at = null
--
-- This migration does NOT release the sections for instruction. Final approval
-- must explicitly clear section_progress.manual_hold.

begin;

-- Workspace.
insert into public.planner_workspaces (
  school_id, cohort_id, workspace_name, workspace_code, sort_order, active
)
select s.id, ch.id, 'PCCC Day - Level 2', 'PCCC-DAY-L2', 20, true
from public.schools s
join public.cohorts ch on ch.school_id=s.id and ch.cohort_code='PCCC-DAY-L2-2627'
where s.name='Passaic County Community College'
on conflict (school_id,cohort_id) do update
set workspace_name=excluded.workspace_name,
    workspace_code=excluded.workspace_code,
    sort_order=excluded.sort_order,
    active=true,
    updated_at=now();

-- WLD 205 section, shared 11:30-12:30 theory block.
insert into public.sections (
  school_id,course_id,section_name,start_date,status,cohort_id,term_id,end_date,
  section_code,planned_instructional_days,start_time,end_time,planned_minutes_per_day
)
select s.id,c.id,'PCCC Day Level 2 - WLD 205','2026-09-22','active',ch.id,t.id,'2026-11-02',
       'PCCC-DAY-L2-WLD205-2627',23,'11:30','12:30',60
from public.schools s
join public.courses c on c.school_id=s.id and c.course_code='WLD 205'
join public.cohorts ch on ch.school_id=s.id and ch.cohort_code='PCCC-DAY-L2-2627'
join public.academic_terms t on t.school_id=s.id and t.academic_year='2026-2027'
where s.name='Passaic County Community College'
on conflict (school_id,section_code) where section_code is not null do update
set section_name=excluded.section_name,
    start_date=excluded.start_date,
    end_date=excluded.end_date,
    status='active',
    cohort_id=excluded.cohort_id,
    term_id=excluded.term_id,
    planned_instructional_days=23,
    start_time='11:30',
    end_time='12:30',
    planned_minutes_per_day=60;

-- WLD 210 section, 300 shop minutes split around the shared WLD 205 hour.
insert into public.sections (
  school_id,course_id,section_name,start_date,status,cohort_id,term_id,end_date,
  section_code,planned_instructional_days,start_time,end_time,planned_minutes_per_day
)
select s.id,c.id,'PCCC Day Level 2 - WLD 210','2026-09-22','active',ch.id,t.id,'2026-11-02',
       'PCCC-DAY-L2-WLD210-2627',23,'08:00','14:00',300
from public.schools s
join public.courses c on c.school_id=s.id and c.course_code='WLD 210'
join public.cohorts ch on ch.school_id=s.id and ch.cohort_code='PCCC-DAY-L2-2627'
join public.academic_terms t on t.school_id=s.id and t.academic_year='2026-2027'
where s.name='Passaic County Community College'
on conflict (school_id,section_code) where section_code is not null do update
set section_name=excluded.section_name,
    start_date=excluded.start_date,
    end_date=excluded.end_date,
    status='active',
    cohort_id=excluded.cohort_id,
    term_id=excluded.term_id,
    planned_instructional_days=23,
    start_time='08:00',
    end_time='14:00',
    planned_minutes_per_day=300;

-- Anthony Ruffino reviews both sections, matching the active PVHS Level II pairing.
insert into public.section_instructors (
  school_id,section_id,instructor_id,instructor_role,active
)
select sec.school_id,sec.id,p.id,'instructor',true
from public.sections sec
join public.schools s on s.id=sec.school_id
join public.profiles p on lower(p.email)=lower('aruffino@pccc.edu')
where s.name='Passaic County Community College'
  and sec.section_code in ('PCCC-DAY-L2-WLD205-2627','PCCC-DAY-L2-WLD210-2627')
on conflict (section_id,instructor_id) do update
set active=true,instructor_role='instructor';

-- Replace the review meeting blocks deterministically.
delete from public.section_meeting_blocks b
using public.sections sec, public.schools s
where b.section_id=sec.id
  and sec.school_id=s.id
  and s.name='Passaic County Community College'
  and sec.section_code in ('PCCC-DAY-L2-WLD205-2627','PCCC-DAY-L2-WLD210-2627');

insert into public.section_meeting_blocks (
  school_id,section_id,block_name,block_type,planned_minutes,start_time,end_time,
  flexible_time,notes,sequence_number
)
select sec.school_id,sec.id,'Shared WLD 205 Theory','classroom',60,'11:30','12:30',false,
       'Shared new WLD 205 theory with PVHS Level 2 on synchronized meeting days. PVHS-only Fridays and 2026-10-27 do not advance new theory.',1
from public.sections sec
join public.schools s on s.id=sec.school_id
where s.name='Passaic County Community College'
  and sec.section_code='PCCC-DAY-L2-WLD205-2627';

insert into public.section_meeting_blocks (
  school_id,section_id,block_name,block_type,planned_minutes,start_time,end_time,
  flexible_time,notes,sequence_number
)
select sec.school_id,sec.id,'WLD 210 Morning Shop Block','shop',210,'08:00','11:30',false,
       'Accelerated Day Level 2 WLD 210 shop block before shared WLD 205 theory.',1
from public.sections sec
join public.schools s on s.id=sec.school_id
where s.name='Passaic County Community College'
  and sec.section_code='PCCC-DAY-L2-WLD210-2627';

insert into public.section_meeting_blocks (
  school_id,section_id,block_name,block_type,planned_minutes,start_time,end_time,
  flexible_time,notes,sequence_number
)
select sec.school_id,sec.id,'WLD 210 Afternoon Shop Block','shop',90,'12:30','14:00',false,
       'Accelerated Day Level 2 WLD 210 shop block after shared WLD 205 theory.',2
from public.sections sec
join public.schools s on s.id=sec.school_id
where s.name='Passaic County Community College'
  and sec.section_code='PCCC-DAY-L2-WLD210-2627';

-- Exact 23-day Day Level II calendar.
with dates(day_num,scheduled_date) as (
  values
    (1,'2026-09-22'::date),(2,'2026-09-23'),(3,'2026-09-24'),(4,'2026-09-28'),
    (5,'2026-09-29'),(6,'2026-09-30'),(7,'2026-10-01'),(8,'2026-10-05'),
    (9,'2026-10-06'),(10,'2026-10-07'),(11,'2026-10-08'),(12,'2026-10-13'),
    (13,'2026-10-14'),(14,'2026-10-15'),(15,'2026-10-19'),(16,'2026-10-20'),
    (17,'2026-10-21'),(18,'2026-10-22'),(19,'2026-10-26'),(20,'2026-10-27'),
    (21,'2026-10-28'),(22,'2026-10-29'),(23,'2026-11-02')
), targets as (
  select sec.id as section_id,sec.school_id,sec.course_id,c.course_code
  from public.sections sec
  join public.schools s on s.id=sec.school_id
  join public.courses c on c.id=sec.course_id
  where s.name='Passaic County Community College'
    and sec.section_code in ('PCCC-DAY-L2-WLD205-2627','PCCC-DAY-L2-WLD210-2627')
), guides as (
  select g.id as guide_id,c.course_code
  from public.course_guides g
  join public.courses c on c.id=g.course_id
  join public.schools s on s.id=g.school_id
  where s.name='Passaic County Community College'
    and g.version_label='2026-09-14-DAY-L2-23-v1'
    and c.course_code in ('WLD 205','WLD 210')
)
insert into public.planner_days (
  school_id,section_id,planner_day_number,scheduled_date,title,status,course_id,guide_day_id
)
select t.school_id,t.section_id,d.day_num,d.scheduled_date,gd.title,'planned',t.course_id,gd.id
from targets t
join guides g on g.course_code=t.course_code
cross join dates d
join public.course_guide_days gd
  on gd.guide_id=g.guide_id and gd.planner_day_number=d.day_num
on conflict (section_id,planner_day_number) do update
set scheduled_date=excluded.scheduled_date,
    title=excluded.title,
    status='planned',
    course_id=excluded.course_id,
    guide_day_id=excluded.guide_day_id;

-- Visible and browseable for review, but deliberately not started.
insert into public.section_progress (
  school_id,section_id,current_planner_day_number,started_at,last_advanced_at,
  manual_hold,hold_reason,completed_at,updated_at
)
select sec.school_id,sec.id,1,null,null,true,
       'REVIEW MODE - Day Level 2 planner activated for curriculum/instructor review only. Do not start instruction until final approval.',
       null,now()
from public.sections sec
join public.schools s on s.id=sec.school_id
where s.name='Passaic County Community College'
  and sec.section_code in ('PCCC-DAY-L2-WLD205-2627','PCCC-DAY-L2-WLD210-2627')
on conflict (section_id) do update
set current_planner_day_number=1,
    started_at=null,
    last_advanced_at=null,
    manual_hold=true,
    hold_reason='REVIEW MODE - Day Level 2 planner activated for curriculum/instructor review only. Do not start instruction until final approval.',
    completed_at=null,
    updated_at=now();

commit;
