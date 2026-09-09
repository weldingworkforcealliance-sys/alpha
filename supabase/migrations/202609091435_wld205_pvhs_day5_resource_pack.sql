-- Stage the original PCCC/LTG WLD 205 PVHS Day 5 resource pack.
-- This migration adds only school-owned bridge materials. It does NOT copy or replace
-- the authorized PCCC/AWS welding-symbol reference or any approved WPS/SWPS.

with target as (
  select d.id as guide_day_id, d.school_id, d.course_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active'
    and d.planner_day_number=5
  order by g.updated_at desc
  limit 1
)
update public.course_guide_days d
set
  instructor_prep='BEFORE CLASS: Print/open the Day 5 Joint-Type Cards, Symbol-to-Joint Cards, Bridge Print B, Print vs. WPS/SWPS worksheet, and instructor key. Stage the authorized PCCC/AWS welding-symbol reference and an instructor-approved WPS/SWPS example separately. Do not substitute LTG practice graphics for the authorized symbol standard or invent procedure values.',
  opening_review='0–8 min — Joint-Type Retrieval: Use the five Joint-Type Cards. Students identify butt, lap, T-joint, corner, and edge relationships and sketch the member relationship. Correction cue: name the joint first; do not name a weld the print has not specified.',
  demonstration='8–20 min — Authorized Symbol-Source Model: Keep the authorized PCCC/AWS classroom reference visible. Model the reading order: arrow → reference line → basic symbol → side/location → size/length → tail/notes. Use one arrow-side example, one other-side example, and one size-information example. Exact symbol meaning comes from the authorized source.',
  guided_practice='20–40 min — Symbol-to-Joint Cards: Students work the six original LTG cards. Require them to identify the joint/location, consult the authorized reference for exact symbol convention, and state when another controlling source is required. Missing or unclear information = STOP / CHECK, never invent.',
  independent_practice='40–54 min — Bridge Print B / BRACKET-B: Students locate the base plate, vertical plate, T-joint, dimensions, drawing note, and weld location/information actually shown. Complete the Print vs. WPS/SWPS worksheet to separate information controlled by the print from procedure information controlled by the approved WPS/SWPS.',
  assessment='54–60 min — Symbol Exit: Complete the live Day 5 exit independently. Use results to identify the remaining domain only: Joint Type, Symbol Navigation, Source Control, or Print vs. Procedure.',
  instructor_checks='Instructor Rule: Identify → Find the source → Read only what is specified → Stop when information is missing. Remediate only the failed domain with one parallel example, then require an independent recheck. Do not repeat a domain already demonstrated successfully.',
  materials_equipment='Day 5 Joint-Type Cards; six Symbol-to-Joint Cards; Bridge Print B — BRACKET-B; Print vs. WPS/SWPS worksheet; Day 5 instructor key; authorized PCCC/AWS welding-symbol reference supplied by instructor; approved WPS/SWPS example supplied by instructor where cited.',
  updated_at=now()
from target t
where d.id=t.guide_day_id;

with target as (
  select d.id as guide_day_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active'
    and d.planner_day_number=5
  order by g.updated_at desc
  limit 1
)
update public.course_guide_day_segments s
set
  instructor_actions=case s.sequence_number
    when 1 then 'Use the five provided Joint-Type Cards. Students name butt, lap, T-joint, corner, and edge relationships and sketch the member relationship. Correct joint-vs-weld confusion immediately.'
    when 2 then 'Keep the authorized PCCC/AWS symbol reference visible. Model arrow, reference line, basic symbol, side/location, size/length, and tail/notes in that order. Use the source for exact convention.'
    when 3 then 'Work the six Symbol-to-Joint Cards. Require students to identify what the card shows, which authorized source controls the meaning, and whether any required information is missing.'
    when 4 then 'Use Bridge Print B and the Print vs. WPS/SWPS worksheet. Students identify what comes from the print and what must come from the approved procedure. Do not supply invented procedure values.'
    when 5 then 'Run the live Symbol Exit with no coaching. Record only the unresolved domain and plan one parallel-example retry if needed.'
    else s.instructor_actions end,
  student_actions=case s.sequence_number
    when 1 then 'Identify each joint type and sketch the member relationship.'
    when 2 then 'Follow the symbol-reading order and use the authorized reference for exact meaning.'
    when 3 then 'Complete all six cards, cite the controlling source, and mark STOP / CHECK when information is missing or unclear.'
    when 4 then 'Mark Bridge Print B and complete the Print vs. WPS/SWPS source-separation worksheet.'
    when 5 then 'Complete the Symbol Exit independently without instructor help.'
    else s.student_actions end,
  notes='2026-09-09 Day 5 resource-pack guidance. Protected WLD 205 outcomes unchanged; authorized references and approved procedures remain controlling.',
  updated_at=now()
from target t
where s.guide_day_id=t.guide_day_id
  and s.sequence_number between 1 and 5;

with target as (
  select d.id as guide_day_id, d.school_id, d.course_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active'
    and d.planner_day_number=5
  order by g.updated_at desc
  limit 1
)
delete from public.course_guide_day_resources r
using target t
where r.guide_day_id=t.guide_day_id
  and r.resource_title in (
    'Day 5 Joint-Type Cards',
    'Day 5 Symbol-to-Joint Cards',
    'Bridge Print B — BRACKET-B',
    'Day 5 Print vs. WPS/SWPS Worksheet',
    'Day 5 Instructor Key / Delivery Guide'
  );

with target as (
  select d.id as guide_day_id, d.school_id, d.course_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active'
    and d.planner_day_number=5
  order by g.updated_at desc
  limit 1
)
insert into public.course_guide_day_resources(
  school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,
  resource_notes,required,integration_mode,rights_basis,student_safe,license_notes
)
select t.school_id,t.course_id,t.guide_day_id,v.sequence_number,'other',v.resource_title,v.resource_url,
       v.resource_notes,v.required,'native','school_owned',v.student_safe,
       'Original PCCC/LTG training content. Authorized PCCC/AWS references and approved WPS/SWPS remain separate controlling sources.'
from target t
cross join (values
  (1,'Day 5 Joint-Type Cards','/live-activities/wld205-day5-joint-type-cards.svg','Five-card retrieval set: butt, lap, T-joint, corner, edge. Use before symbol work.',true,true),
  (2,'Day 5 Symbol-to-Joint Cards','/live-activities/wld205-day5-symbol-to-joint-cards.svg','Six original practice cards for joint/location, symbol-source navigation, tail/source control, and missing-information STOP/CHECK behavior.',true,true),
  (3,'Bridge Print B — BRACKET-B','/live-activities/wld205-day5-bridge-print-b.svg','Original training print showing a simple base/vertical-plate T-joint and the note WELD PER APPROVED WPS/SWPS. No invented procedure values.',true,true),
  (4,'Day 5 Print vs. WPS/SWPS Worksheet','/live-activities/wld205-day5-print-vs-wps-worksheet.svg','Student source-separation worksheet used with Bridge Print B and an instructor-provided approved procedure example.',true,true),
  (5,'Day 5 Instructor Key / Delivery Guide','/live-activities/wld205-day5-instructor-key.svg','Instructor-only timing, correction cues, card key, source-control rules, and focused-retry guidance.',true,false)
) as v(sequence_number,resource_title,resource_url,resource_notes,required,student_safe);

update public.assessment_modules
set instructions='DAY 5 LIVE CLASS
0–8 min — Joint-Type Retrieval: identify butt, lap, T-joint, corner, and edge from the provided cards.
8–20 min — Keep the AUTHORIZED PCCC/AWS symbol reference visible. Model arrow → reference line → basic symbol → side/location → size/length → tail/notes.
20–40 min — Work the six Symbol-to-Joint Cards. Use the authorized source for exact symbol meaning. Missing or unclear information = STOP / CHECK.
40–54 min — Bridge Print B (BRACKET-B): locate print requirements, then use the source-separation worksheet to identify what must come from the approved WPS/SWPS.
54–60 min — Complete Symbol Exit independently.
Never invent a missing weld size, procedure value, acceptance value, or symbol meaning.',
    reference_body='Practice board only. Exact welding-symbol conventions come from the authorized classroom source. Bridge Print B identifies the vertical plate/base plate T-joint and directs welding to the approved WPS/SWPS. LTG practice graphics do not replace either controlling source.'
where slug='wld205_pvhs_bridge_day5';
