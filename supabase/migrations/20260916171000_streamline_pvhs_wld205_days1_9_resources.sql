-- Streamline PVHS Level II WLD 205 Days 1-9 instructor resources.
-- Preserve curriculum and assessments; consolidate supporting materials into one packet per day where needed.

begin;

with target as (
  select cgd.id as guide_day_id,cgd.planner_day_number
  from public.course_guide_days cgd
  join public.course_guides cg on cg.id=cgd.guide_id
  join public.courses c on c.id=cg.course_id
  where c.course_code='WLD 205'
    and cg.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and cgd.planner_day_number between 1 and 9
)
update public.course_guide_day_resources r
set resource_type='website',
    sequence_number=1,
    resource_title=case t.planner_day_number when 1 then 'START HERE — Pre-Class Math Assessment' else 'START HERE — Day '||t.planner_day_number||' Live Classroom' end,
    resource_notes=case t.planner_day_number
      when 1 then 'Primary Day 1 launch. Runs the connected 20-minute diagnostic with QR join, automatic grading, live progress, and retained results.'
      else 'Primary teaching launch for PVHS WLD 205 Day '||t.planner_day_number||'. Use the Live Classroom as the control point for questions, progress, and results.' end,
    required=true
from target t
where r.guide_day_id=t.guide_day_id and r.resource_url like '/classroom%';

with target as (
  select cgd.id as guide_day_id,cgd.planner_day_number
  from public.course_guide_days cgd
  join public.course_guides cg on cg.id=cgd.guide_id
  join public.courses c on c.id=cg.course_id
  where c.course_code='WLD 205'
    and cg.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and cgd.planner_day_number in (3,5,6,7,8,9)
)
delete from public.course_guide_day_resources r
using target t
where r.guide_day_id=t.guide_day_id and r.resource_url not like '/classroom%';

with d as (
  select cgd.id,cgd.school_id,cgd.course_id,cgd.planner_day_number
  from public.course_guide_days cgd
  join public.course_guides cg on cg.id=cgd.guide_id
  join public.courses c on c.id=cg.course_id
  where c.course_code='WLD 205'
    and cg.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and cgd.planner_day_number in (3,5,6,7,8,9)
), vals(day_no,title,url,notes) as (
  values
  (3,'Day 3 Blueprint Recovery Packet','/resources/wld205/pvhs-day3-blueprint-recovery-packet.html','Single student/instructor packet containing line-type reference, Training Plate A, FRAME-A, and the print-to-part worksheet in teaching order.'),
  (5,'Day 5 Weld Symbols + Source Control Packet','/resources/wld205/pvhs-day5-weld-symbol-source-control-packet.html','Single packet containing joint cards, symbol practice, Bridge Print B, and the Print vs. WPS/SWPS worksheet.'),
  (6,'Day 6 Material Properties Packet','/resources/wld205/pvhs-day6-material-properties-packet.html','Single packet containing property cards, comparison matrix, material-behavior scenarios, and the optional observation sheet.'),
  (7,'Day 7 Tolerance Practice Packet','/resources/wld205/pvhs-day7-tolerance-practice-packet.html','Single packet containing Tolerance Cards, Tolerance Set A, and the required Mock Measurement + Corrective/Recheck Record.'),
  (8,'Day 8 HAZ + Heat Effects Packet','/resources/wld205/pvhs-day8-haz-heat-effects-packet.html','Single packet containing weld/HAZ/base-metal retrieval, HAZ observation cards, heat-effect map, and optional observation sheet.'),
  (9,'Day 9 Integrated Readiness Packet','/resources/wld205/pvhs-day9-integrated-readiness-packet.html','Single packet containing targeted repair stations, BASE-C, integrated worksheet, parallel recheck bank, and readiness record.')
)
insert into public.course_guide_day_resources
(school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,resource_notes,required,student_safe)
select d.school_id,d.course_id,d.id,10,'handout',v.title,v.url,v.notes,true,true
from d join vals v on v.day_no=d.planner_day_number;

with target as (
  select cgd.id as guide_day_id
  from public.course_guide_days cgd
  join public.course_guides cg on cg.id=cgd.guide_id
  join public.courses c on c.id=cg.course_id
  where c.course_code='WLD 205'
    and cg.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and cgd.planner_day_number=4
)
delete from public.course_guide_day_resources r
using target t
where r.guide_day_id=t.guide_day_id and r.resource_url='/live-activities/wld205-day4-instructor-guide.html';

with target as (
  select cgd.id as guide_day_id
  from public.course_guide_days cgd
  join public.course_guides cg on cg.id=cgd.guide_id
  join public.courses c on c.id=cg.course_id
  where c.course_code='WLD 205'
    and cg.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and cgd.planner_day_number=4
)
update public.course_guide_day_resources r
set resource_type='handout',resource_title='Day 4 Decimal Student Pack',sequence_number=10,required=true,
    resource_notes='Single Day 4 practice packet for fraction/decimal retrieval, Decimal Shop Set A, measurement record, and rounding/tolerance preview.'
from target t
where r.guide_day_id=t.guide_day_id and r.resource_url='/live-activities/wld205-day4-decimal-student-pack.html';

update public.course_guide_days cgd
set materials_equipment=case planner_day_number
  when 1 then 'Pre-Class Welding Math Assessment; Safety Reset Checklist; ruler/tape measure; calculator only where allowed.'
  when 2 then 'Day 2 Live Classroom; ruler/tape measure; whiteboard; calculator only where allowed.'
  when 3 then 'Day 3 Blueprint Recovery Packet; matching physical plate/model; ruler/tape; authorized drawing/source references; approved WPS/SWPS where cited.'
  when 4 then 'Day 4 Live Classroom; Day 4 Decimal Student Pack; whiteboard; ruler/tape; caliper where available; authorized conversion/tolerance source.'
  when 5 then 'Day 5 Live Classroom; Day 5 Weld Symbols + Source Control Packet; authorized PCCC/AWS welding-symbol reference; instructor-approved WPS/SWPS example.'
  when 6 then 'Day 6 Live Classroom; Day 6 Material Properties Packet; authorized material/source reference; instructor-provided samples/photos if used.'
  when 7 then 'Day 7 Live Classroom; Day 7 Tolerance Practice Packet; approved print/tolerance source.'
  when 8 then 'Day 8 Live Classroom; Day 8 HAZ + Heat Effects Packet; authorized metallurgy/material source; instructor-provided samples/coupons/photos if used.'
  when 9 then 'Day 9 Live Classroom; Day 9 Integrated Readiness Packet; authorized drawing/symbol/material references; approved WPS/SWPS examples where cited.'
  else materials_equipment end
from public.course_guides cg, public.courses c
where cgd.guide_id=cg.id and cg.course_id=c.id
  and c.course_code='WLD 205'
  and cg.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
  and cgd.planner_day_number between 1 and 9;

commit;