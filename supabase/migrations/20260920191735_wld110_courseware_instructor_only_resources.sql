-- Keep purchased instructor courseware out of the existing student display.
-- Only resource audience metadata changes; preserve URLs, mappings and curriculum.
update public.course_guide_day_resources r
set student_safe=false,
    license_notes='Instructor-only use of PCCC-purchased courseware. Students use their separate AWS learning resources.',
    updated_at=now()
from public.course_guide_days d
join public.course_guides g on g.id=d.guide_id
join public.courses c on c.id=d.course_id
where r.guide_day_id=d.id
  and c.school_id='08ccb452-83ab-482f-bb28-5576e02741b2'::uuid
  and c.course_code='WLD 110'
  and g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
  and d.planner_day_number between 1 and 23
  and r.sequence_number in (1,2,3)
  and r.resource_url in (
    '/resources/wld110/ofc-shop-reference.html#day-'||d.planner_day_number,
    '/resources/wld110/smaw-shop-reference.html#day-'||d.planner_day_number,
    '/resources/wld110/welding-safety-courseware-guide.html#day-'||d.planner_day_number
  );
