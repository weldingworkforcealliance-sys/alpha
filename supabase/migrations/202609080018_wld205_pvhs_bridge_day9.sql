insert into public.assessment_modules(
  slug,title,description,category,estimated_minutes,sort_order,version,
  active,instructions,allow_team_members,
  reference_title,reference_image_url,reference_body,show_student_score
)
values(
  'wld205_pvhs_bridge_day9',
  'WLD 205 Day 9 — Integrated Readiness',
  'PVHS prerequisite bridge close: blueprint/source reading, math/tolerance, material behavior, targeted repair, BASE-C integrated scenario, and readiness record.',
  'WLD 205 PVHS Bridge Live',
  60,
  209,
  12,
  true,
  'DAY 9 LIVE CLASS
0–10 min — Complete the 9-item Bridge Readiness Quick Check.
10–25 min — PAUSE THE DEVICE. Instructor assigns one mini-station by actual need: Blueprint Locate / Math Measure / Material Behavior.
25–48 min — Resume the live activity for Bridge Print C / BASE-C integrated scenario.
48–56 min — PAUSE. Instructor gives one new recheck item only in the student’s weakest domain.
56–60 min — Readiness close: record one strength and one support need. Day 10 is full WLD-210 overlap; common WLD-205 begins Day 11.
This is readiness evidence, not a class ranking.',
  false,
  'WLD 205 Day 9 — Live Whiteboard',
  '/live-activities/wld205-day9-integrated-board.svg',
  'BASE-C: 10.000 × 6.000 in plate; vertical tab centered on the 10-in length; tab location tolerance ±0.030 in; material note: carbon steel, exact grade per instructor-issued material record; WELD PER APPROVED WPS/SWPS.',
  false
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

delete from public.assessment_questions where assessment_slug='wld205_pvhs_bridge_day9';

insert into public.assessment_questions(
  assessment_slug,question_key,question_number,question_type,question_text,
  domain,options,correct_answer,accepted_answers,explanation
)
values
('wld205_pvhs_bridge_day9','d9q1',1,'mc','Where are drawing units normally stated?','Blueprint Quick Check','{"A":"Title block/general notes/dimension conventions on the drawing","B":"Welding machine","C":"Student memory","D":"Only the WPS"}'::jsonb,'A',null,'The source quick check points to title block/general notes/dimension conventions.'),
('wld205_pvhs_bridge_day9','d9q2',2,'mc','Which source gives welding procedure conditions?','Blueprint Quick Check','{"A":"Approved WPS/SWPS","B":"Drawing scale","C":"Student notes","D":"Visual estimate"}'::jsonb,'A',null,'Approved WPS/SWPS provides procedure conditions.'),
('wld205_pvhs_bridge_day9','d9q3',3,'mc','What do you do with an unclear symbol?','Blueprint Quick Check','{"A":"Stop and check the authorized source/instructor","B":"Tack first","C":"Guess from the joint","D":"Ignore it"}'::jsonb,'A',null,'The source quick check requires stop/check.'),
('wld205_pvhs_bridge_day9','d9q4',4,'mc','1 3/4 in + 2 5/8 in = ?','Math Quick Check','{"A":"4 3/8 in","B":"4 1/8 in","C":"3 7/8 in","D":"4 5/8 in"}'::jsonb,'A',null,'1 3/4 + 2 5/8 = 4 3/8.'),
('wld205_pvhs_bridge_day9','d9q5',5,'mc','0.625 in equals which common fraction?','Math Quick Check','{"A":"5/8 in","B":"3/8 in","C":"7/8 in","D":"1/2 in"}'::jsonb,'A',null,'0.625 = 5/8.'),
('wld205_pvhs_bridge_day9','d9q6',6,'mc','5.000 ± 0.020 in, actual 4.978 in. Decision?','Math Quick Check','{"A":"Reject; lower limit is 4.980 in","B":"Accept","C":"Reject; upper limit is 4.980 in","D":"Cannot determine"}'::jsonb,'A',null,'4.978 is below the 4.980 lower limit.'),
('wld205_pvhs_bridge_day9','d9q7',7,'mc','Which property describes plastic deformation before fracture?','Metallurgy Quick Check','{"A":"Ductility","B":"Hardness","C":"Brittleness","D":"Conductivity"}'::jsonb,'A',null,'Ductility describes plastic deformation before fracture.'),
('wld205_pvhs_bridge_day9','d9q8',8,'mc','Which region is affected by welding heat but did not melt?','Metallurgy Quick Check','{"A":"HAZ","B":"Weld metal","C":"Unaffected base metal","D":"Slag"}'::jsonb,'A',null,'That is the HAZ.'),
('wld205_pvhs_bridge_day9','d9q9',9,'mc','Exact alloy grade should be identified from:','Metallurgy Quick Check','{"A":"Source documentation/marking/MTR/project specification, not guessing","B":"Color only","C":"Magnet response only","D":"Weld appearance only"}'::jsonb,'A',null,'Exact alloy grade is source-controlled.'),
('wld205_pvhs_bridge_day9','d9q10',10,'mc','Bridge Print C BASE-C is what overall plate size?','Integrated Scenario','{"A":"10.000 × 6.000 in","B":"12.000 × 8.000 in","C":"8.000 × 4.000 in","D":"6.000 × 2.000 in"}'::jsonb,'A',null,'The provided BASE-C is 10.000 × 6.000 in.'),
('wld205_pvhs_bridge_day9','d9q11',11,'mc','A vertical tab is centered on the 10.000-in length. What is the nominal center location?','Integrated Scenario','{"A":"5.000 in","B":"6.000 in","C":"4.000 in","D":"10.000 in"}'::jsonb,'A',null,'Half of 10.000 is 5.000.'),
('wld205_pvhs_bridge_day9','d9q12',12,'mc','Tab location is 5.000 ± 0.030 in and actual center is 5.024 in. Decision?','Integrated Scenario','{"A":"Accept; allowable range is 4.970–5.030 in","B":"Reject; 5.024 is high","C":"Accept; allowable range is 5.000–5.030 only","D":"Cannot determine"}'::jsonb,'A',null,'5.024 is within 4.970–5.030.'),
('wld205_pvhs_bridge_day9','d9q13',13,'mc','What can be concluded about exact carbon content from the words “carbon steel” alone?','Integrated Scenario','{"A":"Not enough; exact grade/composition requires source documentation","B":"Exact carbon content is obvious","C":"It is always the same carbon content","D":"The WPS is unnecessary"}'::jsonb,'A',null,'The material note alone does not establish exact grade/composition.'),
('wld205_pvhs_bridge_day9','d9q14',14,'mc','What zone beside the weld may have changed properties?','Integrated Scenario','{"A":"HAZ","B":"Unaffected base metal only","C":"Title block","D":"Dimension line"}'::jsonb,'A',null,'The HAZ may have changed properties.');
