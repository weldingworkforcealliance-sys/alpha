-- Stage the original PCCC/LTG WLD 105 PVHS Day 3 print-to-part resource pack.
-- No protected course outcomes are changed.

with target as (
  select d.id as guide_day_id,d.school_id,d.course_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 105'
    and g.guide_name='WLD 105 Master Instructor Guide - PVHS'
    and g.status='active'
    and d.planner_day_number=3
  order by g.updated_at desc
  limit 1
)
update public.course_guide_days d
set
  instructor_prep='BEFORE CLASS: Print/open Training Plate A, the enlarged line-type reference, the Print-to-Part worksheet, and the instructor key. Stage a matching physical plate or cardboard/foam-board model, ruler/tape, and whiteboard. Keep the physical model close to the print so students can repeatedly connect paper features to the actual part.',
  materials_equipment='Training Plate A print; matching physical plate/model; enlarged line-type reference; Print-to-Part worksheet; instructor key; ruler/tape; whiteboard.',
  teaching_tips='Use this planner as a guide, not a script. Make the print physical: hold up the part, rotate it, and keep asking where each feature lives on the drawing. Reinforce PRINT → PART and READ → FIND → MEASURE → VERIFY → BUILD. Keep protected outcomes fixed.',
  updated_at=now()
from target t
where d.id=t.guide_day_id;

with target as (
  select d.id as guide_day_id,d.school_id,d.course_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 105'
    and g.guide_name='WLD 105 Master Instructor Guide - PVHS'
    and g.status='active'
    and d.planner_day_number=3
  order by g.updated_at desc
  limit 1
)
delete from public.course_guide_day_resources r
using target t
where r.guide_day_id=t.guide_day_id
  and r.resource_title in (
    'Day 3 Training Plate A',
    'Day 3 Enlarged Line-Type Reference',
    'Day 3 Print-to-Part Worksheet',
    'Day 3 Instructor Key / Print-to-Part Guide'
  );

with target as (
  select d.id as guide_day_id,d.school_id,d.course_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 105'
    and g.guide_name='WLD 105 Master Instructor Guide - PVHS'
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
       'Original PCCC/LTG training content.'
from target t
cross join (values
  (1,'Day 3 Training Plate A','/live-activities/wld105-day3-training-plate-a.svg','Simple 6 × 4 × 1/4 in training plate with 1 in through-hole, 1 × 1 corner notch, front/top/right-side views, dimensions, line types, and title block.',true,true),
  (2,'Day 3 Enlarged Line-Type Reference','/live-activities/wld105-day3-line-types.svg','Large object, hidden, center, dimension, and extension-line examples with short instructor language.',true,true),
  (3,'Day 3 Print-to-Part Worksheet','/live-activities/wld105-day3-print-to-part-worksheet.svg','Student worksheet for title/material/thickness, line-type identification, print-to-part matching, measuring, and exit check.',true,true),
  (4,'Day 3 Instructor Key / Print-to-Part Guide','/live-activities/wld105-day3-instructor-key.svg','Instructor-only physical-model prompts, whiteboard flow, worksheet key, and measurement targets.',true,false)
) as v(sequence_number,resource_title,resource_url,resource_notes,required,student_safe);
