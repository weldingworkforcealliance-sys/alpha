insert into public.assessment_modules(
  slug,title,description,category,estimated_minutes,sort_order,version,
  active,instructions,allow_team_members,
  reference_title,reference_image_url,reference_body,show_student_score
)
values(
  'wld205_pvhs_bridge_day4',
  'WLD 205 Day 4 — Decimals + Fraction/Decimal Conversion',
  'PVHS prerequisite bridge: common fraction/decimal equivalence, decimal operations, measurement comparison, rounding, and tolerance preview.',
  'WLD 205 PVHS Bridge Live',
  60,
  204,
  12,
  true,
  'DAY 4 LIVE CLASS
0–8 min — Fraction/decimal match retrieval.
8–20 min — Model 3/8 and 1 7/16 conversions and reverse reasoning.
20–40 min — Decimal Shop Set A.
40–54 min — Measurement Record: compare print fraction to decimal device reading.
54–60 min — Rounding/tolerance preview.
This previews tolerance reasoning; it does not replace Day 7.',
  false,
  'WLD 205 Day 4 — Live Whiteboard',
  '/live-activities/wld205-day4-decimals-board.svg',
  'Preserve the unit. Convert before comparing. Round only to the precision required by the source/job. Day 7 will formally apply limits to accept/reject decisions.',
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

delete from public.assessment_questions where assessment_slug='wld205_pvhs_bridge_day4';

insert into public.assessment_questions(
  assessment_slug,question_key,question_number,question_type,question_text,
  domain,options,correct_answer,accepted_answers,explanation
)
values
('wld205_pvhs_bridge_day4','d4q1',1,'mc','Convert 1/8 in to decimal.','Fraction / Decimal Match','{"A":"0.125","B":"0.500","C":"0.250","D":"0.9375"}'::jsonb,'A',null,'1/8 = 0.125.'),
('wld205_pvhs_bridge_day4','d4q2',2,'mc','Convert 1/4 in to decimal.','Fraction / Decimal Match','{"A":"0.250","B":"0.500","C":"0.625","D":"0.9375"}'::jsonb,'A',null,'1/4 = 0.250.'),
('wld205_pvhs_bridge_day4','d4q3',3,'mc','Convert 3/8 in to decimal.','Fraction / Decimal Match','{"A":"0.375","B":"0.500","C":"0.250","D":"0.9375"}'::jsonb,'A',null,'3/8 = 0.375.'),
('wld205_pvhs_bridge_day4','d4q4',4,'mc','Convert 1/2 in to decimal.','Fraction / Decimal Match','{"A":"0.500","B":"0.375","C":"0.250","D":"0.9375"}'::jsonb,'A',null,'1/2 = 0.500.'),
('wld205_pvhs_bridge_day4','d4q5',5,'mc','Convert 5/8 in to decimal.','Fraction / Decimal Match','{"A":"0.625","B":"0.500","C":"0.250","D":"0.9375"}'::jsonb,'A',null,'5/8 = 0.625.'),
('wld205_pvhs_bridge_day4','d4q6',6,'mc','Convert 3/4 in to decimal.','Fraction / Decimal Match','{"A":"0.750","B":"0.500","C":"0.250","D":"0.9375"}'::jsonb,'A',null,'3/4 = 0.750.'),
('wld205_pvhs_bridge_day4','d4q7',7,'mc','Convert 7/8 in to decimal.','Fraction / Decimal Match','{"A":"0.875","B":"0.500","C":"0.250","D":"0.9375"}'::jsonb,'A',null,'7/8 = 0.875.'),
('wld205_pvhs_bridge_day4','d4q8',8,'mc','2.375 + 1.625 = ?','Decimal Shop Set A','{"A":"4.000","B":"3.900","C":"4.125","D":"3.875"}'::jsonb,'A',null,'2.375 + 1.625 = 4.000.'),
('wld205_pvhs_bridge_day4','d4q9',9,'mc','6.500 - 2.1875 = ?','Decimal Shop Set A','{"A":"4.3125","B":"4.4125","C":"4.1875","D":"3.3125"}'::jsonb,'A',null,'6.500 - 2.1875 = 4.3125.'),
('wld205_pvhs_bridge_day4','d4q10',10,'mc','1.25 × 3 = ?','Decimal Shop Set A','{"A":"3.75","B":"4.25","C":"2.75","D":"3.25"}'::jsonb,'A',null,'1.25 × 3 = 3.75.'),
('wld205_pvhs_bridge_day4','d4q11',11,'mc','7.5 ÷ 3 = ?','Decimal Shop Set A','{"A":"2.5","B":"3.5","C":"2.25","D":"2.75"}'::jsonb,'A',null,'7.5 ÷ 3 = 2.5.'),
('wld205_pvhs_bridge_day4','d4q12',12,'mc','Convert print dimension 1 3/8 in to decimal.','Measurement Record','{"A":"1.375 in","B":"1.372 in","C":"1.385 in","D":"1.625 in"}'::jsonb,'A',null,'1 3/8 = 1.375.'),
('wld205_pvhs_bridge_day4','d4q13',13,'mc','Print is 1.375 in and measured value is 1.372 in. What is the absolute difference?','Measurement Record','{"A":"0.003 in","B":"0.030 in","C":"0.013 in","D":"0.300 in"}'::jsonb,'A',null,'1.375 - 1.372 = 0.003.'),
('wld205_pvhs_bridge_day4','d4q14',14,'mc','Round 2.3764 to the nearest 0.001 in.','Rounding Preview','{"A":"2.376 in","B":"2.377 in","C":"2.380 in","D":"2.370 in"}'::jsonb,'A',null,'At the thousandth, the next digit is 4, so 2.376 remains.'),
('wld205_pvhs_bridge_day4','d4q15',15,'mc','4.000 ± 0.020 in gives which limits?','Tolerance Preview','{"A":"3.980–4.020 in","B":"3.990–4.010 in","C":"4.000–4.020 in","D":"3.900–4.100 in"}'::jsonb,'A',null,'4.000 - 0.020 = 3.980; + 0.020 = 4.020.');
