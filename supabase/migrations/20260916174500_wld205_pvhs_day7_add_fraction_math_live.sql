-- PVHS WLD 205 Day 7: expose the required Build Fraction Sense math Live Classroom.
-- Keep the Day 7 tolerance Live Classroom and remove stale packet references from the materials line.

update public.course_guide_days
set materials_equipment='Day 7 Tolerances + Accept/Reject Live Classroom; Welding Math Live Classroom — Build Fraction Sense; approved print/tolerance source.'
where id='ecb65d72-f7fd-411d-a7ec-23a173d61c89';

delete from public.course_guide_day_resources
where guide_day_id='ecb65d72-f7fd-411d-a7ec-23a173d61c89'
  and (resource_url like '%wld105_math_live_06%' or resource_title ilike '%Build Fraction Sense%');

insert into public.course_guide_day_resources
(school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,resource_notes,required,integration_mode,rights_basis,student_safe,license_notes)
values
('08ccb452-83ab-482f-bb28-5576e02741b2','39af66f5-d352-416d-9a1d-594e21bb1c41','ecb65d72-f7fd-411d-a7ec-23a173d61c89',2,'website','Welding Math Live Classroom — Build Fraction Sense','/classroom/planner?assessment=wld105_math_live_06','Required final 10-minute Welding Math check for Day 7. Ten auto-graded fraction questions with live progress and item-level results.',true,'native','school_owned',false,'Original LTG welding-math classroom; textbook connection is referenced but textbook content is not reproduced.');
