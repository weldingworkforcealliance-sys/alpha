insert into public.assessment_modules(
  slug,title,description,category,estimated_minutes,sort_order,version,
  active,instructions,allow_team_members,
  reference_title,reference_image_url,reference_body,show_student_score
)
values(
  'wld205_pvhs_bridge_day3',
  'WLD 205 Day 3 — Blueprint Recovery I',
  'PVHS prerequisite bridge: line functions, FRAME-A source reading, dimensions, notes, material information, and print-to-WPS boundary.',
  'WLD 205 PVHS Bridge Live',
  60,
  203,
  12,
  true,
  'DAY 3 LIVE CLASS
0–8 min — Identify object/visible, hidden, center, dimension, and extension-line purposes.
8–18 min — Instructor models: TITLE / VIEW → NOTES → DIMENSIONS → SYMBOLS → QUESTIONS.
18–38 min — Guided read of Bridge Print A (FRAME-A).
38–52 min — Math connection from the print.
52–60 min — Blueprint Exit 1.
Require students to point to the source of each answer. The provided bridge drawing is an original review example; authorized PCCC references control exact conventions.',
  false,
  'WLD 205 Day 3 — Live Whiteboard',
  '/live-activities/wld205-day3-frame-a-board.svg',
  'FRAME-A is an original PCCC bridge print. Front view: 12.000 in wide × 8.000 in high; internal horizontals at 4.000-in spacing; ALL DIMENSIONS IN INCHES; material: 1 × 1 square tube. Welding procedure conditions come from the approved WPS/SWPS.',
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

delete from public.assessment_questions where assessment_slug='wld205_pvhs_bridge_day3';

insert into public.assessment_questions(
  assessment_slug,question_key,question_number,question_type,question_text,
  domain,options,correct_answer,accepted_answers,explanation
)
values
('wld205_pvhs_bridge_day3','d3q1',1,'mc','What is the purpose of an object/visible line?','Line Functions','{"A":"Shows visible edges/features","B":"Shows an edge hidden in the current view","C":"Shows center/axis or symmetry","D":"Carries a numerical dimension"}'::jsonb,'A',null,'Object/visible lines show visible edges/features.'),
('wld205_pvhs_bridge_day3','d3q2',2,'mc','What is the purpose of a hidden line?','Line Functions','{"A":"Shows center/axis or symmetry","B":"Shows an edge/feature not visible in the current view","C":"Carries a numerical dimension","D":"Shows visible edges/features"}'::jsonb,'B',null,'Hidden lines show edges/features not visible in the current view.'),
('wld205_pvhs_bridge_day3','d3q3',3,'mc','What is the purpose of a centerline?','Line Functions','{"A":"Shows center/axis or symmetry","B":"Shows a hidden edge","C":"Carries a numerical size","D":"Extends a feature to a dimension line"}'::jsonb,'A',null,'Centerlines show center/axis or symmetry.'),
('wld205_pvhs_bridge_day3','d3q4',4,'mc','What is the purpose of a dimension line?','Line Functions','{"A":"Carries a numerical size/location dimension","B":"Shows a hidden edge","C":"Shows center/axis only","D":"Shows visible edges only"}'::jsonb,'A',null,'Dimension lines carry numerical size/location information.'),
('wld205_pvhs_bridge_day3','d3q5',5,'mc','What is the purpose of an extension line?','Line Functions','{"A":"Extends from the feature to a dimension line","B":"Shows only a hidden edge","C":"Is the same as a centerline","D":"Gives welding parameters"}'::jsonb,'A',null,'Extension lines extend from a feature to a dimension line.'),
('wld205_pvhs_bridge_day3','d3q6',6,'mc','FRAME-A overall width is:','Bridge Print A','{"A":"12.000 in","B":"8.000 in","C":"4.000 in","D":"40.000 in"}'::jsonb,'A',null,'Bridge Print A states 12.000 in overall width.'),
('wld205_pvhs_bridge_day3','d3q7',7,'mc','FRAME-A overall height is:','Bridge Print A','{"A":"8.000 in","B":"12.000 in","C":"4.000 in","D":"1.000 in"}'::jsonb,'A',null,'Bridge Print A states 8.000 in overall height.'),
('wld205_pvhs_bridge_day3','d3q8',8,'mc','Distance from the bottom to the middle horizontal member is:','Bridge Print A','{"A":"4.000 in","B":"8.000 in","C":"6.000 in","D":"2.000 in"}'::jsonb,'A',null,'The internal horizontals divide the 8.000-in height into equal 4.000-in spaces.'),
('wld205_pvhs_bridge_day3','d3q9',9,'mc','Which note controls the units on FRAME-A?','Bridge Print A','{"A":"ALL DIMENSIONS IN INCHES","B":"WELD PER APPROVED WPS/SWPS","C":"DO NOT USE UNITS","D":"SCALE DRAWING"}'::jsonb,'A',null,'The source print states ALL DIMENSIONS IN INCHES.'),
('wld205_pvhs_bridge_day3','d3q10',10,'mc','What material is specified on FRAME-A?','Bridge Print A','{"A":"1 × 1 square tube","B":"1/4 in A36 plate","C":"2 in pipe","D":"Aluminum sheet"}'::jsonb,'A',null,'The material note specifies 1 × 1 square tube.'),
('wld205_pvhs_bridge_day3','d3q11',11,'mc','Which source is needed for welding parameters that are not provided by the print alone?','Source Use','{"A":"Approved WPS/SWPS","B":"Drawing scale","C":"Visual estimate","D":"Student memory"}'::jsonb,'A',null,'Welding procedure conditions come from the approved WPS/SWPS.'),
('wld205_pvhs_bridge_day3','d3q12',12,'mc','Two 12-in horizontals plus two 8-in verticals equals how much outer-frame stock before allowance/kerf?','Math Connection','{"A":"40 in","B":"32 in","C":"48 in","D":"20 in"}'::jsonb,'A',null,'2×12 + 2×8 = 40 in.'),
('wld205_pvhs_bridge_day3','d3q13',13,'mc','Where do you look first for units if the drawing includes a general note?','Blueprint Exit','{"A":"Drawing notes/title-block information","B":"Welding machine","C":"Tape color","D":"Student notes"}'::jsonb,'A',null,'Units are controlled by the drawing notes/title-block conventions.'),
('wld205_pvhs_bridge_day3','d3q14',14,'mc','Does a dimension line itself provide welding parameters?','Blueprint Exit','{"A":"No","B":"Yes, always","C":"Only for SMAW","D":"Only if the drawing is not to scale"}'::jsonb,'A',null,'A dimension line communicates dimensions, not the full welding procedure.'),
('wld205_pvhs_bridge_day3','d3q15',15,'mc','If the print and a verbal instruction conflict, what is the correct response?','Blueprint Exit','{"A":"Stop and resolve the controlling source with the instructor","B":"Follow the verbal instruction automatically","C":"Follow whichever is easier","D":"Scale the drawing"}'::jsonb,'A',null,'Conflicting source information must be resolved before acting.');
