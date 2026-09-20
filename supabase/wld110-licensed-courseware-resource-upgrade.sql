-- Upgrade WLD 110 daily resources using school-purchased Fundamentals of Welding courseware.
-- Implementation/resource change only. Protected curriculum/outcomes and LTG time authority are unchanged.

insert into public.resource_sources(school_id,name,source_kind,website_url,notes,system_defined,active)
select '08ccb452-83ab-482f-bb28-5576e02741b2'::uuid,
       'Fundamentals of Welding Courseware — Licensed',
       'publisher',
       null,
       'School-purchased welding courseware. Access/use is limited to instructors and students covered by the school/student purchase.',
       false,
       true
where not exists (
  select 1 from public.resource_sources
  where school_id='08ccb452-83ab-482f-bb28-5576e02741b2'::uuid
    and name='Fundamentals of Welding Courseware — Licensed'
);

-- Reserve sequence 3 for the daily safety crosswalk. Existing project packets move to sequence 4.
with target_days as (
  select d.id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 110'
    and g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
    and d.planner_day_number between 14 and 23
)
update public.course_guide_day_resources r
set sequence_number=4, updated_at=now()
where r.guide_day_id in (select id from target_days)
  and r.sequence_number=3;

with source as (
  select id
  from public.resource_sources
  where school_id='08ccb452-83ab-482f-bb28-5576e02741b2'::uuid
    and name='Fundamentals of Welding Courseware — Licensed'
  order by created_at desc
  limit 1
),
map(day_number,focus,slides) as (
  values
(1,'Equipment Identification + Pre-Use Inspection','9–30'),
(2,'External Equipment Checks','24–30'),
(3,'Hazards + Gas-Cylinder Controls','87–93'),
(4,'OFC Fundamentals + Flame Control','43–61'),
(5,'Gas and Fuel Selection','43–56'),
(6,'Straight-Cut Practice','64–76'),
(7,'Shutdown + Abnormal Events','87–93'),
(8,'Integrated Cutting Practice','64–76'),
(9,'Workstation Organization','27–30, 87'),
(10,'Plate Alignment + Controlled Cut','64–76'),
(11,'Cut-Quality Refinement','72–86'),
(12,'OFC Performance Checkpoint','79–93'),
(13,'Full Supervised OFC Operation','57–68'),
(14,'Project-Cut Support','72–86'),
(15,'OFC Troubleshooting','79–90'),
(16,'Performance + Project Completion','72–86'),
(17,'Repeated Straight/Square Cuts','64–86'),
(18,'Project Cutting','64–86'),
(19,'Cut Correction','79–90'),
(20,'Final OFC Evidence','81–93'),
(21,'Steel Dice Cutting Support','64–86'),
(22,'Steel Dice Fit-Up Support','72–86'),
(23,'Final OFC Evidence + Closeout','57–93')
),
target as (
  select d.id,d.planner_day_number,m.focus,m.slides
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  join map m on m.day_number=d.planner_day_number
  where c.course_code='WLD 110'
    and g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
)
update public.course_guide_day_resources r
set resource_title='OFC Licensed Courseware — '||t.focus,
    resource_url='/resources/wld110/ofc-shop-reference.html#day-'||t.planner_day_number,
    resource_notes='Licensed source: Chapter 8 — Oxygen Gas Cutting, slides '||t.slides||'. Open the LTG crosswalk at today''s section before the OFC demo/practice.',
    source_id=(select id from source),
    integration_mode='native',
    rights_basis='licensed',
    student_safe=true,
    license_notes='PCCC/student-purchased courseware; use limited to instructors and students covered by the purchase.',
    updated_at=now()
from target t
where r.guide_day_id=t.id and r.sequence_number=1;

with source as (
  select id
  from public.resource_sources
  where school_id='08ccb452-83ab-482f-bb28-5576e02741b2'::uuid
    and name='Fundamentals of Welding Courseware — Licensed'
  order by created_at desc
  limit 1
),
map(day_number,focus,slides) as (
  values
(1,'Equipment Inspection + First Arc Starts','17–32, 63–65'),
(2,'External Equipment Checks + 1F Consistency','26–32, 57–62'),
(3,'1F Fillet Introduction','57–62'),
(4,'1F Corrective Practice','60–62, 67'),
(5,'E7018 Introduction','39–51'),
(6,'E7018 1F Fillets','50–51, 57–62'),
(7,'1F Performance Checkpoint','63–70'),
(8,'Integrated 1F Practice','57–70'),
(9,'2F Transition with E6010/E6011','43–45, 57–59'),
(10,'E7018 2F','50–51, 57–62'),
(11,'2F Refinement','60–62, 67'),
(12,'2F Performance Checkpoint','57–70'),
(13,'3F E6010/E6011','43–45, 54, 57–59'),
(14,'E7018 3F','48–51, 54, 57–59'),
(15,'3F Troubleshooting','60–70'),
(16,'3F Performance Checkpoint','57–70'),
(17,'3F Production Practice','57–62'),
(18,'3F Production + Project Work','57–62'),
(19,'Correction + Assembly Support','60–70'),
(20,'Final 3F Evidence','57–70'),
(21,'4F E6010/E6011','43–45, 54, 57–59'),
(22,'4F E7018','48–51, 54, 57–59'),
(23,'Final SMAW Evidence','39–70')
),
target as (
  select d.id,d.planner_day_number,m.focus,m.slides
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  join map m on m.day_number=d.planner_day_number
  where c.course_code='WLD 110'
    and g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
)
update public.course_guide_day_resources r
set resource_title='SMAW Licensed Courseware — '||t.focus,
    resource_url='/resources/wld110/smaw-shop-reference.html#day-'||t.planner_day_number,
    resource_notes='Licensed source: Chapter 4 — Shielded Metal Arc Welding, slides '||t.slides||'. Open the LTG crosswalk at today''s section before the SMAW demo/practice.',
    source_id=(select id from source),
    integration_mode='native',
    rights_basis='licensed',
    student_safe=true,
    license_notes='PCCC/student-purchased courseware; use limited to instructors and students covered by the purchase.',
    updated_at=now()
from target t
where r.guide_day_id=t.id and r.sequence_number=2;

with source as (
  select id
  from public.resource_sources
  where school_id='08ccb452-83ab-482f-bb28-5576e02741b2'::uuid
    and name='Fundamentals of Welding Courseware — Licensed'
  order by created_at desc
  limit 1
),
map(day_number,focus,slides) as (
  values
(1,'Stop-Work Authority, PPE + Shop Orientation','4–6, 33–46'),
(2,'Electrical Equipment + Safe Handling','22–23, 33–44'),
(3,'Fire, Radiation + Hot-Metal Zones','11–16'),
(4,'Compressed-Gas Cylinder Safety','25–32'),
(5,'Fumes, Ventilation + PPE','17–20, 35–50'),
(6,'Cylinder + Torch-Area Safety','25–32, 40–49'),
(7,'Shutdown, Fire Prevention + Gas Safety','11–13, 25–32'),
(8,'PPE + Organized Shop','33–49'),
(9,'Housekeeping + Trip Hazards','33–34, 42–49'),
(10,'Electrical + Hand/Body Positioning','22–23, 40–46'),
(11,'Fire Prevention During Cutting/Welding','11–13'),
(12,'PPE + Respiratory Readiness','35–56'),
(13,'Compressed Gas + Flame-On Work','25–32'),
(14,'Project Hot-Work Controls','11–13, 33–49'),
(15,'Troubleshooting Without Creating Hazards','17–23, 25–32'),
(16,'PPE During Grinding, Rework + Hot Metal','35–51'),
(17,'Production Housekeeping + Hot-Metal Identification','11–13, 33–49'),
(18,'Cutting/Drilling/Grinding Zones','11–13, 33–51'),
(19,'Assembly Correction + Fire Controls','11–13, 33–51'),
(20,'Evaluation Without Shortcuts','4, 11–13, 35–51'),
(21,'Overhead Welding Protection','14–16, 35–51'),
(22,'Overhead E7018 + Fixture Safety','14–16, 35–51'),
(23,'Final Shop Closeout','4, 11–13, 25–33, 35–53')
),
target as (
  select d.id,d.school_id,d.course_id,d.planner_day_number,m.focus,m.slides
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  join map m on m.day_number=d.planner_day_number
  where c.course_code='WLD 110'
    and g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
)
insert into public.course_guide_day_resources(
  school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,
  resource_notes,required,source_id,integration_mode,rights_basis,student_safe,license_notes
)
select t.school_id,t.course_id,t.id,3,'reference',
       'Safety Licensed Courseware — '||t.focus,
       '/resources/wld110/welding-safety-courseware-guide.html#day-'||t.planner_day_number,
       'Licensed source: Chapter 2 — Welding Safety, slides '||t.slides||'. Use this as today''s safety reinforcement before energized/hot work.',
       true,(select id from source),'native','licensed',true,
       'PCCC/student-purchased courseware; use limited to instructors and students covered by the purchase.'
from target t
on conflict (guide_day_id,sequence_number) do update
set resource_type=excluded.resource_type,
    resource_title=excluded.resource_title,
    resource_url=excluded.resource_url,
    resource_notes=excluded.resource_notes,
    required=excluded.required,
    source_id=excluded.source_id,
    integration_mode=excluded.integration_mode,
    rights_basis=excluded.rights_basis,
    student_safe=excluded.student_safe,
    license_notes=excluded.license_notes,
    updated_at=now();
