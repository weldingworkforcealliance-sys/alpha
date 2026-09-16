-- Day Level II WLD205 Day 2: split into 40 min theory + 20 min math with Live Classroom.
begin;

delete from public.course_guide_day_segments
where guide_day_id='cc81656c-d5d3-4f3b-a8ad-7213ffabda3c' and sequence_number=4;

insert into public.course_guide_day_math
(id,school_id,course_id,guide_day_id,math_day_number,title,planned_minutes,book_connection,goal,instructor_notes,answers_quick_check,guide_id,created_at,updated_at)
values (
  gen_random_uuid(),'08ccb452-83ab-482f-bb28-5576e02741b2','39af66f5-d352-416d-9a1d-594e21bb1c41','cc81656c-d5d3-4f3b-a8ad-7213ffabda3c',1,
  'Whole Numbers + Fraction Sense',20,'Chasan Units 1-5, pp. 2-29',
  'Use whole numbers, common fractions, and mixed numbers accurately in shop dimensions and quantity calculations.',
  'Standing Level II method: GIVEN -> OPERATION/FORMULA -> WORK -> ANSWER WITH UNIT -> CHECK. Use original PCCC welding/fabrication examples and the licensed source pages; do not reproduce textbook exercises. Reserve the final 10 minutes for the connected Math Day 1 Live Classroom and use item-level misses for targeted reteach.',
  'Instructor checks operation choice, visible work, correct unit, fraction/mixed-number handling, and reasonableness. Final check is the 10-question auto-graded WLD 205 Math Day 1 Live Classroom; answer key and scoring remain in LTG.',
  '99e7cca0-e941-431f-96d4-3b932d014362',now(),now()
)
on conflict do nothing;

with m as (
  select id from public.course_guide_day_math
  where guide_day_id='cc81656c-d5d3-4f3b-a8ad-7213ffabda3c' and math_day_number=1 limit 1
)
insert into public.course_guide_day_math_segments
(id,math_lesson_id,sequence_number,start_minute,end_minute,planned_minutes,activity,segment_type,created_at,master_slot_key)
select gen_random_uuid(),m.id,v.sequence_number,v.start_minute,v.end_minute,v.planned_minutes,v.activity,v.segment_type,now(),gen_random_uuid()
from m cross join (values
  (1,40,42,2,'Start: Estimate a simple stock/quantity problem and identify what operation is needed before calculating. Then identify numerator and denominator in one common shop fraction.','opening'),
  (2,42,46,4,'Show: Model one original PCCC whole-number example and one fraction/mixed-number example using GIVEN -> OPERATION/FORMULA -> WORK -> ANSWER WITH UNIT -> CHECK.','instruction'),
  (3,46,50,4,'Students practice: Solve one quantity/stock-length item plus one simplify/add/subtract fraction item. Require visible work and units; correct one misconception before launch.','guided_practice'),
  (4,50,60,10,'Launch Live Classroom — Math Day 1: Whole Numbers + Fraction Sense. Complete the 10-question auto-graded assessment. Instructor monitors completion and uses item-level misses for targeted reteach.','assessment')
) v(sequence_number,start_minute,end_minute,planned_minutes,activity,segment_type)
where not exists (select 1 from public.course_guide_day_math_segments s where s.math_lesson_id=m.id and s.sequence_number=v.sequence_number);

insert into public.assessment_modules
(slug,title,description,category,estimated_minutes,sort_order,version,active,instructions,allow_team_members,reference_title,reference_image_url,reference_body,show_student_score)
values (
  'wld205_math_day1_whole_fraction','WLD 205 Live Classroom — Math Day 1: Whole Numbers + Fraction Sense',
  'Level II Math Day 1: whole-number operations, fraction sense, mixed numbers, shop quantities, and unit-aware fabrication math.',
  'Welding Math',20,20501,1,true,
  'Use GIVEN -> OPERATION/FORMULA -> WORK -> ANSWER WITH UNIT -> CHECK. Complete all 10 questions independently.',false,
  'Math Day 1 — Whole Numbers + Fraction Sense',null,
  'Use the licensed Chasan Units 1-5 reference and original PCCC examples during instruction. For the assessment, show the operation, keep units with measurements, simplify fractions fully, and check whether the answer is reasonable.',true
)
on conflict (slug) do update set title=excluded.title,description=excluded.description,category=excluded.category,estimated_minutes=excluded.estimated_minutes,version=public.assessment_modules.version+1,active=true,instructions=excluded.instructions,reference_title=excluded.reference_title,reference_image_url=null,reference_body=excluded.reference_body,show_student_score=true;

delete from public.assessment_questions where assessment_slug='wld205_math_day1_whole_fraction';
insert into public.assessment_questions
(id,assessment_slug,question_key,question_number,question_type,question_text,domain,options,correct_answer,accepted_answers,explanation)
values
(gen_random_uuid(),'wld205_math_day1_whole_fraction','m1q01',1,'mc','Eight frame members are each 14 in long. What total stock length is required?','Whole Numbers',jsonb_build_object('A','98 in','B','104 in','C','112 in','D','124 in'),'C',null,'8 × 14 = 112 in.'),
(gen_random_uuid(),'wld205_math_day1_whole_fraction','m1q02',2,'mc','A 144 in stock length is cut into equal 36 in pieces. How many full pieces can be made?','Whole Numbers',jsonb_build_object('A','3','B','5','C','6','D','4'),'D',null,'144 ÷ 36 = 4 pieces.'),
(gen_random_uuid(),'wld205_math_day1_whole_fraction','m1q03',3,'mc','Which fraction is equivalent to 12/16?','Fractions',jsonb_build_object('A','3/4','B','2/3','C','5/8','D','7/8'),'A',null,'12/16 reduces to 3/4.'),
(gen_random_uuid(),'wld205_math_day1_whole_fraction','m1q04',4,'mc','What is 2 1/2 in + 1 3/4 in?','Mixed Numbers',jsonb_build_object('A','3 1/4 in','B','4 1/4 in','C','4 3/4 in','D','5 1/4 in'),'B',null,'2 1/2 + 1 3/4 = 4 1/4 in.'),
(gen_random_uuid(),'wld205_math_day1_whole_fraction','m1q05',5,'mc','What is 8 1/2 in - 3 3/4 in?','Mixed Numbers',jsonb_build_object('A','4 1/4 in','B','5 1/4 in','C','4 3/4 in','D','5 3/4 in'),'C',null,'8 1/2 - 3 3/4 = 4 3/4 in.'),
(gen_random_uuid(),'wld205_math_day1_whole_fraction','m1q06',6,'mc','Which measurement is greater?','Fractions',jsonb_build_object('A','5/8 in','B','3/4 in','C','They are equal','D','7/8 in'),'D',null,'7/8 in is greater than 3/4 in.'),
(gen_random_uuid(),'wld205_math_day1_whole_fraction','m1q07',7,'mc','Convert 5/4 to a mixed number.','Fractions',jsonb_build_object('A','1 1/4','B','1 1/2','C','1 3/4','D','2 1/4'),'A',null,'5 ÷ 4 = 1 remainder 1, so 1 1/4.'),
(gen_random_uuid(),'wld205_math_day1_whole_fraction','m1q08',8,'mc','Four brackets each require 1 1/4 in of a spacer strip. What total length is required?','Applied Math',jsonb_build_object('A','4 1/4 in','B','5 in','C','5 1/4 in','D','6 in'),'B',null,'4 × 1 1/4 = 5 in.'),
(gen_random_uuid(),'wld205_math_day1_whole_fraction','m1q09',9,'mc','A 7 1/2 in length is divided into 3 equal sections. What is each section length?','Applied Math',jsonb_build_object('A','2 in','B','2 1/4 in','C','2 1/2 in','D','2 3/4 in'),'C',null,'7 1/2 ÷ 3 = 2 1/2 in.'),
(gen_random_uuid(),'wld205_math_day1_whole_fraction','m1q10',10,'mc','A job needs 96 identical fasteners packed 12 per box. How many full boxes are required?','Whole Numbers',jsonb_build_object('A','6','B','7','C','9','D','8'),'D',null,'96 ÷ 12 = 8 boxes.');

delete from public.course_guide_day_resources where guide_day_id='cc81656c-d5d3-4f3b-a8ad-7213ffabda3c' and (resource_title='WLD 205 Shared-Pacing Synchronization' or resource_url is null);

insert into public.course_guide_day_resources
(id,school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,resource_notes,required,created_at,source_id,integration_mode,rights_basis,external_resource_id,outcome_id,student_safe,license_notes,updated_at)
select gen_random_uuid(),'08ccb452-83ab-482f-bb28-5576e02741b2','39af66f5-d352-416d-9a1d-594e21bb1c41','cc81656c-d5d3-4f3b-a8ad-7213ffabda3c',3,'website',
  'Welding Math Live Classroom — Math Day 1: Whole Numbers + Fraction Sense','/classroom/planner?assessment=wld205_math_day1_whole_fraction',
  'Required final 10-minute Math Day 1 Live Classroom. Uses original LTG/PCCC assessment items; licensed textbook pages are referenced but not reproduced.',true,now(),null,'native','school_owned',null,null,false,
  'Original PCCC/LTG assessment items. Licensed Chasan source is referenced for instruction only and is not reproduced.',now()
where not exists (select 1 from public.course_guide_day_resources where guide_day_id='cc81656c-d5d3-4f3b-a8ad-7213ffabda3c' and resource_url='/classroom/planner?assessment=wld205_math_day1_whole_fraction');

update public.course_guide_days set materials_equipment='WLD 205 theory support: Days 10–33 Instructor Guide — Day 11; Source→Calculate→Verify student record; authorized daily print/source. Welding Math Day 1: licensed Chasan Units 1–5 reference, original PCCC examples, calculator/measuring tools as allowed, and connected Math Day 1 Live Classroom.',updated_at=now() where id='cc81656c-d5d3-4f3b-a8ad-7213ffabda3c';

commit;
