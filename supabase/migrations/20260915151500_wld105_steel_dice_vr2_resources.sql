-- WLD 105 Steel Dice VR #2 FINAL
-- Uses LTG-native production assets for both 23-day and 55-day delivery variants.

insert into public.assessment_modules (
  slug,title,description,category,estimated_minutes,sort_order,version,
  active,instructions,allow_team_members,reference_title,reference_image_url,reference_body,show_student_score
)
values (
  'wld105_dice_blueprint_reading',
  'WLD 105 — Steel Dice Blueprint Reading Check',
  'Individual print-reading check using the approved Steel Dice VR #2 FINAL drawing.',
  'WLD 105 Blueprint / Project Reading',10,210,2,true,
  'Use the approved Steel Dice VR #2 FINAL print. Read dimensions, material sizes, hole counts, drill sizes, and notes directly from the drawing. Do not scale the image.',
  false,
  'Approved Steel Dice Print — VR #2 FINAL',
  '/resources/wld105/steel-dice-vr2-final.webp',
  'Controlling print facts: finished cube 3.00 x 3.00 x 3.00 in; 1/4 in steel plate; stock = 2 pcs 3.00 x 3.00, 2 pcs 3.00 x 2.50, 2 pcs 2.50 x 2.50; Face 1 = 1 hole Ø1/2; Face 2 = 2 holes Ø3/8; Face 3 = 3 holes Ø5/16; Face 4 = 4 holes Ø1/4; Face 5 = 5 holes Ø3/16; Face 6 = 6 holes Ø1/8; all holes THRU; use dimensions shown and do not scale.',
  true
)
on conflict (slug) do update set
  title=excluded.title,description=excluded.description,category=excluded.category,
  estimated_minutes=excluded.estimated_minutes,sort_order=excluded.sort_order,version=excluded.version,
  active=true,instructions=excluded.instructions,allow_team_members=excluded.allow_team_members,
  reference_title=excluded.reference_title,reference_image_url=excluded.reference_image_url,
  reference_body=excluded.reference_body,show_student_score=true;

delete from public.assessment_questions where assessment_slug='wld105_dice_blueprint_reading';

insert into public.assessment_questions (
  assessment_slug,question_key,question_number,question_type,question_text,
  domain,options,correct_answer,accepted_answers,explanation
)
values
('wld105_dice_blueprint_reading','dicebp1',1,'mc','What is the finished outside size of the Steel Dice?','Overall dimensions','{"A":"2.50 x 2.50 x 2.50 in","B":"3.00 x 3.00 x 3.00 in","C":"3.00 x 2.50 x 2.50 in","D":"6.00 x 3.00 x 0.25 in"}'::jsonb,'B',null,'The title block and fabrication notes specify a finished 3.00 x 3.00 x 3.00 in cube.'),
('wld105_dice_blueprint_reading','dicebp2',2,'mc','How many 3.00 x 3.00 in face plates are required?','Cut list','{"A":"4","B":"6","C":"1","D":"2"}'::jsonb,'D',null,'Faces 1 and 6 are the two 3.00 x 3.00 plates.'),
('wld105_dice_blueprint_reading','dicebp3',3,'mc','Which drill size is specified for Face 6, the six-hole face?','Hole callouts','{"A":"1/8 in","B":"3/16 in","C":"1/4 in","D":"1/2 in"}'::jsonb,'A',null,'Face 6 calls for six Ø1/8 in holes.'),
('wld105_dice_blueprint_reading','dicebp4',4,'mc','Which face uses a 1/2 in drill?','Hole callouts','{"A":"Face 6","B":"Face 4","C":"Face 1","D":"Face 2"}'::jsonb,'C',null,'Face 1 is the one-hole face and uses Ø1/2 in.'),
('wld105_dice_blueprint_reading','dicebp5',5,'mc','What is the correct size of Face 4?','Face dimensions','{"A":"3.00 x 3.00 in","B":"2.50 x 2.50 in","C":"3.00 x 2.50 in","D":"2.00 x 2.50 in"}'::jsonb,'B',null,'Face 4 is a 2.50 x 2.50 in plate.'),
('wld105_dice_blueprint_reading','dicebp6',6,'mc','On a 2.50 in square face, which dimension chain locates the outside hole-center lines?','Datum dimensions','{"A":"0.625 / 1.25 / 0.625 in","B":"0.75 / 1.50 / 0.75 in","C":"1.00 / 0.50 / 1.00 in","D":"0.50 / 1.50 / 0.50 in"}'::jsonb,'A',null,'0.625 + 1.25 + 0.625 = 2.50 in.'),
('wld105_dice_blueprint_reading','dicebp7',7,'mc','What does the note ALL HOLES THRU require?','Drawing notes','{"A":"Drill halfway through each plate","B":"Countersink every hole","C":"Drill only the center face","D":"Drill each called-out hole completely through the plate"}'::jsonb,'D',null,'THRU means the hole passes through the full 0.25 in plate thickness.'),
('wld105_dice_blueprint_reading','dicebp8',8,'mc','Which drill size belongs to Face 3?','Hole callouts','{"A":"1/8 in","B":"3/8 in","C":"5/16 in","D":"1/4 in"}'::jsonb,'C',null,'Face 3 has three Ø5/16 in holes.'),
('wld105_dice_blueprint_reading','dicebp9',9,'mc','How many pieces of 1/4 in x 3 in x 6 in stock are required by the project plan?','Material planning','{"A":"3","B":"2","C":"6","D":"4"}'::jsonb,'A',null,'The approved material plan uses three 1/4 in x 3 in x 6 in steel plates.'),
('wld105_dice_blueprint_reading','dicebp10',10,'mc','Why must a student use the printed dimensions instead of measuring the picture?','Print-reading practice','{"A":"The drill sizes are optional","B":"The drawing is marked Do Not Scale","C":"Only Face 1 is dimensioned","D":"The material thickness changes by face"}'::jsonb,'B',null,'The drawing explicitly says Do Not Scale; the dimensions control the work.');

update public.assessment_modules
set description='Build-readiness check using the approved Steel Dice VR #2 FINAL drawing and project packet.',
    instructions='Use the approved Steel Dice VR #2 FINAL print and the Steel Dice project packet. Verify the cut list, drill plan, layout references, dry-fit/QC plan, and correction/recheck process before fabrication.',
    reference_title='Approved Steel Dice Print — VR #2 FINAL',
    reference_image_url='/resources/wld105/steel-dice-vr2-final.webp',
    reference_body='Finished cube 3.00 x 3.00 x 3.00 in from 1/4 in plate. Cut list: 2 pcs 3.00 x 3.00; 2 pcs 3.00 x 2.50; 2 pcs 2.50 x 2.50. Face drill sizes: 1=1/2, 2=3/8, 3=5/16, 4=1/4, 5=3/16, 6=1/8. All holes THRU. Use printed dimensions; do not scale.',
    show_student_score=true
where slug='wld105_dice_build_readiness';

-- Correct the compressed 23-day Dice materials after Tube Cube removal.
update public.course_guide_days d
set materials_equipment='Approved Steel Dice VR #2 FINAL print; Steel Dice project packet/cut list; 100-point project rubric; measuring/layout tools; drill sizes 1/8 through 1/2 in as called out; required PPE; fabrication materials.'
from public.course_guides g
where g.id=d.guide_id
  and g.guide_name='WLD 105 College Day/Night 23-Day Instructor Guide'
  and d.planner_day_number in (21,22,23);

-- Replace any existing Steel Dice placeholders/external links with LTG-native assets.
update public.course_guide_day_resources r
set resource_url='/resources/wld105/steel-dice-vr2-final.webp',
    resource_title='Approved Steel Dice Print — VR #2 FINAL',
    resource_notes='Approved Steel Dice VR #2 FINAL controlling drawing. Face 4 is 2.50 x 2.50 in. Face 6 uses the 0.75 / 1.50 / 0.75 hole-center chain. Use printed dimensions; do not scale.',
    integration_mode='native',rights_basis='school_owned',student_safe=true,updated_at=now()
from public.course_guide_days d, public.course_guides g
where d.id=r.guide_day_id and g.id=d.guide_id
  and g.guide_name in ('WLD 105 College Day/Night 23-Day Instructor Guide','WLD 105 Master Instructor Guide - PVHS')
  and ((g.guide_name='WLD 105 College Day/Night 23-Day Instructor Guide' and d.planner_day_number between 21 and 23)
       or (g.guide_name='WLD 105 Master Instructor Guide - PVHS' and d.planner_day_number between 25 and 35))
  and r.resource_title like 'Approved Steel Dice Print%';

update public.course_guide_day_resources r
set resource_url='/resources/wld105/steel-dice-project-packet.html',
    resource_notes='Student-facing Steel Dice project packet with the approved VR #2 FINAL print, cut list, face/drill plan, blueprint readiness, shop QC, correction/recheck evidence and 100-point final rubric.',
    integration_mode='native',rights_basis='school_owned',student_safe=true,updated_at=now()
from public.course_guide_days d, public.course_guides g
where d.id=r.guide_day_id and g.id=d.guide_id
  and g.guide_name in ('WLD 105 College Day/Night 23-Day Instructor Guide','WLD 105 Master Instructor Guide - PVHS')
  and ((g.guide_name='WLD 105 College Day/Night 23-Day Instructor Guide' and d.planner_day_number between 21 and 23)
       or (g.guide_name='WLD 105 Master Instructor Guide - PVHS' and d.planner_day_number between 25 and 35))
  and (r.resource_title like 'Steel Dice Project Packet%' or r.resource_title like 'Steel Dice Final Project Rubric%');

-- Ensure every Steel Dice day has the controlling print, including PVHS follow-through Days 32-35.
with target_days as (
  select d.id,d.school_id,d.course_id,d.planner_day_number,g.guide_name
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  where (g.guide_name='WLD 105 College Day/Night 23-Day Instructor Guide' and d.planner_day_number between 21 and 23)
     or (g.guide_name='WLD 105 Master Instructor Guide - PVHS' and d.planner_day_number between 25 and 35)
)
insert into public.course_guide_day_resources(
  school_id,course_id,guide_day_id,sequence_number,
  resource_type,resource_title,resource_url,resource_notes,
  required,integration_mode,rights_basis,student_safe,license_notes
)
select t.school_id,t.course_id,t.id,70,
  'document','Approved Steel Dice Print — VR #2 FINAL','/resources/wld105/steel-dice-vr2-final.webp',
  'Controlling project drawing for blueprint instruction, layout, drilling, fabrication, fit-up and final QC. Use printed dimensions; do not scale.',
  true,'native','school_owned',true,'Original PCCC/LTG instructional drawing.'
from target_days t
where not exists (
  select 1 from public.course_guide_day_resources r
  where r.guide_day_id=t.id and r.resource_title like 'Approved Steel Dice Print%'
)
on conflict(guide_day_id,sequence_number) do update set
  resource_type=excluded.resource_type,resource_title=excluded.resource_title,
  resource_url=excluded.resource_url,resource_notes=excluded.resource_notes,
  required=excluded.required,integration_mode=excluded.integration_mode,
  rights_basis=excluded.rights_basis,student_safe=excluded.student_safe,
  license_notes=excluded.license_notes,updated_at=now();

-- Ensure every Steel Dice day has the student packet/QC/rubric.
with target_days as (
  select d.id,d.school_id,d.course_id,d.planner_day_number,g.guide_name
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  where (g.guide_name='WLD 105 College Day/Night 23-Day Instructor Guide' and d.planner_day_number between 21 and 23)
     or (g.guide_name='WLD 105 Master Instructor Guide - PVHS' and d.planner_day_number between 25 and 35)
)
insert into public.course_guide_day_resources(
  school_id,course_id,guide_day_id,sequence_number,
  resource_type,resource_title,resource_url,resource_notes,
  required,integration_mode,rights_basis,student_safe,license_notes
)
select t.school_id,t.course_id,t.id,71,
  'handout','Steel Dice Project Packet — Build Readiness + QC + 100-Point Rubric','/resources/wld105/steel-dice-project-packet.html',
  'Use throughout the Steel Dice sequence for cut-list planning, face/drill verification, shop QC, correction/recheck evidence and final evaluation.',
  true,'native','school_owned',true,'Original PCCC/LTG instructional project packet.'
from target_days t
where not exists (
  select 1 from public.course_guide_day_resources r
  where r.guide_day_id=t.id and r.resource_title like 'Steel Dice Project Packet%'
)
on conflict(guide_day_id,sequence_number) do update set
  resource_type=excluded.resource_type,resource_title=excluded.resource_title,
  resource_url=excluded.resource_url,resource_notes=excluded.resource_notes,
  required=excluded.required,integration_mode=excluded.integration_mode,
  rights_basis=excluded.rights_basis,student_safe=excluded.student_safe,
  license_notes=excluded.license_notes,updated_at=now();

-- Add the blueprint-reading score to the first blueprint day in each delivery version.
with first_days as (
  select d.id,d.school_id,d.course_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  where (g.guide_name='WLD 105 College Day/Night 23-Day Instructor Guide' and d.planner_day_number=21)
     or (g.guide_name='WLD 105 Master Instructor Guide - PVHS' and d.planner_day_number=25)
)
insert into public.course_guide_day_resources(
  school_id,course_id,guide_day_id,sequence_number,
  resource_type,resource_title,resource_url,resource_notes,
  required,integration_mode,rights_basis,student_safe,license_notes
)
select f.school_id,f.course_id,f.id,90,
  'other','Launch Connected Check: Steel Dice Blueprint Reading',
  '/classroom/planner?assessment=wld105_dice_blueprint_reading',
  'Individual 10-question scored check using the approved Steel Dice VR #2 FINAL drawing as the class reference.',
  true,'native','school_owned',false,'Original PCCC/LTG assessment.'
from first_days f
where not exists (
  select 1 from public.course_guide_day_resources r
  where r.guide_day_id=f.id and r.resource_url='/classroom/planner?assessment=wld105_dice_blueprint_reading'
)
on conflict(guide_day_id,sequence_number) do update set
  resource_type=excluded.resource_type,resource_title=excluded.resource_title,
  resource_url=excluded.resource_url,resource_notes=excluded.resource_notes,
  required=excluded.required,integration_mode=excluded.integration_mode,
  rights_basis=excluded.rights_basis,student_safe=excluded.student_safe,
  license_notes=excluded.license_notes,updated_at=now();

-- Add Live Job Card evidence to the 55-day follow-through after the initial five shop days.
with follow_days as (
  select d.id,d.school_id,d.course_id,d.planner_day_number
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  wher g.guide_name='WLD 105 Master Instructor Guide - PVHS'
    and d.planner_day_number between 32 and 35
)
insert into public.course_guide_day_resources(
  school_id,course_id,guide_day_id,sequence_number,
  resource_type,resource_title,resource_url,resource_notes,
  required,integration_mode,rights_basis,student_safe,license_notes
)
select f.school_id,f.course_id,f.id,91,
  'other','Launch Live Project Job Card — Steel Dice','/classroom/job-card',
  case f.planner_day_number
    when 32 then 'Record assembly/tack sequence planning and geometry checkpoints.'
    when 33 then 'Record measured correction, rework, finish evidence and recheck.'
    when 34 then 'Record final dimensions, feature locations, squareness, condition and disposition.'
    when 35 then 'Record final rubric evidence, project disposition and instructor sign-off.'
  end,
  true,'native','school_owned',false,'Original PCCC/LTG instructional project evidence.'
from follow_days f
where not exists (
  select 1 from public.course_guide_day_resources r
  where r.guide_day_id=f.id and r.resource_url='/classroom/job-card' and r.resource_title ilike '%Steel Dice%'
)
on conflict(guide_day_id,sequence_number) do update set
  resource_type=excluded.resource_type,resource_title=excluded.resource_title,
  resource_url=excluded.resource_url,resource_notes=excluded.resource_notes,
  required=excluded.required,integration_mode=excluded.integration_mode,
  rights_basis=excluded.rights_basis,student_safe=excluded.student_safe,
  license_notes=excluded.license_notes,updated_at=now();
