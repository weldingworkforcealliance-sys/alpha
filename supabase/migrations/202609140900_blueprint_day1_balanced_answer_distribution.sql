-- Blueprint Reading Day 1 answer-distribution correction.
-- Preserve the original blueprint_day1 module for any already-running classroom
-- sessions. New planner launches use a balanced v145 module instead.
-- The V-Groove reference image and all instructional content are copied forward.

begin;

insert into public.assessment_modules(
  slug,title,description,category,estimated_minutes,sort_order,version,active,
  instructions,allow_team_members,reference_title,reference_image_url,reference_body,show_student_score
)
select
  'blueprint_day1_balanced',title,description,category,estimated_minutes,sort_order,145,true,
  instructions,allow_team_members,reference_title,reference_image_url,reference_body,show_student_score
from public.assessment_modules
where slug='blueprint_day1'
on conflict (slug) do update set
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

delete from public.assessment_questions
where assessment_slug='blueprint_day1_balanced';

with targets(question_key,target_answer) as (
  values
    ('d1q1','B'),('d1q2','D'),('d1q3','A'),('d1q4','C'),('d1q5','B'),
    ('d1q6','A'),('d1q7','D'),('d1q8','C'),('d1q9','A'),('d1q10','B'),
    ('d1q11','C'),('d1q12','D'),('d1q13','B'),('d1q14','A'),('d1q15','D'),
    ('d1q16','C'),('d1q17','A'),('d1q18','D'),('d1q19','C'),('d1q20','B')
), src as (
  select
    q.*,
    t.target_answer,
    q.options->>q.correct_answer as correct_text,
    array(
      select e.value
      from jsonb_each_text(q.options) e
      where e.key<>q.correct_answer
      order by e.key
    ) as distractors
  from public.assessment_questions q
  join targets t on t.question_key=q.question_key
  where q.assessment_slug='blueprint_day1'
)
insert into public.assessment_questions(
  assessment_slug,question_key,question_number,question_type,question_text,
  domain,options,correct_answer,accepted_answers,explanation
)
select
  'blueprint_day1_balanced',
  question_key,
  question_number,
  question_type,
  question_text,
  domain,
  case target_answer
    when 'A' then jsonb_build_object('A',correct_text,'B',distractors[1],'C',distractors[2],'D',distractors[3])
    when 'B' then jsonb_build_object('A',distractors[1],'B',correct_text,'C',distractors[2],'D',distractors[3])
    when 'C' then jsonb_build_object('A',distractors[1],'B',distractors[2],'C',correct_text,'D',distractors[3])
    when 'D' then jsonb_build_object('A',distractors[1],'B',distractors[2],'C',distractors[3],'D',correct_text)
  end,
  target_answer,
  accepted_answers,
  explanation
from src
order by question_number;

update public.course_guide_day_resources
set resource_url='/classroom/planner?assessment=blueprint_day1_balanced'
where resource_url in (
    '/classroom?assessment=blueprint_day1',
    '/classroom/planner?assessment=blueprint_day1'
  )
  and resource_title='Launch Connected Test: Blueprint Reading — Day 1';

commit;
