-- WLD 105 Day 10 complete resource repair.
-- Aligns active PVHS + College Day/Night guides, replaces the generic board with a dedicated print,
-- expands the blueprint check to 10 print-based questions, and strengthens the combined math reference.

begin;

delete from public.course_guide_day_resources r
using public.course_guide_days d, public.course_guides g, public.courses c
where r.guide_day_id=d.id and d.guide_id=g.id and g.course_id=c.id
  and g.status='active' and c.course_code='WLD 105' and d.planner_day_number=10
  and r.resource_title='Practical Problems in Mathematics for Welders, 6th Edition' and r.resource_url is null;

update public.course_guide_day_resources r
set sequence_number = case
      when r.resource_title in ('Blueprint Core Support — Multi-View Weldment Interpretation','Day 10 Multi-View Weldment Print + Interpretation Guide') then 901
      when r.resource_url='/classroom/planner?assessment=wld105_math_qc_09' then 902
      when r.resource_url='/classroom/planner?assessment=wld105_bp_day10_multiview' then 903
      else r.sequence_number end,
    updated_at=now()
from public.course_guide_days d
join public.course_guides g on g.id=d.guide_id
join public.courses c on c.id=g.course_id
where r.guide_day_id=d.id and g.status='active' and c.course_code='WLD 105' and d.planner_day_number=10
  and (r.resource_title in ('Blueprint Core Support — Multi-View Weldment Interpretation','Day 10 Multi-View Weldment Print + Interpretation Guide')
       or r.resource_url in ('/classroom/planner?assessment=wld105_math_qc_09','/classroom/planner?assessment=wld105_bp_day10_multiview'));

update public.course_guide_day_resources r
set sequence_number=1,
    resource_title='Day 10 Multi-View Weldment Print + Interpretation Guide',
    resource_url='/resources/wld105/day10-multiview-weldment-guide.html',
    resource_notes='Dedicated Day 10 resource with a complete front/top/right-side weldment print, material, dimensions, tolerance, hole callout, weld information, title block, evidence prompts, and instructor flow.',
    integration_mode='native',rights_basis='school_owned',student_safe=true,updated_at=now()
from public.course_guide_days d join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=g.course_id
where r.guide_day_id=d.id and g.status='active' and c.course_code='WLD 105' and d.planner_day_number=10 and r.sequence_number=901;

update public.course_guide_day_resources r
set sequence_number=2,
    resource_title='Welding Math — Subtract Cuts and Offsets',
    resource_notes='Single combined Day 10 Welding Math resource. Opens the embedded subtraction lesson reference and 10-question auto-graded Live Classroom check in one instructor workflow.',
    updated_at=now()
from public.course_guide_days d join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=g.course_id
where r.guide_day_id=d.id and g.status='active' and c.course_code='WLD 105' and d.planner_day_number=10 and r.sequence_number=902;

update public.course_guide_day_resources r
set sequence_number=3,
    resource_notes='10-question connected blueprint check tied directly to the Day 10 multi-view training weldment print; records a separate numeric blueprint score.',
    updated_at=now()
from public.course_guide_days d join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=g.course_id
where r.guide_day_id=d.id and g.status='active' and c.course_code='WLD 105' and d.planner_day_number=10 and r.sequence_number=903;

update public.assessment_modules
set title='WLD 105 — Day 10 Multi-View Weldment Interpretation Check',
    description='Day 10 blueprint score: interpret the complete front/top/right-side weldment print, notes, dimensions, tolerance, hole callout, weld information, and QC requirements.',
    estimated_minutes=10,
    instructions='Keep the Day 10 multi-view training print open. Read all three views, notes, dimensions, tolerance, and weld callout together. Every answer should be traceable to visible print evidence.',
    reference_title='Day 10 Multi-View Weldment Training Print',
    reference_image_url='/live-activities/wld105-day10-multiview-weldment.svg',
    reference_body='Use the complete Day 10 training print. Coordinate the front, top, and right-side views; then verify material, dimensions, hole location, plate position, weld requirement, tolerance, and pre-weld inspection notes.'
where slug='wld105_bp_day10_multiview';

delete from public.assessment_questions where assessment_slug='wld105_bp_day10_multiview' and question_number between 6 and 10;

insert into public.assessment_questions
(id,assessment_slug,question_key,question_number,question_type,question_text,domain,options,correct_answer,accepted_answers,explanation)
values
(gen_random_uuid(),'wld105_bp_day10_multiview','d10q6',6,'mc','What material is specified for the Day 10 weldment?','material',jsonb_build_object('A','6061 aluminum','B','304 stainless steel','C','ASTM A36 steel','D','AISI 1018 round stock'),'C','[]'::jsonb,'Note 1 specifies ASTM A36 steel.'),
(gen_random_uuid(),'wld105_bp_day10_multiview','d10q7',7,'mc','What are the finished base-plate dimensions shown on the print?','dimensions',jsonb_build_object('A','6.00 × 3.00 × 1/4 in','B','8.00 × 5.00 × 1/4 in','C','8.00 × 3.00 × 1/4 in','D','6.00 × 5.00 × 3/8 in'),'B','[]'::jsonb,'The notes and coordinated views specify an 8.00 × 5.00 × 1/4 in base plate.'),
(gen_random_uuid(),'wld105_bp_day10_multiview','d10q8',8,'mc','How far is each hole center located from its nearest end of the base plate?','layout',jsonb_build_object('A','0.50 in','B','0.75 in','C','1.50 in','D','1.00 in'),'D','[]'::jsonb,'The top-view dimension chain places each hole center 1.00 in from the nearest end.'),
(gen_random_uuid(),'wld105_bp_day10_multiview','d10q9',9,'mc','What are the finished dimensions of the vertical plate?','dimensions',jsonb_build_object('A','6.00 × 3.00 × 1/4 in','B','8.00 × 3.00 × 1/4 in','C','6.00 × 5.00 × 1/4 in','D','5.00 × 3.00 × 3/8 in'),'A','[]'::jsonb,'The vertical plate is 6.00 in wide, 3.00 in high, and 1/4 in thick.'),
(gen_random_uuid(),'wld105_bp_day10_multiview','d10q10',10,'mc','Which weld requirement is shown at the vertical-plate-to-base joint?','weld_symbol',jsonb_build_object('A','3/8 in groove weld on the arrow side only','B','1/4 in intermittent fillet weld at 2.00 in pitch','C','1/4 in fillet weld on both sides, continuous for 6.00 in','D','No weld is specified'),'C','[]'::jsonb,'The weld callout specifies a 1/4 in fillet weld on both sides, continuous for 6.00 in.');

update public.assessment_questions set options=jsonb_build_object('A','The largest text on the page','B','Memory from a previous project','C','The combined evidence from views, dimensions, notes, tolerances and symbols','D','The view that looks easiest'), correct_answer='C' where assessment_slug='wld105_bp_day10_multiview' and question_number=1;
update public.assessment_questions set options=jsonb_build_object('A','Transfer the feature across the aligned views','B','Ignore the second view','C','Estimate the position','D','Delete the hole from the plan'), correct_answer='A' where assessment_slug='wld105_bp_day10_multiview' and question_number=2;
update public.assessment_questions set options=jsonb_build_object('A','Only the part name','B','Only the material note','C','The drawing border','D','The stated tolerance or governing general tolerance'), correct_answer='D' where assessment_slug='wld105_bp_day10_multiview' and question_number=3;
update public.assessment_questions set options=jsonb_build_object('A','It looks familiar','B','The student can point to the controlling view, note, dimension or symbol','C','A partner agrees','D','The instructor is nearby'), correct_answer='B' where assessment_slug='wld105_bp_day10_multiview' and question_number=4;

update public.assessment_modules
set description='Combined WLD 105 Day 10 Welding Math lesson and 10-question Live Classroom check for subtracting mixed-number cuts and offsets with borrowing.',
    reference_title='Welding Math — Subtract Cuts and Offsets',
    reference_body=E'Goal: Subtract mixed-number lengths and offsets, borrowing one whole when the top fraction is too small.\n\nBook connection: Unit 8 — Subtraction of Common Fractions\n\nBORROWING MODEL\n7 1/2 − 2 3/4\nRewrite 1/2 as 2/4. Because 2/4 is smaller than 3/4, borrow one whole from 7.\n7 2/4 becomes 6 6/4.\n6 6/4 − 2 3/4 = 4 3/4 in.\n\nGUIDED PRACTICE\n10 1/4 − 3 7/8\nRewrite 1/4 as 2/8, then borrow one whole: 10 2/8 becomes 9 10/8.\n9 10/8 − 3 7/8 = 6 3/8 in.\n\nSHOP USE\nMark the starting stock length, mark the removed cut/offset, calculate the remainder, then verify the result by addition. Keep units with every answer.\n\nQUICK CHECK\n6 1/8 − 2 7/8 = 5 9/8 − 2 7/8 = 3 2/8 = 3 1/4 in.\n\nRoutine: MEASURE → CALCULATE → CHECK → RECORD.'
where slug='wld105_math_qc_09';

commit;