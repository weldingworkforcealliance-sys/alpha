-- PCCC Day Level II full instructional release.
--
-- Clears REVIEW MODE holds for the already-activated WLD 205 / WLD 210
-- sections while preserving Day 1 as the current planner day and leaving
-- started_at NULL until instruction actually begins.

begin;

update public.section_progress sp
set manual_hold = false,
    hold_reason = null,
    current_planner_day_number = 1,
    started_at = null,
    last_advanced_at = null,
    completed_at = null,
    updated_at = now()
from public.sections sec
join public.schools s on s.id = sec.school_id
where sp.section_id = sec.id
  and s.name = 'Passaic County Community College'
  and sec.section_code in (
    'PCCC-DAY-L2-WLD205-2627',
    'PCCC-DAY-L2-WLD210-2627'
  );

commit;
