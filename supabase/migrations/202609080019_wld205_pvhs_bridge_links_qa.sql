-- Link Days 2-9 to the current PVHS WLD-205 guide and verify bundle counts.
with target_guide as (
  select d.guide_id
  from public.course_guide_days d
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and d.planner_day_number=2
    and d.title='PVHS Bridge - Math Recovery I: Measurement, Fractions + Mixed Numbers'
),
links(day_number,assessment_slug,button_title) as (
  values
  (2,'wld205_pvhs_bridge_day2','Launch Live Class Activity: Day 2'),
  (3,'wld205_pvhs_bridge_day3','Launch Live Class Activity: Day 3'),
  (4,'wld205_pvhs_bridge_day4','Launch Live Class Activity: Day 4'),
  (5,'wld205_pvhs_bridge_day5','Launch Live Class Activity: Day 5'),
  (6,'wld205_pvhs_bridge_day6','Launch Live Class Activity: Day 6'),
  (7,'wld205_pvhs_bridge_day7','Launch Live Class Activity: Day 7'),
  (8,'wld205_pvhs_bridge_day8','Launch Live Class Activity: Day 8'),
  (9,'wld205_pvhs_bridge_day9','Launch Live Class Activity: Day 9')
)
insert into public.course_guide_day_resources(
  school_id,course_id,guide_day_id,sequence_number,
  resource_type,resource_title,resource_url,resource_notes,
  required,integration_mode,rights_basis,student_safe,license_notes
)
select
  d.school_id,d.course_id,d.id,90,
  'other',
  l.button_title,
  '/classroom/planner?assessment=' || l.assessment_slug,
  'Instructor-only locked launch for the Day ' || l.day_number ||
    ' WLD-205 PVHS Bridge live activity. Creates a fresh QR student session with automatic grading and live progress.',
  true,'native','school_owned',false,
  'Original PCCC bridge activity. Authorized/licensed external sources named by the lesson remain controlling and are not reproduced.'
from public.course_guide_days d
join target_guide tg on tg.guide_id=d.guide_id
join links l on l.day_number=d.planner_day_number
where d.planner_day_number between 2 and 9
on conflict(guide_day_id,sequence_number) do update set
  resource_type=excluded.resource_type,
  resource_title=excluded.resource_title,
  resource_url=excluded.resource_url,
  resource_notes=excluded.resource_notes,
  required=excluded.required,
  integration_mode=excluded.integration_mode,
  rights_basis=excluded.rights_basis,
  student_safe=excluded.student_safe,
  license_notes=excluded.license_notes,
  updated_at=now();

-- Bundle QA guards.
do $$
declare
  module_count integer;
  question_count integer;
  link_count integer;
begin
  select count(*) into module_count
  from public.assessment_modules
  where slug in ('wld205_pvhs_bridge_day2', 'wld205_pvhs_bridge_day3', 'wld205_pvhs_bridge_day4', 'wld205_pvhs_bridge_day5', 'wld205_pvhs_bridge_day6', 'wld205_pvhs_bridge_day7', 'wld205_pvhs_bridge_day8', 'wld205_pvhs_bridge_day9');
  if module_count <> 8 then
    raise exception 'Expected 8 bridge assessment modules; found %', module_count;
  end if;

  select count(*) into question_count
  from public.assessment_questions
  where assessment_slug in ('wld205_pvhs_bridge_day2', 'wld205_pvhs_bridge_day3', 'wld205_pvhs_bridge_day4', 'wld205_pvhs_bridge_day5', 'wld205_pvhs_bridge_day6', 'wld205_pvhs_bridge_day7', 'wld205_pvhs_bridge_day8', 'wld205_pvhs_bridge_day9');
  if question_count <> 115 then
    raise exception 'Expected 115 bridge questions; found %', question_count;
  end if;

  select count(*) into link_count
  from public.course_guide_day_resources r
  join public.course_guide_days d on d.id=r.guide_day_id
  where d.guide_id=(
    select d2.guide_id
    from public.course_guide_days d2
    join public.courses c2 on c2.id=d2.course_id
    where c2.course_code='WLD 205'
      and d2.planner_day_number=2
      and d2.title='PVHS Bridge - Math Recovery I: Measurement, Fractions + Mixed Numbers'
  )
    and d.planner_day_number between 2 and 9
    and r.sequence_number=90
    and r.resource_url like '/classroom/planner?assessment=wld205_pvhs_bridge_day%';
  if link_count <> 8 then
    raise exception 'Expected 8 planner live-activity links; found %', link_count;
  end if;
end
$$;
