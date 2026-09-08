insert into public.assessment_modules(
  slug,title,description,category,estimated_minutes,sort_order,version,
  active,instructions,allow_team_members,
  reference_title,reference_image_url,reference_body,show_student_score
)
values(
  'wld205_pvhs_bridge_day6',
  'WLD 205 Day 6 — Metal Properties + Material Behavior',
  'PVHS prerequisite metallurgy readiness: property vocabulary, material baseline comparisons, and fabrication/welding consequences.',
  'WLD 205 PVHS Bridge Live',
  60,
  206,
  12,
  true,
  'DAY 6 LIVE CLASS
0–8 min — Sort/identify hardness, strength, toughness, ductility, brittleness, and conductivity.
8–20 min — Instructor models one welding/fabrication consequence for each property. Do NOT begin the formal iron-carbon transformation sequence.
20–38 min — Compare carbon steel, stainless steel, and aluminum using the provided baseline facts.
38–52 min — Four material-behavior scenarios.
52–60 min — Metallurgy Vocabulary Exit.
Exact grade/alloy/temper is always source-controlled.',
  false,
  'WLD 205 Day 6 — Live Whiteboard',
  '/live-activities/wld205-day6-properties-board.svg',
  'This is prerequisite vocabulary, not the formal Level II metallurgy block. Exact material grade/alloy/temper comes from source documentation.',
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

delete from public.assessment_questions where assessment_slug='wld205_pvhs_bridge_day6';

insert into public.assessment_questions(
  assessment_slug,question_key,question_number,question_type,question_text,
  domain,options,correct_answer,accepted_answers,explanation
)
values
('wld205_pvhs_bridge_day6','d6q1',1,'mc','Which term means resistance to indentation/wear and is not the same as toughness?','Property Vocabulary','{"A":"Hardness","B":"Ductility","C":"Thermal conductivity","D":"Toughness"}'::jsonb,'A',null,'Hardness is resistance to indentation/wear.'),
('wld205_pvhs_bridge_day6','d6q2',2,'mc','Which term describes ability to resist applied load/stress before failure/deformation, depending on the property discussed?','Property Vocabulary','{"A":"Strength","B":"Brittleness","C":"Conductivity","D":"Ductility"}'::jsonb,'A',null,'The source pack uses this as the baseline strength definition.'),
('wld205_pvhs_bridge_day6','d6q3',3,'mc','Which term means ability to absorb energy before fracturing?','Property Vocabulary','{"A":"Toughness","B":"Hardness","C":"Brittleness","D":"Thermal conductivity"}'::jsonb,'A',null,'Toughness is energy absorption before fracture.'),
('wld205_pvhs_bridge_day6','d6q4',4,'mc','Which term means ability to plastically deform/elongate before fracture?','Property Vocabulary','{"A":"Ductility","B":"Hardness","C":"Strength","D":"Brittleness"}'::jsonb,'A',null,'Ductility describes plastic deformation before fracture.'),
('wld205_pvhs_bridge_day6','d6q5',5,'mc','Which term means tendency to fracture with little plastic deformation?','Property Vocabulary','{"A":"Brittleness","B":"Toughness","C":"Ductility","D":"Conductivity"}'::jsonb,'A',null,'That is the source-pack definition of brittleness.'),
('wld205_pvhs_bridge_day6','d6q6',6,'mc','Which term describes ability to conduct heat?','Property Vocabulary','{"A":"Thermal conductivity","B":"Hardness","C":"Strength","D":"Toughness"}'::jsonb,'A',null,'Thermal conductivity describes heat conduction.'),
('wld205_pvhs_bridge_day6','d6q7',7,'mc','Which baseline statement best matches carbon steel in the provided matrix?','Material Baseline','{"A":"Typically magnetic; property/weldability changes with composition and condition; exact grade controls","B":"Always nonmagnetic and identical by grade","C":"Always higher conductivity than aluminum","D":"Exact grade can be identified visually"}'::jsonb,'A',null,'This is the source-pack carbon-steel baseline.'),
('wld205_pvhs_bridge_day6','d6q8',8,'mc','Which baseline statement best matches stainless steel in the provided matrix?','Material Baseline','{"A":"Family/alloy dependent; corrosion resistance is associated with chromium; contamination control matters","B":"All stainless grades behave identically","C":"Exact grade is determined by color","D":"Chromium is unrelated to corrosion resistance"}'::jsonb,'A',null,'This is the source-pack stainless baseline.'),
('wld205_pvhs_bridge_day6','d6q9',9,'mc','Which baseline statement best matches aluminum in the provided matrix?','Material Baseline','{"A":"Low density, high thermal conductivity, oxide layer requires attention; exact alloy/temper controls","B":"High density and low conductivity in all cases","C":"No oxide-layer concern exists","D":"Exact alloy can be guessed from appearance"}'::jsonb,'A',null,'This is the source-pack aluminum baseline.'),
('wld205_pvhs_bridge_day6','d6q10',10,'mc','A component must bend before breaking. Which property word matters most?','Material Behavior Scenarios','{"A":"Ductility","B":"Hardness","C":"Brittleness","D":"Conductivity"}'::jsonb,'A',null,'The source scenario keys this to ductility.'),
('wld205_pvhs_bridge_day6','d6q11',11,'mc','A part must absorb impact energy. Which property word matters most?','Material Behavior Scenarios','{"A":"Toughness","B":"Hardness","C":"Conductivity","D":"Brittleness"}'::jsonb,'A',null,'The source scenario keys this to toughness.'),
('wld205_pvhs_bridge_day6','d6q12',12,'mc','A material rapidly carries heat away from the weld zone. Which property is being described?','Material Behavior Scenarios','{"A":"High thermal conductivity","B":"High hardness","C":"High brittleness","D":"Low strength"}'::jsonb,'A',null,'The source scenario identifies high thermal conductivity.'),
('wld205_pvhs_bridge_day6','d6q13',13,'mc','A surface resists indentation. Which property is being described?','Material Behavior Scenarios','{"A":"Hardness","B":"Toughness","C":"Ductility","D":"Conductivity"}'::jsonb,'A',null,'The source scenario identifies hardness.'),
('wld205_pvhs_bridge_day6','d6q14',14,'mc','Hardness and toughness are the same property.','Vocabulary Exit','{"A":"False","B":"True","C":"Only for aluminum","D":"Only for carbon steel"}'::jsonb,'A',null,'They are different properties.'),
('wld205_pvhs_bridge_day6','d6q15',15,'mc','Ductility describes the ability to plastically deform.','Vocabulary Exit','{"A":"True","B":"False","C":"Only above the melting point","D":"Only after welding"}'::jsonb,'A',null,'The source exit keys this True.'),
('wld205_pvhs_bridge_day6','d6q16',16,'mc','Exact material grade should come from source documentation, not visual guessing.','Vocabulary Exit','{"A":"True","B":"False","C":"Only for stainless","D":"Only for aluminum"}'::jsonb,'A',null,'The source exit requires source documentation.');
