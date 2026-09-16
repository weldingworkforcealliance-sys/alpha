-- PVHS WLD 205 Day 7: merge tolerance packet into the Live Classroom reference.
-- Protected curriculum/outcomes unchanged.

update public.assessment_modules
set title='PVHS Level II · Day 7 Live Classroom — Tolerances + Accept/Reject',
    reference_title='Day 7 — Tolerances + Accept/Reject · Complete Live Classroom Board',
    reference_image_url='/live-activities/wld205-day7-live-classroom-board.svg',
    reference_body='Use this one Live Classroom board for the full Day 7 sequence: tolerance cards, guided accept/reject cases, mock measurement/recheck documentation, and independent exit check. Standing rule: NOMINAL → LIMITS → ACTUAL → DECISION → DOCUMENT when action is required. The approved print/tolerance source controls real work.'
where slug='wld205_pvhs_bridge_day7';

with pvhs_day7 as (
  select d.id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=g.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and d.planner_day_number=7
)
delete from public.course_guide_day_resources r
using pvhs_day7 p
where r.guide_day_id=p.id
  and r.resource_url='/resources/wld205/pvhs-day7-tolerance-practice-packet.html';

with pvhs_day7 as (
  select d.id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=g.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and d.planner_day_number=7
)
update public.course_guide_day_resources r
set resource_title='START HERE — Day 7 Live Classroom: Tolerances + Accept/Reject',
    resource_notes='Single teaching launch for PVHS WLD 205 Day 7. The Live Classroom now contains the tolerance cards, guided tolerance set, mock measurement/recheck record, questions, progress, and results.'
from pvhs_day7 p
where r.guide_day_id=p.id
  and r.resource_url like '/classroom/planner?assessment=wld205_pvhs_bridge_day7%';