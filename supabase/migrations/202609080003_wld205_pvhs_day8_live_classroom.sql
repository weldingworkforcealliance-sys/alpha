-- Stage WLD 205 PVHS Level II A Day 8 as a Live Classroom-first lesson.
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
  'wld205_pvhs_bridge_day8',
  'WLD 205 Day 8 - Heat, HAZ & Observable Change',
  'PVHS Bridge Metallurgy Readiness II: weld metal, heat-affected zone, base metal, thermal-cycle reasoning, observable heat effects, evidence boundaries, and distortion/property concerns.',
  'PVHS Level II Bridge',
  48,
  80,
  1,
  true,
  'Use this activity with WLD 205 PVHS Bridge Day 8. Work only when the instructor tells you to continue.\n\nQuestions 1-6: weld metal / HAZ / base-metal retrieval (0-8 min). STOP after Question 6 for the instructor whiteboard model.\nQuestions 7-14: HAZ Observation Cards (20-38 min).\nQuestions 15-18: heat-effect cause/consequence map (38-52 min).\nQuestions 19-22: HAZ Exit (52-60 min).\n\nREFERENCE SET B - bridge-level concepts only:\n• Weld metal is the portion of the joint that was melted during welding and then solidified.\n• The heat-affected zone (HAZ) is base metal next to the weld that was not melted but was affected by the welding thermal cycle.\n• Base metal outside the HAZ is the parent material not classified as weld metal or HAZ in the simplified cross-section.\n• Welding creates localized heating and cooling. Observable effects can include heat tint/oxidation, dimensional change, and distortion, but appearance alone does not prove exact microstructure, hardness, toughness, strength, or alloy grade.\n• The visible color/oxide boundary is not automatically the exact HAZ boundary. The metallurgical HAZ may require an authorized source, examination, or testing to establish.\n• Heat input, cooling condition, joint geometry, material, restraint, and welding sequence can influence heat effects and distortion. Do not infer a unique metallurgical cause from one observation alone.\n\nThis is prerequisite readiness. Do not introduce ferrite/austenite/pearlite, TTT/CCT diagrams, transformation temperatures, or formal Level II transformation detail during this bridge lesson.',
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

-- Keep the Day 8 question set exact and repeatable if the bundle is rebuilt.
delete from public.assessment_questions
where assessment_slug='wld205_pvhs_bridge_day8';

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
-- 0-8 min: weld / HAZ / base-metal retrieval
('wld205_pvhs_bridge_day8','d8q01',1,'mc','Simplified cross-section: BASE METAL | HAZ | WELD METAL | HAZ | BASE METAL. Which region was melted during welding and then solidified?','Zone Identification','{"A":"Weld metal","B":"HAZ","C":"Base metal outside the HAZ","D":"All regions were melted"}'::jsonb,'A',null,'Weld metal is the portion that melted during welding and then solidified.'),
('wld205_pvhs_bridge_day8','d8q02',2,'mc','In the simplified cross-section, which region is base metal that was heated by welding but did not melt?','Zone Identification','{"A":"Weld metal","B":"Heat-affected zone (HAZ)","C":"Base metal outside the HAZ","D":"Filler storage area"}'::jsonb,'B',null,'The HAZ is base metal affected by the welding thermal cycle without melting.'),
('wld205_pvhs_bridge_day8','d8q03',3,'mc','In the simplified cross-section, what is the material beyond the HAZ called?','Zone Identification','{"A":"Weld metal","B":"Slag","C":"Base metal","D":"Arc zone"}'::jsonb,'C',null,'The parent material outside the simplified HAZ is base metal.'),
('wld205_pvhs_bridge_day8','d8q04',4,'mc','Which statement correctly separates weld metal from the HAZ?','Zone Identification','{"A":"Both must have melted","B":"Weld metal melted; the HAZ did not melt","C":"The HAZ melted but weld metal did not","D":"Neither experienced heat"}'::jsonb,'B',null,'The key bridge-level distinction is melting: weld metal melted, while the HAZ was thermally affected without melting.'),
('wld205_pvhs_bridge_day8','d8q05',5,'mc','Can the HAZ change even though it did not melt?','Thermal Cycle','{"A":"Yes, the welding thermal cycle can change base-metal properties or structure without melting","B":"No, metal can change only after melting","C":"No, the HAZ is always identical to untouched base metal","D":"Only if the weld metal is removed"}'::jsonb,'A',null,'Heating and cooling can affect the adjacent base metal without melting it.'),
('wld205_pvhs_bridge_day8','d8q06',6,'mc','What is a welding thermal cycle in this bridge lesson?','Thermal Cycle','{"A":"Localized heating followed by cooling during and after welding","B":"A payroll schedule","C":"A list of electrode diameters","D":"A method for identifying exact alloy grade by color"}'::jsonb,'A',null,'For this prerequisite lesson, thermal cycle means the localized heating and cooling produced by welding.'),

-- 20-38 min: HAZ Observation Cards
('wld205_pvhs_bridge_day8','d8q07',7,'mc','Observation Card 1: A colored oxide/heat-tint band is visible beside a weld. What can you safely record from appearance alone?','HAZ Observation','{"A":"A visible heat/oxide color change exists beside the weld","B":"The exact HAZ boundary is proven","C":"The exact hardness is known","D":"The exact microstructure is known"}'::jsonb,'A',null,'Appearance supports an observation about visible color/oxide change, not an exact metallurgical boundary or property value.'),
('wld205_pvhs_bridge_day8','d8q08',8,'mc','Observation Card 2: The visible heat-tint band ends 1/4 in. from the weld. What is the strongest conclusion?','Evidence Boundaries','{"A":"The metallurgical HAZ ends exactly at 1/4 in.","B":"The visible color change ends at about 1/4 in.; the exact HAZ boundary is not established by color alone","C":"The material is exactly 1/4 in. hard","D":"The alloy grade is confirmed"}'::jsonb,'B',null,'The visible oxide/color boundary is not automatically the exact HAZ boundary.'),
('wld205_pvhs_bridge_day8','d8q09',9,'mc','Observation Card 3: A welded coupon is visibly bowed after cooling. What is directly observable?','HAZ Observation','{"A":"Distortion occurred","B":"The exact residual stress is known","C":"The exact microstructure is known","D":"The base metal is proven brittle"}'::jsonb,'A',null,'The dimensional change/distortion is observable; the exact underlying property or stress state is not established by appearance alone.'),
('wld205_pvhs_bridge_day8','d8q10',10,'mc','Observation Card 4: No obvious heat tint is visible next to a weld. Which statement is best?','Evidence Boundaries','{"A":"There is definitely no HAZ","B":"A HAZ can exist even when its boundary is not obvious by visual appearance","C":"The weld was never heated","D":"The base metal did not experience a thermal cycle"}'::jsonb,'B',null,'The HAZ is a metallurgical region and may not have a clearly visible boundary.'),
('wld205_pvhs_bridge_day8','d8q11',11,'mc','Observation Card 5: A surface beside the weld looks darker and oxidized. Does that appearance prove the exact hardness of the HAZ?','Evidence Boundaries','{"A":"Yes","B":"No"}'::jsonb,'B',null,'Surface appearance does not provide a quantitative hardness value.'),
('wld205_pvhs_bridge_day8','d8q12',12,'mc','Observation Card 6: A coupon cracked after welding. Does the crack alone prove the HAZ became brittle?','Evidence Boundaries','{"A":"Yes, any crack proves brittleness","B":"No, the crack is evidence of a problem but does not by itself establish the exact cause or property change","C":"Yes, if the crack is beside the weld","D":"No, because cracks cannot occur near a HAZ"}'::jsonb,'B',null,'Cracking can have multiple causes. The observation should be recorded without claiming an unsupported mechanism.'),
('wld205_pvhs_bridge_day8','d8q13',13,'mc','Observation Card 7: Which statement is an observation rather than an unsupported metallurgical conclusion?','Observation vs Conclusion','{"A":"The coupon moved out of square after welding","B":"The HAZ transformed to a specific microstructure","C":"The exact toughness dropped by 20 percent","D":"The exact alloy grade changed"}'::jsonb,'A',null,'Out-of-square distortion can be observed directly. The other claims require evidence not provided by appearance alone.'),
('wld205_pvhs_bridge_day8','d8q14',14,'mc','Observation Card 8: What should a student do when the visible evidence does not support an exact metallurgy claim?','Evidence Boundaries','{"A":"Guess the most likely answer","B":"State the observation and identify what additional source, examination, or testing would be needed","C":"Copy another student''s conclusion","D":"Treat color as proof of microstructure"}'::jsonb,'B',null,'Day 8 requires students to separate observation from unsupported conclusion.'),

-- 38-52 min: heat-effect cause / consequence map
('wld205_pvhs_bridge_day8','d8q15',15,'mc','Cause/Consequence Map: Increasing the amount of welding heat delivered to a joint can reasonably increase which concern, all else equal?','Heat-Effect Map','{"A":"Thermal exposure and possible distortion","B":"Certainty about exact alloy grade","C":"The number of dimensions on the print","D":"Guaranteed elimination of the HAZ"}'::jsonb,'A',null,'More thermal energy can increase thermal exposure and distortion concern, although the exact result still depends on material, geometry, process, sequence, and other variables.'),
('wld205_pvhs_bridge_day8','d8q16',16,'mc','Cause/Consequence Map: What is the safest statement about restraint during welding?','Heat-Effect Map','{"A":"Restraint can influence movement/distortion and stress, so its effect must be evaluated with the joint and procedure","B":"More restraint always eliminates every welding problem","C":"Restraint proves the material is brittle","D":"Restraint has no relationship to distortion"}'::jsonb,'A',null,'Restraint changes how the joint can move during heating, cooling, and shrinkage. It should not be treated as a universal cure.'),
('wld205_pvhs_bridge_day8','d8q17',17,'mc','Cause/Consequence Map: Why is cooling condition included in the map?','Heat-Effect Map','{"A":"Heating and cooling history can affect the HAZ, but the exact property or structure change depends on the material and conditions","B":"Cooling condition identifies exact alloy grade by itself","C":"Cooling has no effect after welding","D":"Cooling condition controls only weld color"}'::jsonb,'A',null,'The thermal history includes cooling. This bridge lesson stops before formal transformation/microstructure analysis.'),
('wld205_pvhs_bridge_day8','d8q18',18,'mc','Cause/Consequence Map: A long welded assembly pulls out of square after cooling. Which statement is strongest?','Heat-Effect Map','{"A":"Nonuniform heating/cooling and weld shrinkage can contribute to distortion; sequence, restraint, heat input, geometry, and fit-up should be reviewed","B":"The exact HAZ hardness caused it","C":"The exact alloy is now known","D":"Distortion proves the weld metal was too soft"}'::jsonb,'A',null,'Distortion is a geometric result influenced by multiple thermal and fabrication variables; it does not prove one exact metallurgical cause.'),

-- 52-60 min: HAZ Exit
('wld205_pvhs_bridge_day8','d8q19',19,'mc','HAZ Exit: Which region is base metal affected by welding heat without melting?','HAZ Exit','{"A":"Weld metal","B":"HAZ","C":"Filler wire","D":"Slag"}'::jsonb,'B',null,'The HAZ is thermally affected base metal that did not melt.'),
('wld205_pvhs_bridge_day8','d8q20',20,'mc','HAZ Exit: Which region was melted and solidified as part of the weld?','HAZ Exit','{"A":"Weld metal","B":"HAZ","C":"Base metal outside the HAZ","D":"Heat tint only"}'::jsonb,'A',null,'Weld metal is the fused/solidified portion of the joint.'),
('wld205_pvhs_bridge_day8','d8q21',21,'mc','HAZ Exit: A visible color boundary beside a weld should be treated as:','HAZ Exit','{"A":"Proof of the exact metallurgical HAZ boundary","B":"An observable surface indication that may relate to heating, but not automatic proof of the exact HAZ boundary","C":"Proof of exact hardness","D":"Proof of exact alloy chemistry"}'::jsonb,'B',null,'Visible heat tint/oxide can be recorded, but the exact metallurgical boundary requires stronger evidence.'),
('wld205_pvhs_bridge_day8','d8q22',22,'mc','HAZ Exit: Which statement best matches the Day 8 evidence rule?','HAZ Exit','{"A":"Record what is observed, use the controlling source, and do not claim exact property or microstructure changes without supporting evidence","B":"Guess the metallurgy from appearance","C":"Assume all HAZs behave the same","D":"Skip observations and record only conclusions"}'::jsonb,'A',null,'The bridge lesson trains evidence-based observation while reserving formal transformation detail for the later Level II metallurgy block.' );

-- Update only the active WLD 205 guide Day 8 implementation language.
-- Protected outcome links and approved course curriculum remain untouched.
with target_day as (
  select d.id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id and g.course_id=d.course_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.status='active'
    and d.planner_day_number=8
)
update public.course_guide_days d
set
  materials_equipment='Whiteboard; student devices with browser access; Live Classroom Day 8 activity; material samples/coupons/photos where available for instructor observation only.',
  assessment='Live Classroom Day 8 activity: auto-scored weld/HAZ/base-metal retrieval, HAZ Observation Cards, heat-effect cause/consequence map, and HAZ Exit.',
  evidence_check_for_understanding='Live Classroom domain scores for zone identification, thermal-cycle readiness, HAZ observation, observation-versus-conclusion, evidence boundaries, heat-effect mapping, and the HAZ Exit. Students must separate direct observations from unsupported metallurgy claims.',
  record_link_expectation='Retain the Live Classroom Day 8 submission/domain scores and record only the remaining prerequisite zone-identification, thermal-cycle, observation, or evidence-boundary gap. Link later WLD-210 Day 8 observations only when they actually occur; never backfill evidence.',
  updated_at=now()
from target_day t
where d.id=t.id;

-- Make the five Day 8 agenda rows truthful for a whiteboard + student-device classroom.
with target_day as (
  select d.id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id and g.course_id=d.course_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.status='active'
    and d.planner_day_number=8
)
update public.course_guide_day_segments s
set
  instructor_actions=case s.sequence_number
    when 1 then 'Launch the Day 8 Live Classroom activity. Students complete Questions 1-6 to identify weld metal, HAZ, and base metal, then stop for the whiteboard model.'
    when 2 then 'Use the whiteboard to draw a simplified weld cross-section and explain the welding thermal cycle. Emphasize that the HAZ can change without melting. Do not introduce ferrite/austenite/pearlite, TTT/CCT, transformation temperatures, or the formal Level II transformation lesson.'
    when 3 then 'Resume Live Classroom Questions 7-14. Students complete the HAZ Observation Cards and separate direct visual/dimensional observations from unsupported claims about exact HAZ boundary, hardness, toughness, microstructure, or alloy grade.'
    when 4 then 'Continue Live Classroom Questions 15-18. Students complete the heat-effect cause/consequence map using heat input, restraint, cooling condition, and possible property/distortion concerns without claiming a unique metallurgical cause.'
    when 5 then 'Students complete Live Classroom Questions 19-22 independently. Review domain-level results and record only the remaining prerequisite HAZ/observation/evidence gap.'
    else s.instructor_actions
  end,
  student_actions=case s.sequence_number
    when 1 then 'Complete Live Classroom Questions 1-6 and stop after Question 6.'
    when 2 then 'Follow the whiteboard cross-section and thermal-cycle model. Be able to distinguish weld metal, HAZ, and base metal before resuming.'
    when 3 then 'Complete Live Classroom Questions 7-14. Record what the evidence actually shows and reject unsupported metallurgy claims.'
    when 4 then 'Complete Live Classroom Questions 15-18. Use the listed fabrication/thermal variables to identify possible concerns without claiming a single proven cause.'
    when 5 then 'Complete Live Classroom Questions 19-22 independently.'
    else s.student_actions
  end,
  updated_at=now()
from target_day t
where s.guide_day_id=t.id
  and s.sequence_number between 1 and 5;

-- Replace any prior staged Day 8 launcher with one locked planner-day Live Classroom resource.
with target_day as (
  select d.id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id and g.course_id=d.course_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.status='active'
    and d.planner_day_number=8
)
delete from public.course_guide_day_resources r
using target_day t
where r.guide_day_id=t.id
  and r.resource_url='/classroom/planner?assessment=wld205_pvhs_bridge_day8';

with target_day as (
  select d.id, d.school_id, d.course_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id and g.course_id=d.course_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.status='active'
    and d.planner_day_number=8
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
  'Launch Live Classroom - Day 8 Heat, HAZ & Observable Change',
  '/classroom/planner?assessment=wld205_pvhs_bridge_day8',
  'Primary Day 8 student activity. Students use devices for zone retrieval, HAZ Observation Cards, heat-effect cause/consequence mapping, and the HAZ Exit. Instructor uses the whiteboard for the 8-20 minute cross-section/thermal-cycle model.',
  true,
  'native',
  'school_owned',
  true,
  now()
from target_day t;