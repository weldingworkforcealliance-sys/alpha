-- WLD 105 Steel Dice PNG asset correction
-- Replaces the clipped WebP reference with the verified LTG-native PNG without changing curriculum content.

update public.assessment_modules
set reference_image_url='/resources/wld105/steel-dice-vr2-final.png',
    version=greatest(coalesce(version,1),3)
where slug in ('wld105_dice_blueprint_reading','wld105_dice_build_readiness');

update public.course_guide_day_resources r
set resource_url='/resources/wld105/steel-dice-vr2-final.png',
    integration_mode='native',
    rights_basis='school_owned',
    student_safe=true,
    updated_at=now()
from public.course_guide_days d
join public.course_guides g on g.id=d.guide_id
where d.id=r.guide_day_id
  and g.guide_name in ('WLD 105 College Day/Night 23-Day Instructor Guide','WLD 105 Master Instructor Guide - PVHS')
  and ((g.guide_name='WLD 105 College Day/Night 23-Day Instructor Guide' and d.planner_day_number between 21 and 23)
       or (g.guide_name='WLD 105 Master Instructor Guide - PVHS' and d.planner_day_number between 25 and 35))
  and (r.resource_title like 'Approved Steel Dice Print%' or r.resource_url='/resources/wld105/steel-dice-vr2-final.webp');

update public.course_guide_day_resources r
set resource_url='/resources/wld105/steel-dice-project-packet.html',
    integration_mode='native',
    rights_basis='school_owned',
    student_safe=true,
    updated_at=now()
from public.course_guide_days d
join public.course_guides g on g.id=d.guide_id
where d.id=r.guide_day_id
  and g.guide_name in ('WLD 105 College Day/Night 23-Day Instructor Guide','WLD 105 Master Instructor Guide - PVHS')
  and ((g.guide_name='WLD 105 College Day/Night 23-Day Instructor Guide' and d.planner_day_number between 21 and 23)
       or (g.guide_name='WLD 105 Master Instructor Guide - PVHS' and d.planner_day_number between 25 and 35))
  and r.resource_title like 'Steel Dice Project Packet%';
