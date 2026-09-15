-- Restore the missing WLD 105 Build Fraction Sense lesson-card link.
-- Applies to both active WLD 105 guides without changing curriculum content.

update public.course_guide_day_resources r
set resource_url = '/resources/wld105/build-fraction-sense-math-card.html',
    integration_mode = 'native',
    rights_basis = 'school_owned',
    student_safe = true,
    updated_at = now()
from public.course_guide_days d
join public.course_guides g on g.id = d.guide_id
where r.guide_day_id = d.id
  and g.status = 'active'
  and lower(g.guide_name) like '%wld 105%'
  and d.planner_day_number = 7
  and r.resource_title = 'Welding Math Lesson Card — Build Fraction Sense';

do $$
declare
  fixed_count integer;
begin
  select count(*) into fixed_count
  from public.course_guide_day_resources r
  join public.course_guide_days d on d.id = r.guide_day_id
  join public.course_guides g on g.id = d.guide_id
  where g.status = 'active'
    and lower(g.guide_name) like '%wld 105%'
    and d.planner_day_number = 7
    and r.resource_title = 'Welding Math Lesson Card — Build Fraction Sense'
    and r.resource_url = '/resources/wld105/build-fraction-sense-math-card.html';

  if fixed_count <> 2 then
    raise exception 'Expected 2 active WLD 105 Build Fraction Sense links; found %', fixed_count;
  end if;
end $$;