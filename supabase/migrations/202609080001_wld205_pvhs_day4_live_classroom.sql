-- Stage WLD 205 PVHS Level II A Day 4 as a Live Classroom-first lesson.
-- This migration is additive instructional implementation. It does not alter
-- approved curriculum text or protected course outcomes.
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
  'wld205_pvhs_bridge_day4',
  'WLD 205 Day 4 - Fraction/Decimal Shop Measurement',
  'PVHS Bridge Math Recovery II: fraction/decimal conversion, shop measurement comparison, rounding, precision, and tolerance preview.',
  'PVHS Level II Bridge',
  48,
  40,
  1,
  true,
  'Use this activity with WLD 205 PVHS Bridge Day 4. Work only when the instructor tells you to continue.\n\nQuestions 1-6: fraction/decimal retrieval (0-8 min). STOP after Question 6 for the instructor whiteboard model.\nQuestions 7-14: Decimal Shop Set A (20-40 min).\nQuestions 15-18: print dimension vs. decimal measurement comparison (40-54 min).\nQuestions 19-22: independent rounding/tolerance check (54-60 min).\n\nInclude units when requested. Convert accurately first. Round only when the question states a required precision. A part cannot be declared acceptable or unacceptable unless a tolerance or acceptance criterion is actually provided.',
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

-- Keep the question set exact and repeatable if the bundle is rebuilt before release.
delete from public.assessment_questions
where assessment_slug='wld205_pvhs_bridge_day4';

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
-- 0-8 min: retrieval
('wld205_pvhs_bridge_day4','d4q01',1,'text','Convert 3/8 in. to an exact decimal dimension.','Equivalent Retrieval',null,'0.375','["0.375",".375","0.375 in.",".375 in.","0.375in.",".375in."]'::jsonb,'3 divided by 8 equals 0.375.'),
('wld205_pvhs_bridge_day4','d4q02',2,'mc','Which fraction is exactly equal to 0.4375 in.?','Equivalent Retrieval','{"A":"3/8 in.","B":"7/16 in.","C":"1/2 in.","D":"5/16 in."}'::jsonb,'B',null,'0.4375 x 16 = 7, so the sixteenth-based fraction is 7/16.'),
('wld205_pvhs_bridge_day4','d4q03',3,'text','Convert 5/8 in. to an exact decimal dimension.','Equivalent Retrieval',null,'0.625','["0.625",".625","0.625 in.",".625 in.","0.625in.",".625in."]'::jsonb,'5 divided by 8 equals 0.625.'),
('wld205_pvhs_bridge_day4','d4q04',4,'mc','Which fraction is exactly equal to 0.3125 in.?','Equivalent Retrieval','{"A":"3/16 in.","B":"1/4 in.","C":"5/16 in.","D":"3/8 in."}'::jsonb,'C',null,'0.3125 x 16 = 5, so the fraction is 5/16.'),
('wld205_pvhs_bridge_day4','d4q05',5,'text','Convert 15/16 in. to an exact decimal dimension.','Equivalent Retrieval',null,'0.9375','["0.9375",".9375","0.9375 in.",".9375 in.","0.9375in.",".9375in."]'::jsonb,'15 divided by 16 equals 0.9375.'),
('wld205_pvhs_bridge_day4','d4q06',6,'mc','Which fraction is exactly equal to 0.125 in.?','Equivalent Retrieval','{"A":"1/16 in.","B":"1/8 in.","C":"3/16 in.","D":"1/4 in."}'::jsonb,'B',null,'0.125 equals 1/8.'),

-- 20-40 min: Decimal Shop Set A
('wld205_pvhs_bridge_day4','d4q07',7,'text','Decimal Shop Set A: Convert 7/16 in. to an exact decimal.','Fraction to Decimal',null,'0.4375','["0.4375",".4375","0.4375 in.",".4375 in.","0.4375in.",".4375in."]'::jsonb,'7 divided by 16 equals 0.4375.'),
('wld205_pvhs_bridge_day4','d4q08',8,'text','Decimal Shop Set A: Convert 1 5/8 in. to an exact decimal.','Fraction to Decimal',null,'1.625','["1.625","1.625 in.","1.625in."]'::jsonb,'5/8 equals 0.625; add the whole inch to get 1.625.'),
('wld205_pvhs_bridge_day4','d4q09',9,'text','Decimal Shop Set A: Convert 2 11/16 in. to an exact decimal.','Fraction to Decimal',null,'2.6875','["2.6875","2.6875 in.","2.6875in."]'::jsonb,'11/16 equals 0.6875; add 2 to get 2.6875.'),
('wld205_pvhs_bridge_day4','d4q10',10,'mc','Decimal Shop Set A: 0.250 in. equals which fraction?','Decimal to Fraction','{"A":"1/8 in.","B":"3/16 in.","C":"1/4 in.","D":"5/16 in."}'::jsonb,'C',null,'0.250 equals 1/4.'),
('wld205_pvhs_bridge_day4','d4q11',11,'mc','Decimal Shop Set A: 0.8125 in. equals which fraction?','Decimal to Fraction','{"A":"11/16 in.","B":"3/4 in.","C":"13/16 in.","D":"7/8 in."}'::jsonb,'C',null,'0.8125 x 16 = 13, so the fraction is 13/16.'),
('wld205_pvhs_bridge_day4','d4q12',12,'mc','Decimal Shop Set A: 1.4375 in. equals which mixed-number dimension?','Decimal to Fraction','{"A":"1 3/8 in.","B":"1 7/16 in.","C":"1 1/2 in.","D":"1 5/16 in."}'::jsonb,'B',null,'The decimal portion 0.4375 equals 7/16.'),
('wld205_pvhs_bridge_day4','d4q13',13,'text','A print requires a part to be 3 1/2 in. long. Enter the exact decimal dimension.','Shop Dimension Conversion',null,'3.5','["3.5","3.50","3.500","3.5 in.","3.50 in.","3.500 in.","3.5in.","3.50in.","3.500in."]'::jsonb,'1/2 equals 0.5, so 3 1/2 equals 3.5 exactly.'),
('wld205_pvhs_bridge_day4','d4q14',14,'mc','A decimal-reading device shows 2.1875 in. Which mixed number is exact?','Shop Dimension Conversion','{"A":"2 1/8 in.","B":"2 3/16 in.","C":"2 1/4 in.","D":"2 5/16 in."}'::jsonb,'B',null,'0.1875 x 16 = 3, so the decimal portion equals 3/16.'),

-- 40-54 min: print versus decimal measurement
('wld205_pvhs_bridge_day4','d4q15',15,'text','Measurement comparison: The print dimension is 1 1/2 in. Enter its exact decimal target.','Measurement Comparison',null,'1.5','["1.5","1.50","1.500","1.5 in.","1.50 in.","1.500 in.","1.5in.","1.50in.","1.500in."]'::jsonb,'1 1/2 in. equals 1.500 in. exactly.'),
('wld205_pvhs_bridge_day4','d4q16',16,'mc','The print target is 1.500 in. and the device reads 1.498 in. What is the absolute difference?','Measurement Comparison','{"A":"0.001 in.","B":"0.002 in.","C":"0.003 in.","D":"0.020 in."}'::jsonb,'B',null,'The absolute difference between 1.500 and 1.498 is 0.002 in.'),
('wld205_pvhs_bridge_day4','d4q17',17,'mc','The print dimension is 3 7/16 in. What is that target rounded to the nearest 0.001 in.?','Rounding and Precision','{"A":"3.437 in.","B":"3.438 in.","C":"3.440 in.","D":"3.416 in."}'::jsonb,'B',null,'3 7/16 equals 3.4375 exactly; to the nearest thousandth it rounds to 3.438.'),
('wld205_pvhs_bridge_day4','d4q18',18,'mc','A print dimension and a device reading are available, but no tolerance or acceptance criterion is given. Can you declare the part acceptable?','Tolerance Interpretation','{"A":"Yes, if the numbers look close","B":"Yes, if the decimal has three places","C":"No, not until the controlling tolerance or acceptance criterion is known","D":"No, because decimals cannot be used for inspection"}'::jsonb,'C',null,'A numerical difference alone does not define acceptance. The controlling tolerance or acceptance criterion is required.'),

-- 54-60 min: independent check
('wld205_pvhs_bridge_day4','d4q19',19,'text','Independent check: Convert 1 7/16 in. to its exact decimal value.','Independent Check',null,'1.4375','["1.4375","1.4375 in.","1.4375in."]'::jsonb,'7/16 equals 0.4375, so 1 7/16 equals 1.4375.'),
('wld205_pvhs_bridge_day4','d4q20',20,'text','Independent check: Round 1.4375 in. to the nearest 0.001 in.','Independent Check',null,'1.438','["1.438","1.438 in.","1.438in."]'::jsonb,'The fourth decimal place is 5, so 1.4375 rounds to 1.438 at thousandth precision.'),
('wld205_pvhs_bridge_day4','d4q21',21,'mc','Independent check: A required dimension is 2.500 +/- 0.005 in. What is the allowable range?','Independent Check','{"A":"2.490-2.510 in.","B":"2.495-2.505 in.","C":"2.499-2.501 in.","D":"2.500-2.505 in."}'::jsonb,'B',null,'2.500 - 0.005 = 2.495 and 2.500 + 0.005 = 2.505.'),
('wld205_pvhs_bridge_day4','d4q22',22,'mc','Independent check: The required dimension is 2.500 +/- 0.005 in. The measured dimension is 2.504 in. Is it within the stated tolerance?','Independent Check','{"A":"Yes","B":"No"}'::jsonb,'A',null,'2.504 falls inside the inclusive range 2.495 through 2.505.' );

-- Update only the active WLD 205 guide Day 4 implementation language.
-- Protected outcomes are intentionally untouched.
with target_day as (
  select d.id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id and g.course_id=d.course_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.status='active'
    and d.planner_day_number=4
)
update public.course_guide_days d
set
  materials_equipment='Whiteboard; student devices with browser access; Live Classroom Day 4 activity; ruler/tape/caliper as available for instructor demonstration or later physical verification.',
  assessment='Live Classroom Day 4 activity: auto-scored fraction/decimal retrieval, Decimal Shop Set A, print-versus-measurement comparison, and a 4-item independent rounding/tolerance check.',
  evidence_check_for_understanding='Live Classroom domain scores for fraction-to-decimal, decimal-to-fraction, shop-dimension conversion, measurement comparison, rounding/precision, tolerance interpretation, and the independent check. Carry forward only the unresolved domain gap.',
  record_link_expectation='Retain the Live Classroom submission/domain scores for Day 4. Record only unresolved conversion, precision, or tolerance gaps in LTG follow-up notes.',
  updated_at=now()
from target_day t
where d.id=t.id;

-- Make each agenda row truthful about how Day 4 is delivered in a whiteboard + device classroom.
with target_day as (
  select d.id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id and g.course_id=d.course_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.status='active'
    and d.planner_day_number=4
)
update public.course_guide_day_segments s
set
  instructor_actions=case s.sequence_number
    when 1 then 'Launch the Day 4 Live Classroom activity. Students complete Questions 1-6 for fraction/decimal retrieval, then stop for the whiteboard model.'
    when 2 then 'Use the whiteboard to model 3/8 in. and 1 7/16 in. as decimals, then model decimal-to-fraction reasoning. Explain that rounding occurs only when the required precision permits it.'
    when 3 then 'Resume Live Classroom. Students complete Questions 7-14 (Decimal Shop Set A). Monitor domain results and correct only the identified conversion gap.'
    when 4 then 'Continue Live Classroom Questions 15-18. Students compare fractional print dimensions with decimal measuring-device readings and distinguish numerical difference from acceptance.'
    when 5 then 'Students complete Live Classroom Questions 19-22 independently. Review domain-level results and record only unresolved gaps.'
    else s.instructor_actions
  end,
  student_actions=case s.sequence_number
    when 1 then 'Complete Live Classroom Questions 1-6, include units where requested, and stop after Question 6.'
    when 2 then 'Follow the whiteboard conversion model, verify each step, and ask questions before resuming the digital activity.'
    when 3 then 'Complete Live Classroom Questions 7-14 and correct only the conversion type identified by the instructor.'
    when 4 then 'Complete Live Classroom Questions 15-18 and use the print value, device value, units, and stated precision as evidence.'
    when 5 then 'Complete Live Classroom Questions 19-22 independently.'
    else s.student_actions
  end,
  updated_at=now()
from target_day t
where s.guide_day_id=t.id
  and s.sequence_number between 1 and 5;

-- Replace any prior staged Day 4 launcher with one locked planner-day Live Classroom resource.
with target_day as (
  select d.id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id and g.course_id=d.course_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.status='active'
    and d.planner_day_number=4
)
delete from public.course_guide_day_resources r
using target_day t
where r.guide_day_id=t.id
  and r.resource_url='/classroom/planner?assessment=wld205_pvhs_bridge_day4';

with target_day as (
  select d.id, d.school_id, d.course_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id and g.course_id=d.course_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.status='active'
    and d.planner_day_number=4
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
  'Launch Live Classroom - Day 4 Fraction/Decimal Shop Measurement',
  '/classroom/planner?assessment=wld205_pvhs_bridge_day4',
  'Primary Day 4 student activity. Students use their devices for retrieval, Decimal Shop Set A, measurement comparison, and the independent check. Instructor uses the whiteboard for the 8-20 minute model.',
  true,
  'native',
  'school_owned',
  true,
  now()
from target_day t;
