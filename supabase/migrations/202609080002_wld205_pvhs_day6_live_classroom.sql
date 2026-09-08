-- Stage WLD 205 PVHS Level II A Day 6 as a Live Classroom-first lesson.
-- Additive instructional implementation only. Approved curriculum text and
-- protected course outcomes are not altered.
-- Intended release: PVHS Level II A Days 1-10 bundled deployment.

insert into public.assessment_modules(
  slug,
  title,
  description,
  category,
  estimated_minutes,
  sort_order,
  version,
  active,
  instructions,
  allow_team_members
)
values(
  'wld205_pvhs_bridge_day6',
  'WLD 205 Day 6 - Metal Properties & Material Behavior',
  'PVHS Bridge Metallurgy Readiness I: property vocabulary, controlled material comparison, welding/fabrication consequences, evidence boundaries, and prerequisite exit check.',
  'PVHS Level II Bridge',
  48,
  60,
  1,
  true,
  'Use this activity with WLD 205 PVHS Bridge Day 6. Work only when the instructor tells you to continue.\n\nQuestions 1-6: property vocabulary retrieval (0-8 min). STOP after Question 6 for the instructor whiteboard model.\nQuestions 7-14: Property Comparison Matrix using Reference Set A (20-38 min).\nQuestions 15-18: material-behavior scenarios (38-52 min).\nQuestions 19-22: Metallurgy Vocabulary Exit (52-60 min).\n\nREFERENCE SET A - bridge-level comparison only:\n• Common low-carbon steel: use as the baseline for comparison.\n• Common austenitic stainless steel: generally lower thermal conductivity and higher thermal expansion than low-carbon steel.\n• Common aluminum alloys: generally much lower density, higher thermal conductivity, and higher thermal expansion than low-carbon steel.\n• Strength, hardness, toughness, ductility, corrosion behavior, and magnetic response can vary substantially with exact alloy/grade, product form, processing, and condition. Do not rank or identify those properties from the family name alone unless a controlling source provides the needed detail.\n\nThis Reference Set is for prerequisite vocabulary and comparison practice. It is not a WPS, engineering specification, material test report, or substitute for the controlling material source. If the evidence is insufficient, record the limitation instead of guessing.',
  false
)
on conflict(slug) do update set
  title=excluded.title,
  description=excluded.description,
  category=excluded.category,
  estimated_minutes=excluded.estimated_minutes,
  sort_order=excluded.sort_order,
  version=excluded.version,
  active=excluded.active,
  instructions=excluded.instructions,
  allow_team_members=excluded.allow_team_members;

-- Keep the Day 6 question set exact and repeatable if the bundle is rebuilt.
delete from public.assessment_questions
where assessment_slug='wld205_pvhs_bridge_day6';

insert into public.assessment_questions(
  assessment_slug,
  question_key,
  question_number,
  question_type,
  question_text,
  domain,
  options,
  correct_answer,
  accepted_answers,
  explanation
)
values
-- 0-8 min: property vocabulary retrieval
('wld205_pvhs_bridge_day6','d6q01',1,'mc','Which property describes resistance to indentation, scratching, or localized surface deformation?','Property Vocabulary','{"A":"Hardness","B":"Toughness","C":"Ductility","D":"Conductivity"}'::jsonb,'A',null,'Hardness describes resistance to localized plastic deformation such as indentation or scratching.'),
('wld205_pvhs_bridge_day6','d6q02',2,'mc','Which property describes a material''s ability to resist an applied load without failing or permanently deforming beyond the specified limit?','Property Vocabulary','{"A":"Strength","B":"Brittleness","C":"Conductivity","D":"Hardness"}'::jsonb,'A',null,'Strength refers to resistance to applied stress or load. The exact meaning depends on whether yield, tensile, shear, or another strength value is being discussed.'),
('wld205_pvhs_bridge_day6','d6q03',3,'mc','Which property describes the ability to absorb energy and plastically deform before fracturing?','Property Vocabulary','{"A":"Hardness","B":"Toughness","C":"Conductivity","D":"Brittleness"}'::jsonb,'B',null,'Toughness is the ability to absorb energy before fracture; it is not the same property as strength or hardness.'),
('wld205_pvhs_bridge_day6','d6q04',4,'mc','Which property describes the ability to plastically deform, such as elongating or bending, before fracture?','Property Vocabulary','{"A":"Ductility","B":"Hardness","C":"Brittleness","D":"Conductivity"}'::jsonb,'A',null,'Ductility describes the ability to undergo plastic deformation before fracture.'),
('wld205_pvhs_bridge_day6','d6q05',5,'mc','Which term describes a tendency to fracture with little plastic deformation?','Property Vocabulary','{"A":"Toughness","B":"Ductility","C":"Brittleness","D":"Strength"}'::jsonb,'C',null,'Brittleness describes fracture with little preceding plastic deformation.'),
('wld205_pvhs_bridge_day6','d6q06',6,'mc','In this welding bridge lesson, thermal conductivity refers to a material''s ability to:','Property Vocabulary','{"A":"Transfer heat through the material","B":"Resist indentation","C":"Stretch before fracture","D":"Resist every type of corrosion"}'::jsonb,'A',null,'Thermal conductivity describes how readily heat moves through a material.'),

-- 20-38 min: controlled Property Comparison Matrix using Reference Set A
('wld205_pvhs_bridge_day6','d6q07',7,'mc','Using Reference Set A, which material family is generally the highest thermal conductor of the three listed?','Material Comparison','{"A":"Common low-carbon steel","B":"Common austenitic stainless steel","C":"Common aluminum alloys","D":"The reference does not compare thermal conductivity"}'::jsonb,'C',null,'Reference Set A states that common aluminum alloys generally have higher thermal conductivity than low-carbon steel, while common austenitic stainless is generally lower.'),
('wld205_pvhs_bridge_day6','d6q08',8,'mc','Using Reference Set A, which material family is generally lower in thermal conductivity than common low-carbon steel?','Material Comparison','{"A":"Common austenitic stainless steel","B":"Common aluminum alloys","C":"Both are always identical to carbon steel","D":"Neither can ever differ"}'::jsonb,'A',null,'Reference Set A identifies common austenitic stainless steel as generally lower in thermal conductivity than common low-carbon steel.'),
('wld205_pvhs_bridge_day6','d6q09',9,'mc','Using Reference Set A, which material family is generally much lower in density than the other two?','Material Comparison','{"A":"Common low-carbon steel","B":"Common austenitic stainless steel","C":"Common aluminum alloys","D":"All three have essentially the same density"}'::jsonb,'C',null,'Reference Set A identifies common aluminum alloys as much lower in density.'),
('wld205_pvhs_bridge_day6','d6q10',10,'mc','Compared with common low-carbon steel, Reference Set A describes common austenitic stainless steel as generally having:','Material Comparison','{"A":"Lower thermal conductivity and higher thermal expansion","B":"Higher thermal conductivity and lower thermal expansion","C":"Identical thermal behavior in all conditions","D":"No measurable thermal expansion"}'::jsonb,'A',null,'The controlled reference states lower thermal conductivity and higher thermal expansion for common austenitic stainless compared with low-carbon steel.'),
('wld205_pvhs_bridge_day6','d6q11',11,'mc','Using Reference Set A, may you rank carbon steel, stainless steel, and aluminum from hardest to softest using only those family names?','Evidence Boundaries','{"A":"Yes, family name is enough","B":"No, hardness depends on the exact alloy/grade and condition","C":"Yes, if the pieces look the same size","D":"Yes, if one sample is magnetic"}'::jsonb,'B',null,'The reference explicitly says hardness is grade- and condition-dependent and should not be ranked from family name alone.'),
('wld205_pvhs_bridge_day6','d6q12',12,'mc','Using Reference Set A, may you rank the three material families from toughest to least tough without more information?','Evidence Boundaries','{"A":"Yes, appearance is enough","B":"Yes, density determines toughness","C":"No, toughness depends on the exact material and condition","D":"Yes, conductivity determines toughness"}'::jsonb,'C',null,'Toughness is not safely ranked from a broad material family name alone.'),
('wld205_pvhs_bridge_day6','d6q13',13,'mc','A sample is magnetic. Can that observation by itself identify its exact alloy or grade?','Evidence Boundaries','{"A":"Yes, magnetism uniquely identifies every grade","B":"No, magnetic response alone is insufficient to identify an exact grade","C":"Yes, if the sample is shiny","D":"Yes, if the sample was welded"}'::jsonb,'B',null,'Magnetic response can vary with alloy and condition and is not enough by itself to identify an exact grade.'),
('wld205_pvhs_bridge_day6','d6q14',14,'mc','Which property most directly explains why heat can spread rapidly away from a weld area in a highly heat-conductive material?','Property Consequences','{"A":"Thermal conductivity","B":"Brittleness","C":"Ductility","D":"Hardness"}'::jsonb,'A',null,'Thermal conductivity directly describes the rate at which heat is conducted through the material.'),

-- 38-52 min: material-behavior scenarios and evidence boundaries
('wld205_pvhs_bridge_day6','d6q15',15,'mc','Scenario 1: A weld cracks after cooling. Is the observation alone enough to conclude that the base metal was brittle?','Material Behavior Scenarios','{"A":"Yes, any crack proves base-metal brittleness","B":"No, a crack is evidence of a problem but does not by itself prove the material property or root cause","C":"Yes, if the crack is visible","D":"No, because metals cannot be brittle"}'::jsonb,'B',null,'Cracking can have multiple causes. The observation should be recorded, but the material property or root cause requires additional evidence.'),
('wld205_pvhs_bridge_day6','d6q16',16,'mc','Scenario 2: Two coupons bend different amounts before fracture. Can that observation alone identify each coupon''s exact alloy and heat-treatment condition?','Material Behavior Scenarios','{"A":"Yes, bend amount uniquely identifies both","B":"No, the behavior can be compared but exact identity requires controlling material information or testing","C":"Yes, if one coupon is thicker","D":"Yes, if both were welded by the same person"}'::jsonb,'B',null,'Observed behavior can support a comparison, but exact alloy and condition cannot be inferred uniquely from one bend observation.'),
('wld205_pvhs_bridge_day6','d6q17',17,'mc','Scenario 3: During welding, heat appears to spread quickly away from an aluminum work area. Which Reference Set A property is consistent with that observation?','Material Behavior Scenarios','{"A":"Higher thermal conductivity","B":"Higher brittleness","C":"Higher hardness","D":"Lower density alone"}'::jsonb,'A',null,'Reference Set A identifies common aluminum alloys as relatively high in thermal conductivity.'),
('wld205_pvhs_bridge_day6','d6q18',18,'mc','Scenario 4: A stainless assembly shows more distortion than expected. Reference Set A says common austenitic stainless has higher thermal expansion than low-carbon steel. What is the strongest conclusion from the available evidence?','Material Behavior Scenarios','{"A":"The distortion is consistent with the stated thermal-expansion difference, but the exact cause still requires the job variables and controlling evidence","B":"The exact alloy and microstructure are now proven","C":"The welder definitely used the wrong process","D":"Thermal expansion is the only possible cause of distortion"}'::jsonb,'A',null,'The observation is consistent with the bridge-level reference, but it does not prove a unique cause or exact metallurgy.'),

-- 52-60 min: independent prerequisite exit
('wld205_pvhs_bridge_day6','d6q19',19,'mc','Exit check: A metal resists indentation but may still fracture under impact. Which statement is correct?','Metallurgy Vocabulary Exit','{"A":"Hardness and toughness are different properties","B":"Hardness automatically guarantees toughness","C":"Toughness and conductivity mean the same thing","D":"Brittleness always increases ductility"}'::jsonb,'A',null,'A material can be hard without being especially tough; the terms describe different behaviors.'),
('wld205_pvhs_bridge_day6','d6q20',20,'mc','Exit check: A coupon stretches and permanently changes shape before it breaks. Which property is most directly demonstrated?','Metallurgy Vocabulary Exit','{"A":"Ductility","B":"Conductivity","C":"Hardness","D":"Density"}'::jsonb,'A',null,'Plastic deformation before fracture is evidence of ductility.'),
('wld205_pvhs_bridge_day6','d6q21',21,'mc','Exit check: A material fractures with very little visible plastic deformation. Which term best describes that behavior?','Metallurgy Vocabulary Exit','{"A":"Ductile","B":"Brittle","C":"Highly conductive","D":"Hard by definition"}'::jsonb,'B',null,'Fracture with little plastic deformation is brittle behavior.'),
('wld205_pvhs_bridge_day6','d6q22',22,'mc','Exit check: The available evidence does not support a claim about exact grade, hardness, or toughness. What should the student record?','Metallurgy Vocabulary Exit','{"A":"A best guess so the worksheet is complete","B":"The unsupported claim as fact","C":"That the conclusion is not supported and the controlling source or additional evidence is needed","D":"Nothing, because missing evidence never matters"}'::jsonb,'C',null,'Day 6 specifically trains students to identify unsupported material/property claims rather than guess.' );

-- Update only the active WLD 205 guide Day 6 implementation language.
-- Protected outcome links and course curriculum remain untouched.
with target_day as (
  select d.id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id and g.course_id=d.course_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.status='active'
    and d.planner_day_number=6
)
update public.course_guide_days d
set
  materials_equipment='Whiteboard; student devices with browser access; Live Classroom Day 6 activity; material samples/photos where available for instructor demonstration only.',
  assessment='Live Classroom Day 6 activity: auto-scored property vocabulary retrieval, controlled Property Comparison Matrix, four material-behavior evidence scenarios, and Metallurgy Vocabulary Exit.',
  evidence_check_for_understanding='Live Classroom domain scores for property vocabulary, material comparison, property consequences, evidence boundaries, material-behavior scenarios, and the exit check. Unsupported material/property claims must be identified rather than guessed.',
  record_link_expectation='Retain the Live Classroom Day 6 submission/domain scores and record only the remaining prerequisite term or evidence-boundary gap. Link later WLD-210 observations only when they actually occur; never backfill evidence.',
  updated_at=now()
from target_day t
where d.id=t.id;

-- Make the five Day 6 agenda rows truthful for a whiteboard + student-device classroom.
with target_day as (
  select d.id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id and g.course_id=d.course_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.status='active'
    and d.planner_day_number=6
)
update public.course_guide_day_segments s
set
  instructor_actions=case s.sequence_number
    when 1 then 'Launch the Day 6 Live Classroom activity. Students complete Questions 1-6 to sort hardness, strength, toughness, ductility, brittleness, and thermal conductivity, then stop for the whiteboard model.'
    when 2 then 'Use the whiteboard to explain each property through a welding/fabrication consequence. Keep the lesson at prerequisite vocabulary/behavior level; do not begin the formal Level II iron-carbon or transformation lesson.'
    when 3 then 'Resume Live Classroom Questions 7-14. Students complete the Property Comparison Matrix using only Reference Set A. Emphasize which comparisons are supported and which grade/condition-dependent claims cannot be made.'
    when 4 then 'Continue Live Classroom Questions 15-18. Students work through four material-behavior scenarios and distinguish an observation, a supported comparison, and an unsupported metallurgical conclusion.'
    when 5 then 'Students complete Live Classroom Questions 19-22 independently. Review domain-level results and record only the remaining prerequisite vocabulary or evidence-boundary gap.'
    else s.instructor_actions
  end,
  student_actions=case s.sequence_number
    when 1 then 'Complete Live Classroom Questions 1-6 and stop after Question 6.'
    when 2 then 'Follow the whiteboard property/consequence model and distinguish hardness, strength, toughness, ductility, brittleness, and conductivity before resuming.'
    when 3 then 'Complete Live Classroom Questions 7-14 using only Reference Set A. Do not add unsupported rankings or material claims.'
    when 4 then 'Complete Live Classroom Questions 15-18 and identify what the available evidence supports and what remains unknown.'
    when 5 then 'Complete Live Classroom Questions 19-22 independently.'
    else s.student_actions
  end,
  updated_at=now()
from target_day t
where s.guide_day_id=t.id
  and s.sequence_number between 1 and 5;

-- Replace any prior staged Day 6 launcher with one locked planner-day Live Classroom resource.
with target_day as (
  select d.id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id and g.course_id=d.course_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.status='active'
    and d.planner_day_number=6
)
delete from public.course_guide_day_resources r
using target_day t
where r.guide_day_id=t.id
  and r.resource_url='/classroom/planner?assessment=wld205_pvhs_bridge_day6';

with target_day as (
  select d.id, d.school_id, d.course_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id and g.course_id=d.course_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.status='active'
    and d.planner_day_number=6
)
insert into public.course_guide_day_resources(
  school_id,
  course_id,
  guide_day_id,
  sequence_number,
  resource_type,
  resource_title,
  resource_url,
  resource_notes,
  required,
  integration_mode,
  rights_basis,
  student_safe,
  updated_at
)
select
  t.school_id,
  t.course_id,
  t.id,
  1,
  'other',
  'Launch Live Classroom - Day 6 Metal Properties & Material Behavior',
  '/classroom/planner?assessment=wld205_pvhs_bridge_day6',
  'Primary Day 6 student activity. Students use devices for property retrieval, the controlled comparison matrix, four evidence-boundary scenarios, and the independent exit. Instructor uses the whiteboard for the 8-20 minute property/consequence model.',
  true,
  'native',
  'school_owned',
  true,
  now()
from target_day t;