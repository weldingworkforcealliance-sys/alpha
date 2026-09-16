-- PVHS WLD 205 Day 8: fold the HAZ + Heat Effects packet into the Live Classroom.
-- Protected course outcomes are unchanged.

update public.assessment_modules
set title='PVHS Level II · Day 8 Live Classroom — Heat, HAZ + Observable Change',
    description='Single-room PVHS Level II Day 8 experience: identify weld/HAZ/base-metal regions, use observation/source-control reasoning, connect heat conditions to supported concerns, then complete the independent 12-question check.',
    instructions='USE THIS LIVE CLASSROOM AS THE ONLY DAY 8 TEACHING LAUNCH.\n\nSTEP 1 · 0–8 MIN — IDENTIFY THE REGION\nUse the combined board. Students label weld metal, HAZ, and unaffected base metal, then complete Questions 1–3.\n\nSTEP 2 · 8–20 MIN — CONNECT HEAT TO THE HAZ\nReinforce that the HAZ is unmelted base metal changed by the welding thermal cycle. Do not pre-teach the later formal transformation metallurgy block.\n\nSTEP 3 · 20–52 MIN — OBSERVE + CHECK SOURCE\nUse the three scenario cards and heat-effect map built into the board for Questions 4–9. Require IDENTIFY/OBSERVE → CHECK SOURCE → STATE ONLY WHAT THE EVIDENCE SUPPORTS.\n\nSTEP 4 · 52–60 MIN — INDEPENDENT EXIT CHECK\nQuestions 10–12 are independent. No coaching. Record only the unresolved domain.\n\nDo not claim exact hardness, microstructure, cause, grade/alloy, procedure value, or acceptance requirement from appearance alone.',
    reference_title='Day 8 — Heat, HAZ + Observable Change · Complete Live Classroom Board',
    reference_image_url='/live-activities/wld205-day8-live-classroom-board.svg',
    reference_body='This board replaces the separate Day 8 packet. It contains the weld/HAZ/base-metal retrieval, HAZ observation scenarios, heat-effect cause/consequence map, and the observation/source-control response frame. Use it in teaching order with the existing 12-question Live Classroom.',
    estimated_minutes=60,
    active=true
where slug='wld205_pvhs_bridge_day8';

with target_day as (
  select cgd.id
  from public.course_guide_days cgd
  join public.course_guides cg on cg.id=cgd.guide_id
  where cg.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and cgd.planner_day_number=8
  limit 1
)
delete from public.course_guide_day_resources
where guide_day_id=(select id from target_day)
  and resource_url='/resources/wld205/pvhs-day8-haz-heat-effects-packet.html';

with target_day as (
  select cgd.id
  from public.course_guide_days cgd
  join public.course_guides cg on cg.id=cgd.guide_id
  where cg.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and cgd.planner_day_number=8
  limit 1
)
update public.course_guide_day_resources
set sequence_number=1,
    resource_title='START HERE — Day 8 Live Classroom: Heat, HAZ + Observable Change',
    resource_type='website',
    resource_notes='Single Day 8 teaching room. The combined board now contains the former HAZ + Heat Effects packet content plus the existing 12-question Live Classroom, progress tracking, and results.',
    required=true
where guide_day_id=(select id from target_day)
  and resource_url='/classroom/planner?assessment=wld205_pvhs_bridge_day8';

update public.course_guide_days cgd
set materials_equipment='START HERE: Day 8 Live Classroom. The embedded complete board contains the weld/HAZ/base-metal retrieval, observation scenarios, heat-effect map, and source-control response frame. Use an authorized metallurgy/material source as needed. Instructor-provided samples/coupons/photos are optional.'
from public.course_guides cg
where cgd.guide_id=cg.id
  and cg.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
  and cgd.planner_day_number=8;