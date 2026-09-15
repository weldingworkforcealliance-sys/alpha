-- WLD 105 Steel Dice VR #2 Final
-- Locks the approved drawing facts into both WLD 105 delivery variants and adds scored blueprint evidence.

insert into public.assessment_modules (
  slug,title,description,category,estimated_minutes,sort_order,version,
  active,instructions,allow_team_members,reference_title,reference_image_url,reference_body,show_student_score
)
values (
  'wld105_dice_blueprint_reading',
  'WLD 105 — Steel Dice Blueprint Reading Check',
  'Individual print-reading check using the approved Steel Dice VR #2 Final drawing.',
  'WLD 105 Blueprint / Project Reading',10,210,1,true,
  'Use the approved Steel Dice VR #2 Final print. Read dimensions, material sizes, hole counts, drill sizes, and notes directly from the drawing. Do not scale the image.',
  false,
  'Approved Steel Dice Print — VR #2 Final',
  null,
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
set description='Build-readiness check using the approved Steel Dice VR #2 Final drawing and project packet.',
    instructions='Use the approved Steel Dice VR #2 Final print and the Steel Dice project packet. Verify the cut list, drill plan, layout references, dry-fit/QC plan, and correction/recheck process before fabrication.',
    reference_title='Approved Steel Dice Print — VR #2 Final',
    reference_body='Finished cube 3.00 x 3.00 x 3.00 in from 1/4 in plate. Cut list: 2 pcs 3.00 x 3.00; 2 pcs 3.00 x 2.50; 2 pcs 2.50 x 2.50. Face drill sizes: 1=1/2, 2=3/8, 3=5/16, 4=1/4, 5=3/16, 6=1/8. All holes THRU. Use printed dimensions; do not scale.',
    show_student_score=true
where slug='wld105_dice_build_readiness';

-- Correct the compressed 23-day Dice materials after Tube Cube removal.
update public.course_guide_days d
set materials_equipment='Approved Steel Dice VR #2 Final print; Steel Dice project packet/cut list; project rubric; measuring/layout tools; drill sizes 1/8 through 1/2 in as called out; required PPE; fabrication materials.'
from public.course_guides g
where g.id=d.guide_id
  and g.guide_name='WLD 105 College Day/Night 23-Day Instructor Guide'
  and d.planner_day_number in (21,22,23);

-- Point all existing Steel Dice print/package placeholders at the approved source files.
update public.course_guide_day_resources r
set resource_url='https://drive.google.com/file/d/16hBVX0zy_Y8VVlKHeRGJ7QBc8XEExanl/view?usp=drivesdk',
    resource_title='Approved Steel Dice Print — VR #2 FINAL',
    resource_notes='Approved Steel Dice VR #2 Final controlling drawing. Face 4 is 2.50 x 2.50 in. Face 6 uses the .75 / 1.50 / .75 hole-center chain. Use printed dimensions; do not scale.',
    integration_mode='url',updated_at=now()
from public.course_guide_days d, public.course_guides g
where d.id=r.guide_day_id and g.id=d.guide_id
  and g.guide_name in ('WLD 105 College Day/Night 23-Day Instructor Guide','WLD 105 Master Instructor Guide - PVHS')
  and d.planner_day_number between 21 and 35
  and r.resource_title like 'Approved Steel Dice Print%';

update public.course_guide_day_resources r
set resource_url='https://drive.google.com/file/d/1KensJkg-GNa1M94_g_H2XgN-VkpNo-QL/view?usp=drivesdk',
    resource_notes='Student-facing Steel Dice project packet with the approved VR #2 Final print, cut list, face/drill plan, blueprint readiness, shop QC record, correction/recheck evidence, and 100-point final rubric.',
    integration_mode='url',updated_at=now()
from public.course_guide_days d, public.course_guides g
where d.id=r.guide_day_id and g.id=d.guide_id
  and g.guide_name in ('WLD 105 College Day/Night 23-Day Instructor Guide','WLD 105 Master Instructor Guide - PVHS')
  and d.planner_day_number between 21 and 35
  and (r.resource_title like 'Steel Dice Project Packet%' or r.resource_title like 'Steel Dice Final Project Rubric%');
