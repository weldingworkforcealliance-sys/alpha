-- WLD 205 PVHS Day 3 blueprint-recovery / print-to-part resource pack.
-- Original PCCC/LTG bridge content only. Protected WLD 205 outcomes remain unchanged.

with target as (
  select d.id as guide_day_id,d.school_id,d.course_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active'
    and d.planner_day_number=3
  order by g.updated_at desc
  limit 1
)
update public.course_guide_days d
set
  instructor_prep='BEFORE CLASS: Open/print the Day 3 enlarged line-type reference, Training Plate A, Bridge Print A — FRAME-A, the Print-to-Part/Bridge Print A worksheet, and the instructor key. Stage a matching Training Plate A physical plate or cardboard/foam-board model, ruler/tape, whiteboard, and the authorized drawing/source references used by the program. Launch the Day 3 Live Class Activity before the opening retrieval.',
  opening_review='0–8 min — Line-Function Retrieval: Use the enlarged reference/cards for object/visible, hidden, center, dimension, and extension lines. Students identify each function and complete Live Questions 1–5. Correct the function, not just the vocabulary word.',
  demonstration='8–18 min — Training Plate A Physical Model: Hold the matching plate/model in front-view orientation, then rotate it. Students connect visible edges, the through-hole, notch, hidden lines, centerline, and dimensions from paper to the physical part. Verify 6 in length, 4 in height, and 2 in hole-center locations with ruler/tape. Whiteboard: PRINT → PART / READ → FIND → MEASURE → VERIFY.',
  guided_practice='18–38 min — Bridge Print A / FRAME-A: Students use the standalone print and worksheet to locate title/view, general notes, dimensions, material, and procedure-source direction, then complete Live Questions 6–11. Reading order: TITLE / VIEW → NOTES → DIMENSIONS → SYMBOLS → QUESTIONS. Missing welding procedure conditions come from the approved WPS/SWPS, not the dimension lines.',
  independent_practice='38–52 min — Blueprint Math Connection: From Bridge Print A, calculate the outer-frame stock before allowance/kerf: 2 × 12 + 2 × 8 = 40 in. Require units and the source dimensions used, then complete Live Question 12. Do not invent allowance/kerf or procedure values not supplied by the controlling source.',
  assessment='52–60 min — Blueprint Exit 1: Students complete Live Questions 13–15 independently. Record only the unresolved domain: Line Functions, Print Locate/Notes, Dimension Math, or Source Control. Do not repeat a domain already demonstrated successfully.',
  instructor_checks='Instructor Rule: MAKE THE PRINT PHYSICAL → LOCATE THE SOURCE → READ THE DIMENSION/NOTE → CALCULATE IF NEEDED → VERIFY BEFORE ACTING. Remediate one failed domain with a parallel example and immediate independent recheck.',
  materials_equipment='Day 3 Enlarged Line-Type Reference; Training Plate A print; matching physical plate/model; Bridge Print A — FRAME-A; Day 3 Print-to-Part / Bridge Print A Worksheet; Day 3 Instructor Key / Print-to-Part Guide; ruler/tape; whiteboard; authorized drawing/source references; approved WPS/SWPS where cited.',
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
    and d.planner_day_number=3
  order by g.updated_at desc
  limit 1
)
update public.course_guide_day_segments s
set
  instructor_actions=case s.sequence_number
    when 1 then 'Use the enlarged line-type reference/cards. Students identify object/visible, hidden, center, dimension, and extension-line functions, then complete Live Questions 1–5. Correct function confusion immediately.'
    when 2 then 'Use Training Plate A with the matching physical model. Rotate the part and require students to point to the corresponding print feature. Verify 6 × 4 in overall size and 2 in hole-center locations with ruler/tape. Then transition to Bridge Print A reading order.'
    when 3 then 'Use Bridge Print A — FRAME-A and the worksheet. Students locate 12.000-in width, 8.000-in height, 4.000-in middle-member location, unit note, 1 × 1 square-tube material note, and approved WPS/SWPS source direction; complete Live Questions 6–11.'
    when 4 then 'Require the theoretical outer-frame stock calculation from Bridge Print A: 2 × 12 + 2 × 8 = 40 in before allowance/kerf. Require units/source dimensions and complete Live Question 12.'
    when 5 then 'Run Live Questions 13–15 independently. Record only the unresolved domain: Line Functions, Print Locate/Notes, Dimension Math, or Source Control.'
    else s.instructor_actions end,
  student_actions=case s.sequence_number
    when 1 then 'Identify all five line functions and complete Live Questions 1–5.'
    when 2 then 'Match print features to the physical Training Plate A model and verify key dimensions with a ruler/tape.'
    when 3 then 'Read Bridge Print A using TITLE / VIEW → NOTES → DIMENSIONS → SYMBOLS → QUESTIONS and complete Live Questions 6–11.'
    when 4 then 'Calculate outer-frame stock before allowance/kerf, show units/source dimensions, and complete Live Question 12.'
    when 5 then 'Complete Live Questions 13–15 independently without instructor help.'
    else s.student_actions end,
  notes='2026-09-09 WLD 205 PVHS Day 3 instructor-support resource pack. Protected outcomes unchanged; approved drawing/procedure sources remain controlling.',
  updated_at=now()
from target t
where s.guide_day_id=t.guide_day_id
  and s.sequence_number between 1 and 5;

with target as (
  select d.id as guide_day_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active'
    and d.planner_day_number=3
  order by g.updated_at desc
  limit 1
)
delete from public.course_guide_day_resources r
using target t
where r.guide_day_id=t.guide_day_id
  and r.resource_title in (
    'Day 3 Enlarged Line-Type Reference',
    'Day 3 Training Plate A',
    'Bridge Print A — FRAME-A',
    'Day 3 Print-to-Part / Bridge Print A Worksheet',
    'Day 3 Instructor Key / Print-to-Part Guide'
  );

with target as (
  select d.id as guide_day_id,d.school_id,d.course_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active'
    and d.planner_day_number=3
  order by g.updated_at desc
  limit 1
)
insert into public.course_guide_day_resources(
  school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,
  resource_notes,required,integration_mode,rights_basis,student_safe,license_notes
)
select t.school_id,t.course_id,t.guide_day_id,v.sequence_number,'other',v.resource_title,v.resource_url,
       v.resource_notes,v.required,'native','school_owned',v.student_safe,
       'Original PCCC/LTG prerequisite bridge content. Authorized drawing and approved WPS/SWPS sources remain separate controlling sources.'
from target t
cross join (values
  (1,'Day 3 Enlarged Line-Type Reference','/live-activities/wld205-day3-line-types.svg','Large object, hidden, center, dimension, and extension-line examples with short instructor language. Supports Live Questions 1–5.',true,true),
  (2,'Day 3 Training Plate A','/live-activities/wld205-day3-training-plate-a.svg','Simple 6 × 4 × 1/4 in plate used with a matching physical model to connect views, line types, dimensions, and measurement before FRAME-A.',true,true),
  (3,'Bridge Print A — FRAME-A','/live-activities/wld205-day3-bridge-print-a.svg','Standalone 12.000 × 8.000 in FRAME-A training print with 4.000-in middle member, 1 × 1 square-tube material note, inch units, and approved WPS/SWPS source direction. Supports Live Questions 6–12.',true,true),
  (4,'Day 3 Print-to-Part / Bridge Print A Worksheet','/live-activities/wld205-day3-print-to-part-worksheet.svg','Student worksheet linking the physical model to Bridge Print A reading, dimensions, source control, and blueprint math.',true,true),
  (5,'Day 3 Instructor Key / Print-to-Part Guide','/live-activities/wld205-day3-instructor-key.svg','Instructor-only timing, physical-model prompts, live-question mapping, FRAME-A key, math key, and focused-remediation guidance.',true,false)
) as v(sequence_number,resource_title,resource_url,resource_notes,required,student_safe);

update public.assessment_modules
set version=greatest(coalesce(version,0),13),
    instructions='DAY 3 LIVE CLASS
0–8 min — Line-Function Retrieval: identify object/visible, hidden, center, dimension, and extension-line functions; complete Questions 1–5.
8–18 min — Training Plate A physical-model demonstration: connect print views/features to the part and verify key dimensions with ruler/tape.
18–38 min — Bridge Print A / FRAME-A: read TITLE / VIEW → NOTES → DIMENSIONS → SYMBOLS → QUESTIONS; complete Questions 6–11.
38–52 min — Blueprint Math: calculate theoretical outer-frame stock before allowance/kerf and complete Question 12.
52–60 min — Complete Questions 13–15 independently as Blueprint Exit 1.
Missing or conflicting source information = STOP / CHECK. Welding procedure conditions come from the approved WPS/SWPS.',
    reference_body='Use Training Plate A to make print features physical, then Bridge Print A — FRAME-A for the live print-reading and math items. FRAME-A controls: 12.000 in overall width, 8.000 in overall height, middle horizontal 4.000 in from bottom, ALL DIMENSIONS IN INCHES, material 1 × 1 square tube, procedure conditions from approved WPS/SWPS.'
where slug='wld205_pvhs_bridge_day3';
