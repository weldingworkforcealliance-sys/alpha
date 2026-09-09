-- WLD 205 PVHS Day 8 instructor-support/resource pack.
-- Original PCCC/LTG prerequisite bridge content only.
-- Corrects the HAZ teaching graphic so the HAZ is shown within unmelted base metal.
-- Does not begin the formal Level II ferrite/austenite/pearlite/TTT transformation block.

with target as (
  select d.id as guide_day_id, d.school_id, d.course_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active'
    and d.planner_day_number=8
  order by g.updated_at desc
  limit 1
)
update public.course_guide_days d
set
  instructor_prep='BEFORE CLASS: Open/print the Day 8 Weld/HAZ/Base-Metal Retrieval Sheet, HAZ Observation Cards, Heat-Effect Cause/Consequence Map, optional Material Observation Sheet, and Instructor Key. Stage the authorized metallurgy/material source used by the program and any instructor-approved sample/coupon/photo. Samples/photos are observation aids only; do not use appearance to claim exact hardness, microstructure, grade/alloy, exact cause, or procedure requirement. Launch the Day 8 Live Class Activity before the warm-up.',
  opening_review='0–8 min — Weld / HAZ / Base-Metal Retrieval: Use the corrected simplified cross-section. Students label A = weld metal, B = heat-affected zone, C = unaffected base metal, then complete Live Questions 1–3. Point out that the HAZ is part of the unmelted parent/base metal immediately adjacent to the fusion boundary; it is not deposited weld metal and is not a layer under the plate.',
  demonstration='8–20 min — Thermal Cycle + HAZ Model: Model one clean prerequisite idea: welding heat can change nearby base metal even though that HAZ did not melt. Contrast weld metal, HAZ, and unaffected base metal. Explain that exact hardness, exact microstructure, and exact material response require source/testing/procedure context. Save ferrite/austenite/pearlite/TTT transformation detail for the formal shared Level II metallurgy block after Day 22.',
  guided_practice='20–38 min — HAZ Observation Cards: Students work all three cards, then complete Live Questions 4–6. Require the response frame OBSERVE → CHECK SOURCE → STATE ONLY WHAT THE EVIDENCE SUPPORTS. Card 1 separates visible HAZ from exact-hardness claims; Card 2 treats angular movement/restraint as a concern requiring evaluation rather than proof of one exact cause; Card 3 connects geometry/thickness to possible cooling-behavior differences without inventing procedure implications.',
  independent_practice='38–52 min — Heat-Effect Cause / Consequence Map: Students connect higher restraint, higher thermal conductivity, and uncontrolled heat input/sequence to supported possible concerns, then identify the source that must control any exact procedure/material conclusion. Complete Live Questions 7–9. Do not invent preheat, interpass, heat-input, sequence, distortion-control, or acceptance values.',
  assessment='52–60 min — HAZ Exit: Students complete Live Questions 10–12 independently with no coaching. Review the full result by domain and record only the remaining prerequisite gap: Region Identification, Observation vs. Conclusion, Heat-Effect Reasoning, or Source Control.',
  instructor_checks='Instructor Rule: IDENTIFY → OBSERVE → CHECK SOURCE → STATE ONLY WHAT THE EVIDENCE SUPPORTS. Verify that the student can identify weld metal/HAZ/base metal, separate observation from exact conclusion, and name when the authorized source/procedure/testing is required. For a gap, model one parallel example and require an immediate independent recheck. Do not repeat a domain already demonstrated successfully.',
  common_problems='Calling the HAZ deposited weld metal; drawing or imagining the HAZ outside the parent material; assuming visible discoloration proves exact hardness or microstructure; treating angular distortion as proof of one exact cause; ignoring thickness/geometry effects; or inventing procedure/acceptance values from general heat-effect concepts.',
  teaching_tips='Keep Day 8 at prerequisite metallurgy-readiness level. Use the corrected cross-section first so students physically locate weld metal, fusion boundary, HAZ, and unaffected base metal. Ask in this order: What region is it? What can you observe? What source would prove the exact conclusion? Use samples/photos to make the discussion concrete, but do not turn visual observations into unsupported metallurgy claims.',
  materials_equipment='Day 8 Weld/HAZ/Base-Metal Retrieval Sheet; HAZ Observation Cards; Heat-Effect Cause/Consequence Map; optional Material Observation Sheet; Day 8 Instructor Key / Delivery Guide; corrected Day 8 Live Whiteboard; authorized metallurgy/material source supplied by instructor; labeled samples/coupons/photos where available.',
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
    and d.planner_day_number=8
  order by g.updated_at desc
  limit 1
)
update public.course_guide_day_segments s
set
  instructor_actions=case s.sequence_number
    when 1 then 'Use the corrected Weld/HAZ/Base-Metal Retrieval Sheet. Students label A = weld metal, B = HAZ, C = unaffected base metal, then complete Live Questions 1–3. Correct any idea that the HAZ is deposited weld metal or lies outside the parent material.'
    when 2 then 'Model the thermal-cycle idea at prerequisite level: weld metal melted/fused; HAZ is adjacent base metal affected by heat without melting; unaffected base metal lies beyond it. Exact hardness/microstructure/response requires authorized source, testing, procedure, and job context. Do not begin formal transformation metallurgy.'
    when 3 then 'Run all three HAZ Observation Cards. Require OBSERVE → CHECK SOURCE → STATE ONLY WHAT THE EVIDENCE SUPPORTS, then complete Live Questions 4–6. Samples/photos may support observation only.'
    when 4 then 'Use the Heat-Effect Cause/Consequence Map. Students connect restraint, conductivity, and heat input/sequence to supported possible concerns and identify what controlling source must be checked before making an exact claim. Then complete Live Questions 7–9.'
    when 5 then 'Run Live Questions 10–12 independently with no coaching. Record only the unresolved domain: Region Identification, Observation vs. Conclusion, Heat-Effect Reasoning, or Source Control.'
    else s.instructor_actions end,
  student_actions=case s.sequence_number
    when 1 then 'Label weld metal, HAZ, and unaffected base metal on the cross-section and complete Live Questions 1–3.'
    when 2 then 'Explain in plain language how the HAZ can change without melting and identify what information would require a source/test rather than visual guessing.'
    when 3 then 'Complete all three HAZ Observation Cards using the response frame OBSERVE → CHECK SOURCE → STATE ONLY WHAT THE EVIDENCE SUPPORTS; answer Live Questions 4–6.'
    when 4 then 'Complete the Heat-Effect Cause/Consequence Map, identify the required controlling source for exact conclusions, and answer Live Questions 7–9.'
    when 5 then 'Complete Live Questions 10–12 independently without instructor help.'
    else s.student_actions end,
  notes='2026-09-09 Day 8 instructor-support resource pack. Corrected HAZ cross-section; protected WLD 205 outcomes unchanged; formal transformation metallurgy remains reserved for the shared Level II block.',
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
    and d.planner_day_number=8
  order by g.updated_at desc
  limit 1
)
delete from public.course_guide_day_resources r
using target t
where r.guide_day_id=t.guide_day_id
  and r.resource_title in (
    'Day 8 Weld / HAZ / Base-Metal Retrieval Sheet',
    'Day 8 HAZ Observation Cards',
    'Day 8 Heat-Effect Cause / Consequence Map',
    'Day 8 Material Observation Sheet',
    'Day 8 Instructor Key / Delivery Guide'
  );

with target as (
  select d.id as guide_day_id, d.school_id, d.course_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active'
    and d.planner_day_number=8
  order by g.updated_at desc
  limit 1
)
insert into public.course_guide_day_resources(
  school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,
  resource_notes,required,integration_mode,rights_basis,student_safe,license_notes
)
select t.school_id,t.course_id,t.guide_day_id,v.sequence_number,'other',v.resource_title,v.resource_url,
       v.resource_notes,v.required,'native','school_owned',v.student_safe,
       'Original PCCC/LTG prerequisite bridge content. Authorized metallurgy/material sources, approved WPS/procedure, testing, and governing requirements remain separate controlling sources.'
from target t
cross join (values
  (1,'Day 8 Weld / HAZ / Base-Metal Retrieval Sheet','/live-activities/wld205-day8-cross-section-label.svg','Corrected student labeling sheet showing the HAZ within unmelted base metal adjacent to the fusion boundary; supports Live Questions 1–3.',true,true),
  (2,'Day 8 HAZ Observation Cards','/live-activities/wld205-day8-haz-observation-cards.svg','Three original observation/source-control cards matching the Day 8 scenarios; supports Live Questions 4–6.',true,true),
  (3,'Day 8 Heat-Effect Cause / Consequence Map','/live-activities/wld205-day8-heat-effect-map.svg','Student map for restraint, thermal conductivity, and heat input/sequence with supported-conclusion and source-check columns; supports Live Questions 7–9.',true,true),
  (4,'Day 8 Material Observation Sheet','/live-activities/wld205-day8-material-observation-sheet.svg','Optional sheet for instructor-provided samples/coupons/photos. Separates direct observation from unsupported exact metallurgy/material/procedure claims.',false,true),
  (5,'Day 8 Instructor Key / Delivery Guide','/live-activities/wld205-day8-instructor-key.svg','Instructor-only timing, region key, correction cues, live-question mapping, source-control rules, formal-metallurgy boundary, and focused-retry guidance.',true,false)
) as v(sequence_number,resource_title,resource_url,resource_notes,required,student_safe);

update public.assessment_modules
set version=greatest(coalesce(version,0),13),
    instructions='DAY 8 LIVE CLASS
0–8 min — Corrected Weld/HAZ/Base-Metal Retrieval Sheet: label A/B/C and complete Questions 1–3.
8–20 min — Model the thermal-cycle idea: the HAZ is unmelted base metal affected by welding heat. Save ferrite/austenite/pearlite/TTT detail for the formal shared Level II block after Day 22.
20–38 min — HAZ Observation Cards: OBSERVE → CHECK SOURCE → STATE ONLY WHAT THE EVIDENCE SUPPORTS; complete Questions 4–6.
38–52 min — Heat-Effect Cause/Consequence Map: restraint, thermal conductivity, and heat input/sequence; complete Questions 7–9.
52–60 min — Complete Questions 10–12 independently as the HAZ Exit.
Do not claim exact hardness, microstructure, exact cause, grade/alloy, or procedure/acceptance value from appearance or a general heat-effect concept alone.',
    reference_body='Prerequisite metallurgy readiness only. The corrected cross-section shows weld metal, the fusion boundary, the HAZ within unmelted base metal, and unaffected base metal. Observation is not proof of exact hardness, microstructure, cause, grade/alloy, or required welding response. Use authorized material/source information, approved WPS/procedure, testing, geometry/thickness, restraint, and governing requirements as applicable.'
where slug='wld205_pvhs_bridge_day8';
