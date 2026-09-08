insert into public.assessment_modules(
  slug,title,description,category,estimated_minutes,sort_order,version,
  active,instructions,allow_team_members,
  reference_title,reference_image_url,reference_body,show_student_score
)
values(
  'wld205_pvhs_bridge_day8',
  'WLD 205 Day 8 — Heat, HAZ + Observable Change',
  'PVHS prerequisite metallurgy readiness: weld metal/HAZ/base metal, thermal-cycle observations, restraint, conductivity, and heat-effect reasoning.',
  'WLD 205 PVHS Bridge Live',
  60,
  208,
  12,
  true,
  'DAY 8 LIVE CLASS
0–8 min — Label weld metal / HAZ / base metal on the simplified cross-section.
8–20 min — Model the thermal-cycle idea: the HAZ can change even though it did not melt. Save ferrite/austenite/pearlite/TTT detail for the formal shared Level II block.
20–38 min — HAZ Observation Cards.
38–52 min — Heat-Effect Cause/Consequence Map.
52–60 min — HAZ Exit.
Do not claim exact hardness, exact cause, or exact material response from appearance alone.',
  false,
  'WLD 205 Day 8 — Live Whiteboard',
  '/live-activities/wld205-day8-haz-board.svg',
  'Observation is not proof of an exact cause/property. Use testing, material/source information, the approved WPS/procedure, geometry/thickness, restraint, and governing requirements as applicable.',
  true
)
on conflict(slug) do update set
  title=excluded.title,
  description=excluded.description,
  category=excluded.category,
  estimated_minutes=excluded.estimated_minutes,
  sort_order=excluded.sort_order,
  version=excluded.version,
  active=true,
  instructions=excluded.instructions,
  allow_team_members=excluded.allow_team_members,
  reference_title=excluded.reference_title,
  reference_image_url=excluded.reference_image_url,
  reference_body=excluded.reference_body,
  show_student_score=excluded.show_student_score;

delete from public.assessment_questions where assessment_slug='wld205_pvhs_bridge_day8';

insert into public.assessment_questions(
  assessment_slug,question_key,question_number,question_type,question_text,
  domain,options,correct_answer,accepted_answers,explanation
)
values
('wld205_pvhs_bridge_day8','d8q1',1,'mc','Cross-section label A is the center deposited/fused region. What is it?','Cross-Section','{"A":"Weld metal","B":"HAZ","C":"Base metal","D":"Oxide layer"}'::jsonb,'A',null,'The center deposited/fused region is weld metal.'),
('wld205_pvhs_bridge_day8','d8q2',2,'mc','Cross-section label B is adjacent, unmelted material affected by welding heat. What is it?','Cross-Section','{"A":"Heat-affected zone (HAZ)","B":"Weld metal","C":"Unaffected base metal","D":"Filler storage zone"}'::jsonb,'A',null,'The adjacent unmelted, heat-affected region is the HAZ.'),
('wld205_pvhs_bridge_day8','d8q3',3,'mc','Cross-section label C is material beyond the HAZ. What is it?','Cross-Section','{"A":"Base metal","B":"Weld metal","C":"HAZ","D":"Slag"}'::jsonb,'A',null,'Material beyond the HAZ is base metal.'),
('wld205_pvhs_bridge_day8','d8q4',4,'mc','A HAZ is visible near a weld. Can appearance alone tell the exact hardness?','Observation Cards','{"A":"No; appearance alone is insufficient","B":"Yes, always","C":"Only if the weld is carbon steel","D":"Only if the weld is stainless"}'::jsonb,'A',null,'Testing/source knowledge is required for exact hardness.'),
('wld205_pvhs_bridge_day8','d8q5',5,'mc','A highly restrained joint shows angular movement after welding. Which concerns should be evaluated?','Observation Cards','{"A":"Distortion/restraint/thermal-cycle concerns; exact cause/control requires evaluation","B":"Only filler color","C":"Only drawing scale","D":"No concern if the weld looks smooth"}'::jsonb,'A',null,'The source card identifies distortion/restraint/thermal-cycle concerns.'),
('wld205_pvhs_bridge_day8','d8q6',6,'mc','Same alloy, very different section thickness. Could cooling behavior differ?','Observation Cards','{"A":"Yes; geometry/thickness can influence thermal behavior","B":"No, never","C":"Only if the drawing is metric","D":"Only if the joint is a butt joint"}'::jsonb,'A',null,'Geometry/thickness can influence thermal behavior.'),
('wld205_pvhs_bridge_day8','d8q7',7,'mc','Higher restraint may increase which concerns, depending on material/joint/procedure?','Cause / Consequence','{"A":"Residual stress, distortion, and cracking concerns","B":"Only wire-feed speed","C":"Only paint color","D":"Only drawing scale"}'::jsonb,'A',null,'The source map links higher restraint to residual-stress/distortion/cracking concerns.'),
('wld205_pvhs_bridge_day8','d8q8',8,'mc','Higher thermal conductivity generally means:','Cause / Consequence','{"A":"Heat is carried away more rapidly; material-specific procedure implications must be checked","B":"The material cannot weld","C":"The HAZ always melts","D":"No procedure check is needed"}'::jsonb,'A',null,'The source map identifies faster heat movement and need for material-specific procedure checks.'),
('wld205_pvhs_bridge_day8','d8q9',9,'mc','Uncontrolled heat input/sequence can contribute to:','Cause / Consequence','{"A":"Distortion and HAZ/property concerns","B":"Only title-block errors","C":"Only joint naming errors","D":"No measurable effect"}'::jsonb,'A',null,'The source map links uncontrolled heat input/sequence to distortion and HAZ/property concerns.'),
('wld205_pvhs_bridge_day8','d8q10',10,'mc','Did the HAZ melt?','HAZ Exit','{"A":"No; by definition it is base metal affected by heat without melting","B":"Yes; all HAZ material is melted","C":"Only in GTAW","D":"Only in SMAW"}'::jsonb,'A',null,'The HAZ is heat-affected base metal that did not melt.'),
('wld205_pvhs_bridge_day8','d8q11',11,'mc','What controls the exact welding response?','HAZ Exit','{"A":"Material, joint, thickness, WPS/procedure, heat input/thermal cycle, restraint, and governing requirements","B":"Appearance alone","C":"Only amperage","D":"Only base-metal thickness"}'::jsonb,'A',null,'The exact response depends on the combined source-listed factors.'),
('wld205_pvhs_bridge_day8','d8q12',12,'mc','When do ferrite/austenite/pearlite/TTT details become formal in this sequence?','HAZ Exit','{"A":"During the shared Level II metallurgy block after Day 22","B":"During this Day 8 bridge only","C":"Before Day 2","D":"They are never covered"}'::jsonb,'A',null,'Day 8 intentionally saves transformation detail for the shared Level II metallurgy block.');
