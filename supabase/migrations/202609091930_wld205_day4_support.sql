-- WLD 205 Day 4 instructor-support completion. Protected outcomes remain unchanged.
with target as (
  select d.id as guide_day_id,d.school_id,d.course_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' and d.planner_day_number=4
  order by g.updated_at desc limit 1
)
update public.course_guide_days d set
  instructor_prep='BEFORE CLASS: Launch Day 4 Live Class Activity. Open/print the Day 4 Decimal Student Pack and Instructor Guide. Stage ruler/tape and caliper if available. Keep the live whiteboard visible. Do not make an accept/reject decision unless a stated tolerance/source is present.',
  opening_review='0–8 min — Fraction/Decimal Retrieval: Students convert 1/8, 1/4, 3/8, 1/2, 5/8, 3/4, and 7/8 in, then complete Live Questions 1–7. Correction cue: numerator ÷ denominator; preserve the unit.',
  demonstration='8–20 min — Model 3/8 in = 0.375 in and 1 7/16 in = 1.4375 in. Show reverse reasoning with a common shop fraction/decimal. Emphasize that changing number format does not change physical length.',
  guided_practice='20–40 min — Decimal Shop Set A: 2.375 + 1.625; 6.500 − 2.1875; 1.25 × 3; 7.5 ÷ 3. Require work, answer with unit, and one reasonableness check; complete Live Questions 8–11.',
  independent_practice='40–54 min — Measurement Record: Convert 1 3/8 in to 1.375 in, compare to 1.372 in, calculate absolute difference 0.003 in, and state why difference alone is not an accept/reject decision. Complete Live Questions 12–13.',
  assessment='54–60 min — Rounding/Tolerance Preview: complete Live Questions 14–15 independently. 2.3764 to nearest .001 = 2.376; 4.000 ± .020 gives 3.980–4.020. Day 7 owns formal tolerance accept/reject reasoning.',
  instructor_checks='Instructor Rule: READ VALUE → CONVERT → CALCULATE/COMPARE → KEEP UNIT → ROUND ONLY WHEN DIRECTED → CHECK SOURCE. Remediate only the unresolved domain: Fraction→Decimal, Decimal Operations, Measurement Comparison, Rounding/Precision, or Tolerance Preview.',
  common_problems='Dropping units; converting the denominator incorrectly; mixing fraction and decimal values without conversion; rounding too early; treating a measured difference as an automatic pass/fail; or changing a measured value to fit a tolerance.',
  teaching_tips='Ask students to say the operation before calculating. Keep original and converted measurements visible side-by-side. For every comparison ask: What source gives the required precision or tolerance?',
  materials_equipment='Day 4 Decimal Student Pack; Day 4 Instructor Guide; live whiteboard; ruler/tape; caliper where available; authorized conversion/tolerance source where used.',
  updated_at=now()
from target t where d.id=t.guide_day_id;

with target as (
  select d.id as guide_day_id from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' and d.planner_day_number=4 order by g.updated_at desc limit 1
)
update public.course_guide_day_segments s set
  instructor_actions=case s.sequence_number
    when 1 then 'Use the Day 4 Student Pack retrieval set. Students convert the seven common fractions and complete Live Questions 1–7. Correct conversion method and units immediately.'
    when 2 then 'Model 3/8 → 0.375 and 1 7/16 → 1.4375, then reverse one common decimal to a fraction using the authorized reference/method. Keep units visible.'
    when 3 then 'Run Decimal Shop Set A. Require work, unit, and reasonableness check before Live Questions 8–11.'
    when 4 then 'Use the Measurement Record: 1 3/8 = 1.375; compare to 1.372; absolute difference .003. Ask why this is not yet a pass/fail decision; complete Live Questions 12–13.'
    when 5 then 'Run Live Questions 14–15 independently. Preview rounding and limits only; do not replace Day 7 tolerance instruction.'
    else s.instructor_actions end,
  student_actions=case s.sequence_number
    when 1 then 'Convert all seven common fractions to decimals with units and complete Live Questions 1–7.'
    when 2 then 'Follow both conversion examples and explain the conversion operation in plain language.'
    when 3 then 'Complete all four Decimal Shop Set A problems with work, units, and a reasonableness check; answer Live Questions 8–11.'
    when 4 then 'Complete the measurement record, calculate the .003 in difference, and explain why a tolerance/source is still required; answer Live Questions 12–13.'
    when 5 then 'Complete Live Questions 14–15 independently without instructor help.'
    else s.student_actions end,
  notes='2026-09-09 Day 4 instructor-support completion. Protected outcomes unchanged.',updated_at=now()
from target t where s.guide_day_id=t.guide_day_id and s.sequence_number between 1 and 5;

update public.assessment_modules set version=greatest(coalesce(version,0),13),
  instructions='DAY 4 LIVE CLASS
0–8 min — Convert 1/8, 1/4, 3/8, 1/2, 5/8, 3/4, and 7/8 in; complete Questions 1–7.
8–20 min — Model 3/8 and 1 7/16 conversions and reverse reasoning. Preserve units.
20–40 min — Decimal Shop Set A; show work, units, and reasonableness; complete Questions 8–11.
40–54 min — Measurement Record: convert 1 3/8 to decimal, compare to 1.372 in, find absolute difference, and explain why tolerance/source is still required; complete Questions 12–13.
54–60 min — Complete Questions 14–15 independently as rounding/tolerance preview.
Do not round a measurement to make it pass or invent a tolerance.',
  reference_body='Preserve the unit. Convert before comparing. Round only to the precision required by the source/job. A measured difference is not automatically an accept/reject decision; the stated tolerance/source is required.'
where slug='wld205_pvhs_bridge_day4';

with target as (
  select d.id as guide_day_id,d.school_id,d.course_id from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' and d.planner_day_number=4 order by g.updated_at desc limit 1
)
delete from public.course_guide_day_resources r using target t
where r.guide_day_id=t.guide_day_id and r.resource_title like 'WLD 205 Support:%';

with target as (
  select d.id as guide_day_id,d.school_id,d.course_id from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' and d.planner_day_number=4 order by g.updated_at desc limit 1
)
insert into public.course_guide_day_resources(school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,resource_notes,required,integration_mode,rights_basis,student_safe,license_notes)
select t.school_id,t.course_id,t.guide_day_id,v.seq,'other',v.title,v.url,v.notes,true,'native','school_owned',v.safe,'Original PCCC/LTG support content; authorized sources remain controlling.'
from target t cross join (values
 (50,'WLD 205 Support: Day 4 Decimal Student Pack','/live-activities/wld205-day4-decimal-student-pack.html','Fraction/decimal retrieval, Decimal Shop Set A, measurement record, and rounding/tolerance preview.',true),
 (51,'WLD 205 Support: Day 4 Instructor Guide','/live-activities/wld205-day4-instructor-guide.html','Instructor timing, worked keys, correction cues, live-question mapping, and focused remediation.',false)
) v(seq,title,url,notes,safe);