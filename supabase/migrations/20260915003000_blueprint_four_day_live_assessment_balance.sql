-- Canonicalize and validate the four Blueprint Reading live assessments.
-- Correct answer text is preserved; only the A/B/C/D position is redistributed.
-- Do not mutate a Blueprint assessment while students are actively taking it.

begin;

do $$
begin
  if exists (
    select 1
    from public.classroom_sessions
    where status='active'
      and assessment_slug in (
        'blueprint_day1','blueprint_day1_balanced',
        'blueprint_day2','blueprint_day3','blueprint_day4'
      )
  ) then
    raise exception 'Blueprint assessment migration blocked: an active Blueprint classroom session exists';
  end if;
end
$$;

-- Day 1 already has a verified balanced v145 copy. Promote that key back onto
-- the canonical slug so instructors and the public demo use one stable name.
update public.assessment_questions q
set options=b.options,
    correct_answer=b.correct_answer,
    accepted_answers=b.accepted_answers,
    explanation=b.explanation
from public.assessment_questions b
where q.assessment_slug='blueprint_day1'
  and b.assessment_slug='blueprint_day1_balanced'
  and b.question_key=q.question_key;

update public.course_guide_day_resources
set resource_url=replace(resource_url,'blueprint_day1_balanced','blueprint_day1')
where resource_url like '%blueprint_day1_balanced%';

update public.assessment_modules
set version=146, active=true
where slug='blueprint_day1';

update public.assessment_modules
set active=false
where slug='blueprint_day1_balanced';

-- Days 2-4 use deterministic, balanced answer positions. The correct answer
-- text is read from the current keyed answer before any option is moved.
with targets(assessment_slug,question_key,target_answer) as (
  values
    ('blueprint_day2','d2q1','A'),('blueprint_day2','d2q2','B'),('blueprint_day2','d2q3','A'),('blueprint_day2','d2q4','A'),('blueprint_day2','d2q5','D'),
    ('blueprint_day2','d2q6','B'),('blueprint_day2','d2q7','C'),('blueprint_day2','d2q8','B'),('blueprint_day2','d2q9','A'),('blueprint_day2','d2q10','C'),
    ('blueprint_day2','d2q11','D'),('blueprint_day2','d2q12','C'),('blueprint_day2','d2q13','B'),('blueprint_day2','d2q14','B'),('blueprint_day2','d2q15','D'),
    ('blueprint_day2','d2q16','C'),('blueprint_day2','d2q17','A'),('blueprint_day2','d2q18','C'),('blueprint_day2','d2q19','D'),('blueprint_day2','d2q20','D'),

    ('blueprint_day3','d3q1','D'),('blueprint_day3','d3q2','D'),('blueprint_day3','d3q3','B'),('blueprint_day3','d3q4','C'),('blueprint_day3','d3q5','A'),
    ('blueprint_day3','d3q6','B'),('blueprint_day3','d3q7','C'),('blueprint_day3','d3q8','C'),('blueprint_day3','d3q9','A'),('blueprint_day3','d3q10','D'),
    ('blueprint_day3','d3q11','C'),('blueprint_day3','d3q12','A'),('blueprint_day3','d3q13','A'),('blueprint_day3','d3q14','C'),('blueprint_day3','d3q15','B'),
    ('blueprint_day3','d3q16','B'),('blueprint_day3','d3q17','A'),('blueprint_day3','d3q18','B'),('blueprint_day3','d3q19','D'),('blueprint_day3','d3q20','D'),

    ('blueprint_day4','d4q1','B'),('blueprint_day4','d4q2','B'),('blueprint_day4','d4q3','A'),('blueprint_day4','d4q4','D'),('blueprint_day4','d4q5','D'),
    ('blueprint_day4','d4q6','A'),('blueprint_day4','d4q7','C'),('blueprint_day4','d4q8','B'),('blueprint_day4','d4q9','D'),('blueprint_day4','d4q10','A'),
    ('blueprint_day4','d4q11','D'),('blueprint_day4','d4q12','B'),('blueprint_day4','d4q13','C'),('blueprint_day4','d4q14','B'),('blueprint_day4','d4q15','C'),
    ('blueprint_day4','d4q16','A'),('blueprint_day4','d4q17','A'),('blueprint_day4','d4q18','C'),('blueprint_day4','d4q19','C'),('blueprint_day4','d4q20','D')
), src as (
  select
    q.assessment_slug,
    q.question_key,
    t.target_answer,
    q.options->>q.correct_answer as correct_text,
    array(
      select e.value
      from jsonb_each_text(q.options) e
      where e.key<>q.correct_answer
      order by e.key
    ) as distractors
  from public.assessment_questions q
  join targets t
    on t.assessment_slug=q.assessment_slug
   and t.question_key=q.question_key
)
update public.assessment_questions q
set options=case src.target_answer
      when 'A' then jsonb_build_object('A',src.correct_text,'B',src.distractors[1],'C',src.distractors[2],'D',src.distractors[3])
      when 'B' then jsonb_build_object('A',src.distractors[1],'B',src.correct_text,'C',src.distractors[2],'D',src.distractors[3])
      when 'C' then jsonb_build_object('A',src.distractors[1],'B',src.distractors[2],'C',src.correct_text,'D',src.distractors[3])
      when 'D' then jsonb_build_object('A',src.distractors[1],'B',src.distractors[2],'C',src.distractors[3],'D',src.correct_text)
    end,
    correct_answer=src.target_answer
from src
where q.assessment_slug=src.assessment_slug
  and q.question_key=src.question_key;

update public.assessment_modules
set version=146, active=true
where slug in ('blueprint_day2','blueprint_day3','blueprint_day4');

-- Keep the Day 3 and Day 4 class whiteboards connected to the live assessment.
update public.assessment_modules
set reference_title='Blueprint Reading Day 3 — Welding Symbols and Basic Joints',
    reference_image_url='/live-activities/blueprint-day3-symbols-joints-board.svg',
    reference_body='Use the class whiteboard to identify the reference line, arrow, tail, arrow-side/other-side placement, all-around and field-weld indicators, and the five basic joint types before answering the assessment items.'
where slug='blueprint_day3';

update public.assessment_modules
set reference_title='Blueprint Reading Day 4 — Fillet, Groove, and Full Review',
    reference_image_url='/live-activities/blueprint-day4-fillet-groove-review-board.svg',
    reference_body='Use the review board with the assigned Motor Adaptor Bracket and Robot Table material. Confirm fillet versus groove information, dimensions and tolerances, reference dimensions, TYP notes, contour, both-sides information, and joint preparation before answering.'
where slug='blueprint_day4';

-- Fail loudly if a future seed/deploy ever recreates a broken assessment.
do $$
declare
  r record;
begin
  for r in
    select
      m.slug,
      count(q.*) as question_count,
      count(*) filter(where q.correct_answer='A') as a_count,
      count(*) filter(where q.correct_answer='B') as b_count,
      count(*) filter(where q.correct_answer='C') as c_count,
      count(*) filter(where q.correct_answer='D') as d_count,
      count(*) filter(where q.options->>q.correct_answer is null or btrim(q.options->>q.correct_answer)='') as missing_keyed_text,
      count(*) filter(where (select count(*) from jsonb_object_keys(q.options))<>4) as bad_option_count
    from public.assessment_modules m
    left join public.assessment_questions q on q.assessment_slug=m.slug
    where m.slug in ('blueprint_day1','blueprint_day2','blueprint_day3','blueprint_day4')
    group by m.slug
  loop
    if r.question_count<>20
       or r.a_count<>5 or r.b_count<>5 or r.c_count<>5 or r.d_count<>5
       or r.missing_keyed_text<>0 or r.bad_option_count<>0 then
      raise exception 'Blueprint assessment validation failed for %: questions %, A/B/C/D %/%/%/%, missing keyed %, bad options %',
        r.slug,r.question_count,r.a_count,r.b_count,r.c_count,r.d_count,r.missing_keyed_text,r.bad_option_count;
    end if;
  end loop;
end
$$;

commit;
