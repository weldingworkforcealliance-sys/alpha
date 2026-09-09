-- WLD 205 PVHS Day 6 instructor-support/resource pack.
-- Original PCCC/LTG bridge content only. Authorized material references remain controlling.
-- No formal Level II iron-carbon/transformation content or invented procedure values are added here.

with target as (
  select d.id as guide_day_id, d.school_id, d.course_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active'
    and d.planner_day_number=6
  order by g.updated_at desc
  limit 1
)
update public.course_guide_days d
set
  instructor_prep='BEFORE CLASS: Open/print the Day 6 Property Cards, Property Comparison Matrix, Material-Behavior Scenarios, optional Material Observation Sheet, and Instructor Key. Stage the authorized material/source reference used by the program. If material samples/photos are used, label them for observation only; do not use appearance to identify exact grade/alloy/temper. Launch the Day 6 Live Class Activity before the warm-up.',
  opening_review='0–8 min — Material-Property Sort: Use the six Property Cards for hardness, strength, toughness, ductility, brittleness, and thermal conductivity. Students match term to definition, then complete Live Questions 1–6. Correct hardness-vs-toughness and ductility-vs-brittleness confusion before moving on.',
  demonstration='8–20 min — Property Meaning in Welding/Fabrication: Model one source-supported consequence or contrast for each property. Hardness = indentation/wear resistance, not toughness; toughness = energy absorption before fracture; ductility = plastic deformation before fracture; brittleness = little plastic deformation before fracture; thermal conductivity = heat conduction; keep strength at the source-pack baseline definition. Do NOT begin the formal iron-carbon/transformation sequence.',
  guided_practice='20–38 min — Property Comparison Matrix: Compare carbon steel, stainless steel, and aluminum using the authorized source and the provided matrix. Require one supported baseline statement for each material family and one statement that cannot safely be inferred. Students complete Live Questions 7–9. Samples/photos are observation aids only; exact grade/alloy/temper remains source-controlled.',
  independent_practice='38–52 min — Material-Behavior Scenarios: Work the four provided scenarios, then complete Live Questions 10–13. For every scenario require: property word → what the evidence supports → what cannot be concluded. Do not allow a property clue to become an invented grade, procedure value, or acceptance claim.',
  assessment='52–60 min — Metallurgy Vocabulary Exit: Students complete Live Questions 14–16 independently with no coaching. Review the full live result by domain: Property Vocabulary, Material Baseline/Source Control, or Material-Behavior Scenarios.',
  instructor_checks='Instructor Rule: OBSERVE → CHECK SOURCE → STATE ONLY WHAT THE SOURCE SUPPORTS. Record only the unresolved domain. For a gap, model one parallel example and require an immediate independent recheck. Do not repeat a domain already demonstrated successfully.',
  common_problems='Confusing hardness with toughness; confusing ductility with brittleness; treating a material-family baseline as an exact-grade claim; guessing grade/alloy/temper from appearance; or inferring welding procedure/acceptance values that are not present in the controlling source.',
  teaching_tips='Keep Day 6 at prerequisite-vocabulary level. Ask for the property word first, the controlling source second, and the supported conclusion third. Use samples/photos to make the discussion physical, but explicitly separate observation from documented material identification. Reduce prompting as the student demonstrates the domain.',
  materials_equipment='Day 6 Property Cards; Property Comparison Matrix; Material-Behavior Scenarios; optional Material Observation Sheet; Day 6 Instructor Key / Delivery Guide; authorized material/source references supplied by instructor; labeled material samples/photos where available.',
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
    and d.planner_day_number=6
  order by g.updated_at desc
  limit 1
)
update public.course_guide_day_segments s
set
  instructor_actions=case s.sequence_number
    when 1 then 'Use the six Property Cards. Students match hardness, strength, toughness, ductility, brittleness, and thermal conductivity to the provided definitions, then answer Live Questions 1–6. Correct term-pair confusion immediately.'
    when 2 then 'Model one consequence/contrast per property using only the Day 6 source-pack definitions and scenarios. Keep the lesson at prerequisite vocabulary level; do not begin formal transformation metallurgy or make grade-specific claims without source support.'
    when 3 then 'Use the Property Comparison Matrix plus the authorized source. Require one supported baseline statement and one cannot-infer statement for carbon steel, stainless steel, and aluminum. Then complete Live Questions 7–9.'
    when 4 then 'Use the four Material-Behavior Scenarios. Require property → supported conclusion → cannot conclude. Then complete Live Questions 10–13. If samples/photos are used, observation does not equal grade identification.'
    when 5 then 'Run Live Questions 14–16 independently with no coaching. Review the full live result by domain and record only the unresolved prerequisite gap.'
    else s.instructor_actions end,
  student_actions=case s.sequence_number
    when 1 then 'Match all six property terms to their definitions and complete Live Questions 1–6.'
    when 2 then 'Explain each property in plain language and distinguish the commonly confused term pairs.'
    when 3 then 'Complete the comparison matrix from the authorized source and answer Live Questions 7–9 without guessing exact grade/alloy/temper.'
    when 4 then 'Complete all four scenarios using the response frame: property → supported conclusion → cannot conclude; answer Live Questions 10–13.'
    when 5 then 'Complete Live Questions 14–16 independently without instructor help.'
    else s.student_actions end,
  notes='2026-09-09 Day 6 instructor-support resource pack. Protected WLD 205 outcomes unchanged; authorized source documentation remains controlling.',
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
    and d.planner_day_number=6
  order by g.updated_at desc
  limit 1
)
delete from public.course_guide_day_resources r
using target t
where r.guide_day_id=t.guide_day_id
  and r.resource_title in (
    'Day 6 Property Cards',
    'Day 6 Property Comparison Matrix',
    'Day 6 Material-Behavior Scenarios',
    'Day 6 Material Observation Sheet',
    'Day 6 Instructor Key / Delivery Guide'
  );

with target as (
  select d.id as guide_day_id, d.school_id, d.course_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active'
    and d.planner_day_number=6
  order by g.updated_at desc
  limit 1
)
insert into public.course_guide_day_resources(
  school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,
  resource_notes,required,integration_mode,rights_basis,student_safe,license_notes
)
select t.school_id,t.course_id,t.guide_day_id,v.sequence_number,'other',v.resource_title,v.resource_url,
       v.resource_notes,v.required,'native','school_owned',v.student_safe,
       'Original PCCC/LTG prerequisite bridge content. Authorized material/source references remain separate controlling sources.'
from target t
cross join (values
  (1,'Day 6 Property Cards','/live-activities/wld205-day6-property-cards.svg','Six-card vocabulary/retrieval set matching Live Questions 1–6.',true,true),
  (2,'Day 6 Property Comparison Matrix','/live-activities/wld205-day6-property-comparison-matrix.svg','Carbon steel, stainless steel, and aluminum baseline comparison with explicit source-control/cannot-infer rules; supports Live Questions 7–9.',true,true),
  (3,'Day 6 Material-Behavior Scenarios','/live-activities/wld205-day6-material-behavior-scenarios.svg','Four source-pack scenarios with property, supported-conclusion, and cannot-conclude response frame; supports Live Questions 10–13.',true,true),
  (4,'Day 6 Material Observation Sheet','/live-activities/wld205-day6-material-observation-sheet.svg','Optional worksheet for instructor-provided material samples/photos. Separates observation from documented material identification.',false,true),
  (5,'Day 6 Instructor Key / Delivery Guide','/live-activities/wld205-day6-instructor-key.svg','Instructor-only timing, definitions, correction cues, live-question mapping, source-control rules, and focused-retry guidance.',true,false)
) as v(sequence_number,resource_title,resource_url,resource_notes,required,student_safe);

update public.assessment_modules
set version=greatest(coalesce(version,0),13),
    instructions='DAY 6 LIVE CLASS
0–8 min — Property Cards: sort/identify hardness, strength, toughness, ductility, brittleness, and thermal conductivity; complete Questions 1–6.
8–20 min — Instructor models one source-supported welding/fabrication consequence or contrast for each property. Do NOT begin the formal iron-carbon/transformation sequence.
20–38 min — Property Comparison Matrix: compare carbon steel, stainless steel, and aluminum from the authorized source; complete Questions 7–9. Exact grade/alloy/temper is source-controlled.
38–52 min — Four Material-Behavior Scenarios: property → supported conclusion → cannot conclude; complete Questions 10–13.
52–60 min — Complete Questions 14–16 independently as the exit check.
Day 6 rule: OBSERVE → CHECK SOURCE → STATE ONLY WHAT THE SOURCE SUPPORTS.',
    reference_body='Prerequisite vocabulary only, not formal Level II transformation metallurgy. Use samples/photos for observation, not exact material identification. Exact grade/alloy/temper and all procedure/acceptance values come from authorized source documentation.'
where slug='wld205_pvhs_bridge_day6';
