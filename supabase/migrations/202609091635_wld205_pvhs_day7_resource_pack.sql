-- WLD 205 PVHS Day 7 instructor-support/resource pack.
-- Original PCCC/LTG prerequisite bridge content only.
-- Real acceptance and corrective action remain controlled by the approved print/tolerance source and applicable instructor/project procedure.

with target as (
  select d.id as guide_day_id, d.school_id, d.course_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active'
    and d.planner_day_number=7
  order by g.updated_at desc
  limit 1
)
update public.course_guide_days d
set
  instructor_prep='BEFORE CLASS: Open/print the Day 7 Tolerance Cards, Tolerance Set A, Mock Measurement Record, and Instructor Key. Stage the approved print/tolerance source used for any real or instructor-supplied example and the required measuring tools if a demonstration is planned. Launch the Day 7 Live Class Activity before the warm-up. Do not create or alter tolerance values to make a measured part pass.',
  opening_review='0–8 min — Tolerance Retrieval: Use the three Tolerance Cards. Students identify nominal value and permitted variation, calculate lower/upper limits, keep units, and complete Live Questions 1–3. Card C provides the fractional limit example; correct limit-calculation errors before moving to accept/reject reasoning.',
  demonstration='8–20 min — Tolerance Decision Model: Write the standing chain NOMINAL → LIMITS → ACTUAL → DECISION. Model one accepted case and one rejected case. Require both limits before judging the actual measurement. Emphasize that an out-of-tolerance value is not rounded into acceptance and the original measurement remains part of the record.',
  guided_practice='20–40 min — Tolerance Set A: Students complete six decimal accept/reject cases and Live Questions 4–9. For every case require nominal/tolerance, lower limit, upper limit, actual value, units, and decision. Coach only the failed decision point: calculation, comparison, or decision.',
  independent_practice='40–54 min — Measurement Record + Corrective/Recheck Note: Use the provided mock A/B/C measurement record. Students calculate the limits, identify B as out of tolerance, preserve the original 7.984 in measurement, and write a factual hold/correction/recheck note. Complete Live Questions 10–11. Physical correction occurs only under the applicable WLD-210/instructor/project controls.',
  assessment='54–60 min — 4-Item Independent Check: Students complete Live Questions 12–15 with no coaching. Questions 12–14 are independent accept/reject decisions; Question 15 checks the complete decision chain. Review by domain: Calculate Limits, Compare Actual, Accept/Reject, or Document/Recheck.',
  instructor_checks='Instructor Rule: NOMINAL → LIMITS → ACTUAL → DECISION → DOCUMENT when action is required. Verify written limits and units before accepting a decision. Record only the unresolved domain. For a gap, model one parallel case and require an immediate independent recheck. Do not repeat a domain already demonstrated successfully.',
  common_problems='Judging the actual before calculating both limits; dropping units; adding/subtracting the tolerance incorrectly; confusing nominal with a limit; rounding an out-of-tolerance value into acceptance; erasing the original measurement; or changing the requirement to fit the part.',
  teaching_tips='Make the decision chain visible throughout the lesson. Ask for lower limit, upper limit, actual, then decision in that order. Separate a math error from a comparison error from a documentation error. Keep the fractional example in the retrieval phase and use the six decimal cases for repeated accept/reject practice.',
  materials_equipment='Day 7 Tolerance Cards; Day 7 Tolerance Set A; Day 7 Mock Measurement + Corrective/Recheck Record; Day 7 Instructor Key / Delivery Guide; measuring tools as appropriate; approved print/tolerance source for real or instructor-supplied examples.',
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
    and d.planner_day_number=7
  order by g.updated_at desc
  limit 1
)
update public.course_guide_day_segments s
set
  instructor_actions=case s.sequence_number
    when 1 then 'Use the three Tolerance Cards. Students identify nominal and permitted variation, calculate lower/upper limits, keep units, and complete Live Questions 1–3. Card C is the fractional example.'
    when 2 then 'Model NOMINAL → LIMITS → ACTUAL → DECISION using one accepted and one rejected case. Require both limits before the decision. Do not round an out-of-tolerance value into acceptance.'
    when 3 then 'Use Tolerance Set A for six decimal cases. Require written lower/upper limits, actual, units, and ACCEPT/REJECT before Live Questions 4–9. Coach only the failed calculation/comparison/decision step.'
    when 4 then 'Use the Mock Measurement Record. Students identify record B as out of tolerance, preserve the original measurement, and write a factual hold/correction/recheck note before Live Questions 10–11.'
    when 5 then 'Run Live Questions 12–15 independently with no coaching. Questions 12–14 check accept/reject reasoning; Question 15 checks the full decision chain. Record only the unresolved domain.'
    else s.instructor_actions end,
  student_actions=case s.sequence_number
    when 1 then 'Complete all three Tolerance Cards with nominal, variation, lower limit, upper limit, and units; answer Live Questions 1–3.'
    when 2 then 'Follow the decision chain and explain why one actual is inside or outside the stated limits.'
    when 3 then 'Complete all six Tolerance Set A cases with written limits, units, actual value, and ACCEPT/REJECT; answer Live Questions 4–9.'
    when 4 then 'Complete the A/B/C measurement record, circle the out-of-tolerance result, preserve the original measurement, and write the corrective/recheck note; answer Live Questions 10–11.'
    when 5 then 'Complete Live Questions 12–15 independently without instructor help.'
    else s.student_actions end,
  notes='2026-09-09 Day 7 instructor-support resource pack. Protected WLD 205 outcomes unchanged; approved print/tolerance sources and applicable correction procedures remain controlling.',
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
    and d.planner_day_number=7
  order by g.updated_at desc
  limit 1
)
delete from public.course_guide_day_resources r
using target t
where r.guide_day_id=t.guide_day_id
  and r.resource_title in (
    'Day 7 Tolerance Cards',
    'Day 7 Tolerance Set A',
    'Day 7 Mock Measurement + Corrective/Recheck Record',
    'Day 7 Instructor Key / Delivery Guide'
  );

with target as (
  select d.id as guide_day_id, d.school_id, d.course_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active'
    and d.planner_day_number=7
  order by g.updated_at desc
  limit 1
)
insert into public.course_guide_day_resources(
  school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,
  resource_notes,required,integration_mode,rights_basis,student_safe,license_notes
)
select t.school_id,t.course_id,t.guide_day_id,v.sequence_number,'other',v.resource_title,v.resource_url,
       v.resource_notes,v.required,'native','school_owned',v.student_safe,
       'Original PCCC/LTG prerequisite bridge content. Approved print/tolerance sources and applicable project/instructor procedures remain separate controlling sources.'
from target t
cross join (values
  (1,'Day 7 Tolerance Cards','/live-activities/wld205-day7-tolerance-cards.svg','Three-card retrieval set: 2.000 ± 0.030 in, 6.500 ± 0.015 in, and 1 1/2 ± 1/32 in. Supports Live Questions 1–3.',true,true),
  (2,'Day 7 Tolerance Set A','/live-activities/wld205-day7-tolerance-set-a.svg','Six decimal accept/reject cases with fields for limits, actual, units, and decision. Supports Live Questions 4–9.',true,true),
  (3,'Day 7 Mock Measurement + Corrective/Recheck Record','/live-activities/wld205-day7-measurement-record.svg','A/B/C mock measurement record plus factual corrective/recheck note frame. Supports Live Questions 10–11.',true,true),
  (4,'Day 7 Instructor Key / Delivery Guide','/live-activities/wld205-day7-instructor-key.svg','Instructor-only timing, worked limits, decision keys, correction cues, live-question mapping, and focused-retry guidance.',true,false)
) as v(sequence_number,resource_title,resource_url,resource_notes,required,student_safe);

update public.assessment_modules
set version=greatest(coalesce(version,0),13),
    instructions='DAY 7 LIVE CLASS
0–8 min — Tolerance Cards: identify nominal and permitted variation, calculate both limits, keep units, and complete Questions 1–3.
8–20 min — Model the standing chain: NOMINAL → LIMITS → ACTUAL → DECISION. Do not judge the actual until both limits are written.
20–40 min — Tolerance Set A: complete six decimal accept/reject cases and Questions 4–9 with written limits and units.
40–54 min — Mock Measurement Record: identify the out-of-tolerance result, preserve the original measurement, write the factual hold/correction/recheck note, and complete Questions 10–11.
54–60 min — Complete Questions 12–15 independently. Questions 12–14 check decisions; Question 15 checks the complete decision chain.
Do not round an out-of-tolerance value into acceptance, erase the original measurement, or change the requirement to fit the part.',
    reference_body='Decision chain: NOMINAL → LIMITS → ACTUAL → DECISION. When action is required, document the actual condition and follow the applicable hold/correction/recheck procedure. The approved job print/tolerance source controls real work.'
where slug='wld205_pvhs_bridge_day7';
