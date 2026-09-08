insert into public.assessment_modules(
  slug,title,description,category,estimated_minutes,sort_order,version,
  active,instructions,allow_team_members,
  reference_title,reference_image_url,reference_body,show_student_score
)
values(
  'wld205_pvhs_bridge_day2',
  'WLD 205 Day 2 — Measurement, Fractions + Mixed Numbers',
  'PVHS prerequisite bridge: rule reading, fractional shop dimensions, cut-length arithmetic, units, and independent check.',
  'WLD 205 PVHS Bridge Live',
  60,
  202,
  12,
  true,
  'DAY 2 LIVE CLASS
0–8 min — Rule Reading Cards. Students record each measurement with units.
8–20 min — Instructor models simplifying fractions and common denominators.
20–40 min — Complete Fraction Shop Set A. Require units and a reasonableness check on the whiteboard.
40–54 min — Complete the cut-length mini-task.
54–60 min — Complete the 4-item independent check.
Use the live results only to identify specific remaining gaps. Do not repeat a domain the student has already demonstrated.',
  false,
  'WLD 205 Day 2 — Live Whiteboard',
  '/live-activities/wld205-day2-fractions-board.svg',
  'WHITEBOARD RULE: measurement → operation → work → answer with unit → reasonableness check. The cut-length values are theoretical; actual cutting allowance/kerf follows the project/shop procedure.',
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

delete from public.assessment_questions where assessment_slug='wld205_pvhs_bridge_day2';

insert into public.assessment_questions(
  assessment_slug,question_key,question_number,question_type,question_text,
  domain,options,correct_answer,accepted_answers,explanation
)
values
('wld205_pvhs_bridge_day2','d2q1',1,'mc','Rule Card A is 1/4 in. Which decimal equivalent is correct?','Rule Reading','{"A":"0.250 in","B":"0.125 in","C":"0.375 in","D":"0.500 in"}'::jsonb,'A',null,'1/4 = 0.250.'),
('wld205_pvhs_bridge_day2','d2q2',2,'mc','Rule Card B is 3/8 in. Which decimal equivalent is correct?','Rule Reading','{"A":"0.250 in","B":"0.375 in","C":"0.4375 in","D":"0.625 in"}'::jsonb,'B',null,'3/8 = 0.375.'),
('wld205_pvhs_bridge_day2','d2q3',3,'mc','Rule Card C is 7/16 in. Which decimal equivalent is correct?','Rule Reading','{"A":"0.4375 in","B":"0.375 in","C":"0.625 in","D":"0.875 in"}'::jsonb,'A',null,'7/16 = 0.4375.'),
('wld205_pvhs_bridge_day2','d2q4',4,'mc','Rule Card D is 1 5/8 in. Which decimal equivalent is correct?','Rule Reading','{"A":"1.625 in","B":"1.500 in","C":"1.875 in","D":"1.375 in"}'::jsonb,'A',null,'1 5/8 = 1.625.'),
('wld205_pvhs_bridge_day2','d2q5',5,'mc','2 3/8 in + 1 7/8 in = ?','Fraction Shop Set A','{"A":"4 1/4 in","B":"4 3/8 in","C":"3 7/8 in","D":"4 1/8 in"}'::jsonb,'A',null,'2 3/8 + 1 7/8 = 4 1/4.'),
('wld205_pvhs_bridge_day2','d2q6',6,'mc','6 1/2 in - 2 3/16 in = ?','Fraction Shop Set A','{"A":"4 5/16 in","B":"4 3/16 in","C":"4 1/2 in","D":"3 5/16 in"}'::jsonb,'A',null,'6 1/2 - 2 3/16 = 4 5/16.'),
('wld205_pvhs_bridge_day2','d2q7',7,'mc','3 × 1 1/4 in = ?','Fraction Shop Set A','{"A":"3 3/4 in","B":"4 1/4 in","C":"3 1/4 in","D":"2 3/4 in"}'::jsonb,'A',null,'3 × 1 1/4 = 3 3/4.'),
('wld205_pvhs_bridge_day2','d2q8',8,'mc','7 1/2 in ÷ 3 = ?','Fraction Shop Set A','{"A":"2 1/2 in","B":"2 3/4 in","C":"3 1/2 in","D":"2 1/4 in"}'::jsonb,'A',null,'7 1/2 ÷ 3 = 2 1/2.'),
('wld205_pvhs_bridge_day2','d2q9',9,'mc','Three pieces are 8 3/4 in, 6 1/2 in, and 4 7/8 in. What is the theoretical total?','Cut-Length Task','{"A":"20 1/8 in","B":"19 7/8 in","C":"20 3/8 in","D":"19 1/8 in"}'::jsonb,'A',null,'8 3/4 + 6 1/2 + 4 7/8 = 20 1/8.'),
('wld205_pvhs_bridge_day2','d2q10',10,'mc','Starting with 24 in of stock and a theoretical cut total of 20 1/8 in, how much remains before any additional allowance/kerf rules?','Cut-Length Task','{"A":"3 7/8 in","B":"4 1/8 in","C":"3 5/8 in","D":"4 7/8 in"}'::jsonb,'A',null,'24 - 20 1/8 = 3 7/8.'),
('wld205_pvhs_bridge_day2','d2q11',11,'mc','1 5/16 in + 2 7/8 in = ?','Independent Check','{"A":"4 3/16 in","B":"4 1/16 in","C":"3 15/16 in","D":"4 5/16 in"}'::jsonb,'A',null,'1 5/16 + 2 7/8 = 4 3/16.'),
('wld205_pvhs_bridge_day2','d2q12',12,'mc','5 3/4 in - 1 11/16 in = ?','Independent Check','{"A":"4 1/16 in","B":"4 3/16 in","C":"3 15/16 in","D":"4 5/16 in"}'::jsonb,'A',null,'5 3/4 - 1 11/16 = 4 1/16.'),
('wld205_pvhs_bridge_day2','d2q13',13,'mc','4 × 7/8 in = ?','Independent Check','{"A":"3 1/2 in","B":"3 7/8 in","C":"4 1/2 in","D":"2 7/8 in"}'::jsonb,'A',null,'4 × 7/8 = 3 1/2.'),
('wld205_pvhs_bridge_day2','d2q14',14,'mc','9 3/8 in ÷ 2 = ?','Independent Check','{"A":"4 11/16 in","B":"4 3/8 in","C":"4 7/16 in","D":"5 3/16 in"}'::jsonb,'A',null,'9 3/8 ÷ 2 = 4 11/16.');
