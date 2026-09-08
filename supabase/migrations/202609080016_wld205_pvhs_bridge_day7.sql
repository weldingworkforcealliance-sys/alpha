insert into public.assessment_modules(
  slug,title,description,category,estimated_minutes,sort_order,version,
  active,instructions,allow_team_members,
  reference_title,reference_image_url,reference_body,show_student_score
)
values(
  'wld205_pvhs_bridge_day7',
  'WLD 205 Day 7 — Tolerances + Accept/Reject',
  'PVHS prerequisite bridge: plus/minus tolerances, upper/lower limits, documented accept/reject decisions, and corrective/recheck record.',
  'WLD 205 PVHS Bridge Live',
  60,
  207,
  12,
  true,
  'DAY 7 LIVE CLASS
0–8 min — Tolerance Cards: identify nominal and permitted variation.
8–20 min — Model: NOMINAL → LIMITS → ACTUAL → DECISION.
20–40 min — Tolerance Set A.
40–54 min — Mock measurement record and factual corrective/recheck note.
54–60 min — Independent 3-item tolerance check.
Use stated limits and units. Do not erase or disguise an out-of-tolerance measurement; follow the instructor/project correction and recheck procedure.',
  false,
  'WLD 205 Day 7 — Live Whiteboard',
  '/live-activities/wld205-day7-tolerances-board.svg',
  'Decision chain: NOMINAL → LIMITS → ACTUAL → DECISION. The approved job print/tolerance source controls real work.',
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

delete from public.assessment_questions where assessment_slug='wld205_pvhs_bridge_day7';

insert into public.assessment_questions(
  assessment_slug,question_key,question_number,question_type,question_text,
  domain,options,correct_answer,accepted_answers,explanation
)
values
('wld205_pvhs_bridge_day7','d7q1',1,'mc','2.000 ± 0.030 in gives which limits?','Tolerance Cards','{"A":"1.970–2.030 in","B":"1.980–2.020 in","C":"2.000–2.030 in","D":"1.930–2.070 in"}'::jsonb,'A',null,'2.000 ± 0.030 = 1.970 to 2.030.'),
('wld205_pvhs_bridge_day7','d7q2',2,'mc','6.500 ± 0.015 in gives which limits?','Tolerance Cards','{"A":"6.485–6.515 in","B":"6.490–6.510 in","C":"6.500–6.515 in","D":"6.475–6.525 in"}'::jsonb,'A',null,'6.500 ± 0.015 = 6.485 to 6.515.'),
('wld205_pvhs_bridge_day7','d7q3',3,'mc','1 1/2 ± 1/32 in gives which limits?','Tolerance Cards','{"A":"1 15/32–1 17/32 in","B":"1 14/32–1 18/32 in","C":"1 1/2–1 17/32 in","D":"1 7/16–1 9/16 in"}'::jsonb,'A',null,'1 1/2 is 1 16/32; ±1/32 gives 1 15/32 to 1 17/32.'),
('wld205_pvhs_bridge_day7','d7q4',4,'mc','2.000 ± 0.030 in, actual 2.025 in. Decision?','Tolerance Set A','{"A":"Accept","B":"Reject","C":"Cannot determine","D":"Change nominal"}'::jsonb,'A',null,'2.025 is within 1.970–2.030.'),
('wld205_pvhs_bridge_day7','d7q5',5,'mc','2.000 ± 0.030 in, actual 2.036 in. Decision?','Tolerance Set A','{"A":"Reject","B":"Accept","C":"Cannot determine","D":"Round to 2.030"}'::jsonb,'A',null,'2.036 exceeds 2.030.'),
('wld205_pvhs_bridge_day7','d7q6',6,'mc','6.500 ± 0.015 in, actual 6.490 in. Decision?','Tolerance Set A','{"A":"Accept","B":"Reject","C":"Cannot determine","D":"Change tolerance"}'::jsonb,'A',null,'6.490 is within 6.485–6.515.'),
('wld205_pvhs_bridge_day7','d7q7',7,'mc','6.500 ± 0.015 in, actual 6.518 in. Decision?','Tolerance Set A','{"A":"Reject","B":"Accept","C":"Cannot determine","D":"Round to 6.515"}'::jsonb,'A',null,'6.518 exceeds 6.515.'),
('wld205_pvhs_bridge_day7','d7q8',8,'mc','1.500 ± 0.020 in, actual 1.481 in. Decision?','Tolerance Set A','{"A":"Accept","B":"Reject","C":"Cannot determine","D":"Change nominal"}'::jsonb,'A',null,'The limits are 1.480–1.520; 1.481 is inside.'),
('wld205_pvhs_bridge_day7','d7q9',9,'mc','1.500 ± 0.020 in, actual 1.477 in. Decision?','Tolerance Set A','{"A":"Reject","B":"Accept","C":"Cannot determine","D":"Round to 1.480"}'::jsonb,'A',null,'1.477 is below the 1.480 lower limit.'),
('wld205_pvhs_bridge_day7','d7q10',10,'mc','Which mock record result is out of tolerance?','Mock Record','{"A":"B: 7.984 for 8.000 ± 0.010","B":"A: 4.002 for 4.000 ± 0.010","C":"C: 2.496 for 2.500 ± 0.008","D":"None"}'::jsonb,'A',null,'B is below its 7.990 lower limit; A and C are acceptable.'),
('wld205_pvhs_bridge_day7','d7q11',11,'mc','Which note best matches the provided corrective/recheck model for mock dimension B?','Corrective Record','{"A":"Dimension B measured 7.984 in, below lower limit 7.990 in; hold for correction/recheck per instructor/project procedure","B":"Close enough; use it","C":"Change the print to 7.984","D":"Correct it without recording the original measurement"}'::jsonb,'A',null,'The source model requires a factual hold/correction/recheck note.'),
('wld205_pvhs_bridge_day7','d7q12',12,'mc','3.250 ± 0.010 in, actual 3.242 in. Decision?','Independent Check','{"A":"Accept","B":"Reject","C":"Cannot determine","D":"Round to 3.250"}'::jsonb,'A',null,'Limits 3.240–3.260; 3.242 is inside.'),
('wld205_pvhs_bridge_day7','d7q13',13,'mc','5.000 ± 0.015 in, actual 5.020 in. Decision?','Independent Check','{"A":"Reject","B":"Accept","C":"Cannot determine","D":"Change nominal"}'::jsonb,'A',null,'Upper limit is 5.015; 5.020 is high.'),
('wld205_pvhs_bridge_day7','d7q14',14,'mc','1.875 ± 0.005 in, actual 1.871 in. Decision?','Independent Check','{"A":"Accept","B":"Reject","C":"Cannot determine","D":"Round to 1.875"}'::jsonb,'A',null,'Limits 1.870–1.880; 1.871 is inside.'),
('wld205_pvhs_bridge_day7','d7q15',15,'mc','Which decision chain is required before accept/reject?','Decision Chain','{"A":"NOMINAL → LIMITS → ACTUAL → DECISION","B":"ACTUAL → DECISION → NOMINAL → LIMITS","C":"DECISION → GUESS → ACTUAL","D":"ACTUAL → ROUND → ACCEPT"}'::jsonb,'A',null,'The Day 7 standing chain is NOMINAL → LIMITS → ACTUAL → DECISION.');
