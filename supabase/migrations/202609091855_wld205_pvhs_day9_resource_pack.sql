-- WLD 205 PVHS Day 9 integrated-readiness instructor/resource pack.
-- Original PCCC/LTG bridge content only. Protected outcomes and authorized sources remain controlling.

with target as (
  select d.id as guide_day_id, d.school_id, d.course_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active'
    and d.planner_day_number=9
  order by g.updated_at desc
  limit 1
)
update public.course_guide_days d
set
  instructor_prep='BEFORE CLASS: Launch the Day 9 Live Class Activity and open/print the Targeted Repair Mini-Stations, Bridge Print C — BASE-C, Integrated Readiness Worksheet, Parallel Recheck Bank, Readiness Record, and Instructor Key. Stage the authorized drawing/symbol/material sources and approved WPS/SWPS examples required by the task. This is prerequisite readiness evidence only; do not begin the shared Level II core early.',
  opening_review='0–10 min — Bridge Readiness Quick Check: Students complete Live Questions 1–9 independently: Q1–3 Blueprint/Source, Q4–6 Math/Tolerance, Q7–9 Material Behavior. Use the live domain results to identify the weakest remaining prerequisite domain. Do not rank students and do not repeat a domain already demonstrated successfully.',
  demonstration='10–25 min — Targeted Repair Mini-Station: PAUSE THE DEVICE. Assign ONE station by evidence: Blueprint Locate, Math Measure, or Material Behavior. Model one clean correction, require the student to complete that station, then reduce prompting. The station is corrective practice, not a new Level II lesson.',
  guided_practice='25–48 min — Integrated Readiness Scenario: Resume the live activity and use Bridge Print C — BASE-C plus the Integrated Readiness Worksheet for Live Questions 10–14. Students connect print/source reading, center calculation, tolerance limits, accept/reject reasoning, material/source control, and HAZ identification. Require READ → CALCULATE → CHECK SOURCE → DECIDE → DOCUMENT.',
  independent_practice='48–56 min — Parallel Recheck: PAUSE. Select one NEW item from the Parallel Recheck Bank only in the student’s weakest remaining domain. No coaching during the response. A clean independent response closes the gap for today; if still weak, record only that unresolved support item.',
  assessment='56–60 min — Readiness Close: Complete the Day 9 Readiness Record. Record one demonstrated Level I strength, one remaining support item if any, and the evidence. Explain that Day 10 is the WLD-210 overlap and Day 11 begins the common WLD-205 sequence. This is readiness evidence, not an AWS credential or class ranking.',
  instructor_checks='Instructor Rule: CHECK → IDENTIFY GAP → REPAIR ONE DOMAIN → INTEGRATE → RECHECK → RECORD. Verify evidence by domain: Blueprint/Source, Math/Tolerance, Material Behavior. Carry forward only the unresolved gap.',
  common_problems='Repeating the whole bridge instead of the weak domain; guessing from memory rather than using the source; losing units; accepting a value without written tolerance limits; treating “carbon steel” as an exact grade; or treating readiness practice as AWS credential evidence.',
  teaching_tips='Keep the first 9 questions diagnostic. Do not teach through the quick check. During repair, model only the identified error. During BASE-C, require students to point to the controlling source before making a procedure/material claim. During the parallel recheck, remove coaching completely so the correction is independently demonstrated.',
  materials_equipment='Day 9 Targeted Repair Mini-Stations; Bridge Print C — BASE-C; Integrated Readiness Worksheet; Parallel Recheck Bank; Day 9 Readiness Record; Day 9 Instructor Key / Delivery Guide; authorized drawing/symbol/material references; approved WPS/SWPS examples where cited.',
  updated_at=now()
from target t
where d.id=t.guide_day_id;

with target as (
  select d.id as guide_day_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active'
    and d.planner_day_number=9
  order by g.updated_at desc
  limit 1
)
update public.course_guide_day_segments s
set
  instructor_actions=case s.sequence_number
    when 1 then 'Run Live Questions 1–9 independently: Q1–3 Blueprint/Source, Q4–6 Math/Tolerance, Q7–9 Material Behavior. Use the domain result only to assign the weakest needed repair station. Do not teach through the diagnostic.'
    when 2 then 'Pause student devices. Assign exactly one repair station: Blueprint Locate, Math Measure, or Material Behavior. Model one correction, then require the student to complete the station with reduced prompting.'
    when 3 then 'Resume Live Questions 10–14. Use Bridge Print C — BASE-C and the Integrated Readiness Worksheet. Require READ → CALCULATE → CHECK SOURCE → DECIDE → DOCUMENT and keep approved WPS/SWPS/material sources controlling.'
    when 4 then 'Select one new item from the Parallel Recheck Bank only in the weakest remaining domain. Give no coaching. Record secure if independently correct; otherwise carry forward only that specific gap.'
    when 5 then 'Use the Readiness Record to document one demonstrated Level I strength, one remaining support item if any, and the evidence. Clarify Day 10 WLD-210 overlap and Day 11 common WLD-205 start.'
    else s.instructor_actions end,
  student_actions=case s.sequence_number
    when 1 then 'Complete Live Questions 1–9 independently. Do not use classmates as a source. Show units/calculation work where required.'
    when 2 then 'Complete only the assigned repair station and correct the identified gap.'
    when 3 then 'Use Bridge Print C and the worksheet to complete Live Questions 10–14: locate source information, calculate center/tolerance, make the decision, and state only supported material conclusions.'
    when 4 then 'Complete one new parallel item independently in the assigned domain.'
    when 5 then 'Review the readiness close and identify the evidence supporting one strength and any remaining support need.'
    else s.student_actions end,
  notes='2026-09-09 Day 9 integrated-readiness resource pack. Protected WLD 205 outcomes unchanged; readiness evidence is not AWS credential evidence.',
  updated_at=now()
from target t
where s.guide_day_id=t.guide_day_id
  and s.sequence_number between 1 and 5;

with target as (
  select d.id as guide_day_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active'
    and d.planner_day_number=9
  order by g.updated_at desc
  limit 1
)
delete from public.course_guide_day_resources r
using target t
where r.guide_day_id=t.guide_day_id
  and r.resource_title in (
    'Day 9 Targeted Repair Mini-Stations',
    'Bridge Print C — BASE-C',
    'Day 9 Integrated Readiness Worksheet',
    'Day 9 Parallel Recheck Bank',
    'Day 9 Bridge Readiness Record',
    'Day 9 Instructor Key / Delivery Guide'
  );

with target as (
  select d.id as guide_day_id, d.school_id, d.course_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active'
    and d.planner_day_number=9
  order by g.updated_at desc
  limit 1
)
insert into public.course_guide_day_resources(
  school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,
  resource_notes,required,integration_mode,rights_basis,student_safe,license_notes
)
select t.school_id,t.course_id,t.guide_day_id,v.sequence_number,'other',v.resource_title,v.resource_url,
       v.resource_notes,v.required,'native','school_owned',v.student_safe,
       'Original PCCC/LTG prerequisite bridge content. Authorized drawing/symbol/material sources and approved WPS/SWPS remain separate controlling sources.'
from target t
cross join (values
  (1,'Day 9 Targeted Repair Mini-Stations','/live-activities/wld205-day9-mini-stations.svg','Three targeted repair stations: Blueprint Locate, Math Measure, and Material Behavior. Assign one only from diagnostic evidence.',true,true),
  (2,'Bridge Print C — BASE-C','/live-activities/wld205-day9-bridge-print-c.svg','Standalone training print for the integrated scenario: 10.000 × 6.000 in base plate, centered tab, ±0.030 in location tolerance, carbon-steel source note, and WELD PER APPROVED WPS/SWPS.',true,true),
  (3,'Day 9 Integrated Readiness Worksheet','/live-activities/wld205-day9-integrated-worksheet.svg','Student worksheet connecting print/source, math/tolerance, material/source control, and documented decision evidence.',true,true),
  (4,'Day 9 Parallel Recheck Bank','/live-activities/wld205-day9-parallel-recheck-bank.svg','Nine instructor-selected parallel items: three Blueprint/Source, three Math/Tolerance, and three Material-Behavior/Source-Control. Use one new item only in the weakest remaining domain.',true,false),
  (5,'Day 9 Bridge Readiness Record','/live-activities/wld205-day9-readiness-record.svg','Closeout record for one demonstrated strength, one remaining support item if any, and evidence. Not AWS credential evidence.',true,false),
  (6,'Day 9 Instructor Key / Delivery Guide','/live-activities/wld205-day9-instructor-key.svg','Instructor-only timing, Quick Check answers/domain mapping, mini-station keys, BASE-C answers, recheck guidance, and readiness close instructions.',true,false)
) as v(sequence_number,resource_title,resource_url,resource_notes,required,student_safe);

update public.assessment_modules
set version=greatest(coalesce(version,0),13),
    instructions='DAY 9 LIVE CLASS
0–10 min — Complete Questions 1–9 independently: Q1–3 Blueprint/Source, Q4–6 Math/Tolerance, Q7–9 Material Behavior.
10–25 min — PAUSE DEVICE. Instructor assigns ONE Targeted Repair Mini-Station from actual evidence. Do not repeat a secure domain.
25–48 min — Resume Questions 10–14 using Bridge Print C — BASE-C and the Integrated Readiness Worksheet. READ → CALCULATE → CHECK SOURCE → DECIDE → DOCUMENT.
48–56 min — PAUSE. Complete one NEW Parallel Recheck item only in the weakest remaining domain, independently.
56–60 min — Readiness Close: record one demonstrated strength, one support need if any, and the evidence. Day 10 is WLD-210 overlap; common WLD-205 begins Day 11.
This is readiness evidence, not an AWS credential or class ranking.',
    reference_body='BASE-C training scenario: 10.000 × 6.000 in plate; vertical tab nominal center 5.000 in with ±0.030 in location tolerance; material note carbon steel with exact grade from instructor-issued source documentation; WELD PER APPROVED WPS/SWPS. Use only source-supported conclusions.'
where slug='wld205_pvhs_bridge_day9';
