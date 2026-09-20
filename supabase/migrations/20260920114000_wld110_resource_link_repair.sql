-- Repair all WLD 110 College Day/Night resource links and late-semester project mapping.
-- Resource-only / implementation-detail repair. Protected curriculum and course outcomes are unchanged.

with target_days as (
  select d.id,d.planner_day_number
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 110'
    and g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
),
native_source as (
  select id from public.resource_sources where name='LTG Native' and active=true limit 1
)
update public.course_guide_day_resources r
set resource_title='WLD 110 OFC Shop Reference — Safety, Setup & Cutting',
    resource_url='/resources/wld110/ofc-shop-reference.html#day-'||t.planner_day_number,
    resource_notes='Native LTG shop reference for the OFC focus on this planner day. PCCC procedure and manufacturer instructions control actual equipment settings and operation.',
    source_id=(select id from native_source),
    integration_mode='native',
    rights_basis='school_owned',
    student_safe=true,
    updated_at=now()
from target_days t
where r.guide_day_id=t.id
  and r.resource_title='AWS Oxy-Fuel Cutting (OFC) Instructional Packet';

with target_days as (
  select d.id,d.planner_day_number
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 110'
    and g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
),
native_source as (
  select id from public.resource_sources where name='LTG Native' and active=true limit 1
)
update public.course_guide_day_resources r
set resource_title='WLD 110 SMAW Shop Reference — E6010/E6011/E7018 Technique & Quality',
    resource_url='/resources/wld110/smaw-shop-reference.html#day-'||t.planner_day_number,
    resource_notes='Native LTG shop reference for the SMAW focus on this planner day. Assigned procedure, instructor direction, and PCCC acceptance requirements remain controlling.',
    source_id=(select id from native_source),
    integration_mode='native',
    rights_basis='school_owned',
    student_safe=true,
    updated_at=now()
from target_days t
where r.guide_day_id=t.id
  and r.resource_title='AWS Shielded Metal Arc Welding (SMAW) Instructional Packet';

-- Days 14-16 stay on the approved Fabricated M packet.
with target_days as (
  select d.id,d.planner_day_number
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 110'
    and g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
    and d.planner_day_number between 14 and 16
),
school_source as (
  select id from public.resource_sources where name='School-Created' and active=true limit 1
)
update public.course_guide_day_resources r
set resource_title='Fabricated M Project Packet — Approved Print, Cut List & QC',
    resource_url='/resources/wld105/fabricated-m-project-packet.html',
    resource_notes='Use the approved Fabricated M print, build-readiness work, QC record and rubric from WLD 105.',
    source_id=(select id from school_source),
    integration_mode='native',
    rights_basis='school_owned',
    student_safe=true,
    updated_at=now()
from target_days t
where r.guide_day_id=t.id
  and r.sequence_number=3;

-- Days 17-23 use Steel Dice. Tube Cube remains blocked until an approved controlling print exists.
with target_days as (
  select d.id,d.planner_day_number
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 110'
    and g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
    and d.planner_day_number between 17 and 23
),
school_source as (
  select id from public.resource_sources where name='School-Created' and active=true limit 1
)
update public.course_guide_day_resources r
set resource_title='Steel Dice Project Packet — Approved Print, Cut List & QC',
    resource_url='/resources/wld105/steel-dice-project-packet.html',
    resource_notes='Use the approved Steel Dice print, build-readiness work, QC record and rubric from WLD 105.',
    source_id=(select id from school_source),
    integration_mode='native',
    rights_basis='school_owned',
    student_safe=true,
    updated_at=now()
from target_days t
where r.guide_day_id=t.id
  and r.sequence_number=3;

-- Align Days 17-20 implementation text to the Steel Dice project already controlling the paired WLD 105 work.
with target as (
  select d.id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 110'
    and g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
    and d.planner_day_number between 17 and 20
)
update public.course_guide_days d
set title=replace(d.title,'Fabricated M','Steel Dice'),
    objective=replace(d.objective,'Fabricated M','Steel Dice'),
    guided_practice=replace(coalesce(d.guided_practice,''),'Fabricated M','Steel Dice'),
    independent_practice=replace(coalesce(d.independent_practice,''),'Fabricated M','Steel Dice'),
    assessment=replace(coalesce(d.assessment,''),'Fabricated M','Steel Dice'),
    teaching_tips=replace(coalesce(d.teaching_tips,''),'Fabricated M','Steel Dice'),
    updated_at=now()
where d.id in (select id from target);

with target as (
  select d.id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 110'
    and g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
    and d.planner_day_number between 17 and 20
)
update public.course_guide_day_segments s
set segment_title=replace(coalesce(s.segment_title,''),'Fabricated M','Steel Dice'),
    instructor_actions=replace(coalesce(s.instructor_actions,''),'Fabricated M','Steel Dice'),
    student_actions=replace(coalesce(s.student_actions,''),'Fabricated M','Steel Dice'),
    notes=replace(coalesce(s.notes,''),'Fabricated M','Steel Dice'),
    updated_at=now()
where s.guide_day_id in (select id from target);

-- Remove active Tube Cube instructions from WLD 110. The approved Steel Dice packet remains the controlling late-semester build.
with target as (
  select d.id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 110'
    and g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
)
update public.course_guide_day_segments s
set notes=case
      when s.notes like '%Weeks 1-3 prep/practice; Weeks 4-6 M, Dice, and Tube Cube.%'
        then replace(s.notes,'Weeks 1-3 prep/practice; Weeks 4-6 M, Dice, and Tube Cube.','Weeks 1-3 prep/practice; Weeks 4-6 approved Fabricated M and Steel Dice work only.')
      else s.notes end,
    segment_title=replace(coalesce(s.segment_title,''),'Tube Cube','Steel Dice'),
    instructor_actions=replace(coalesce(s.instructor_actions,''),'Tube Cube','Steel Dice'),
    student_actions=replace(coalesce(s.student_actions,''),'Tube Cube','Steel Dice'),
    updated_at=now()
where s.guide_day_id in (select id from target)
  and (
    coalesce(s.notes,'') ilike '%Tube Cube%'
    or coalesce(s.segment_title,'') ilike '%Tube Cube%'
    or coalesce(s.instructor_actions,'') ilike '%Tube Cube%'
    or coalesce(s.student_actions,'') ilike '%Tube Cube%'
  );

with target as (
  select d.id,d.planner_day_number
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 110'
    and g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
    and d.planner_day_number between 21 and 23
)
update public.course_guide_days d
set corresponding_application=
      'Paired WLD-105 late-semester project module is pending its approved controlling print. Continue only approved Steel Dice closeout work in WLD-110.',
    updated_at=now()
where d.id in (select id from target);

-- Day 22/23 explicit cleanup after the general substitution.
with target as (
  select d.id,d.planner_day_number
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 110'
    and g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
    and d.planner_day_number in (22,23)
)
update public.course_guide_day_segments s
set segment_title=case
      when t.planner_day_number=23 and s.sequence_number=5 then 'Steel Dice QC, Final Records + Safe Closeout'
      else s.segment_title end,
    instructor_actions=case
      when t.planner_day_number=22 and s.sequence_number=1
        then replace(s.instructor_actions,'4F E7018 + Steel Dice Fit-Up','4F E7018 + Steel Dice Fit-Up')
      when t.planner_day_number=23 and s.sequence_number=1
        then replace(s.instructor_actions,'Steel Dice closeout','Steel Dice closeout')
      when t.planner_day_number=23 and s.sequence_number=5
        then replace(s.instructor_actions,'Steel Dice dimensional/weld QC','Steel Dice dimensional/weld QC')
      else s.instructor_actions end,
    updated_at=now()
from target t
where s.guide_day_id=t.id;

