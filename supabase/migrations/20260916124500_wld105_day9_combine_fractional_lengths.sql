-- WLD 105 Day 9: combine Add Fractional Lengths lesson + Live Classroom into one planner resource.
-- Keeps the existing wld105_math_qc_08 assessment and embeds the full lesson reference inside it.

update public.assessment_modules
set description = 'Combined WLD 105 Day 9 Welding Math lesson and 10-question Live Classroom check for adding fractional and mixed-number lengths.',
    instructions = 'Teach from the embedded Day 9 lesson reference first. Work the guided examples with the class, then have students complete all 10 questions independently. Require units where shown, simplify final fractions, and use item-level results for targeted reteach.',
    reference_title = 'Welding Math — Add Fractional Lengths',
    reference_body = 'DAY 9 — ADD FRACTIONAL LENGTHS

Goal: Add fractional and mixed-number lengths using common denominators, then simplify the final measurement.

Book connection: Unit 7 — Addition of Common Fractions

1. COMMON DENOMINATOR
Example: 3/8 + 1/4
Rewrite both fractions in sixteenths:
3/8 = 6/16 and 1/4 = 4/16
6/16 + 4/16 = 10/16 = 5/8 in

2. MIXED-NUMBER METHOD
Example A: 2 3/8 + 1 5/8
Whole numbers: 2 + 1 = 3
Fractions: 3/8 + 5/8 = 8/8 = 1
Answer: 4 in

Example B: 1 3/4 + 2 5/16
Rewrite 3/4 as 12/16.
12/16 + 5/16 = 17/16 = 1 1/16
1 + 2 + 1 1/16 = 4 1/16 in

3. CUT-LIST EXAMPLE
3 7/16 in + 2 5/16 in
7/16 + 5/16 = 12/16 = 3/4
3 + 2 = 5
Final total = 5 3/4 in

SHOP RULE
Carry units through the problem and simplify the final fraction. Do not add denominators.

GUIDED PRACTICE
Find a common denominator for 3/8 and 1/4. Verify 2 3/8 + 1 5/8 = 4 in. Then solve 1 3/4 + 2 5/16 and one cut-list total before launching the student check.

STUDENT CHECK
Complete all 10 questions independently. Keep units with measurements, simplify fractions when appropriate, and check whether each result is reasonable before submitting.'
where slug = 'wld105_math_qc_08';

delete from public.course_guide_day_resources r
using public.course_guide_days d, public.course_guides g, public.courses c
where r.guide_day_id = d.id
  and d.guide_id = g.id
  and g.course_id = c.id
  and c.course_code = 'WLD 105'
  and g.status = 'active'
  and d.planner_day_number = 9
  and r.resource_url = '/resources/wld105/add-fractional-lengths-math-card.html';

update public.course_guide_day_resources r
set sequence_number = 2,
    resource_title = 'Welding Math — Add Fractional Lengths',
    resource_notes = 'Single combined Day 9 Welding Math resource. Opens the embedded lesson reference and 10-question auto-graded Live Classroom check in one instructor workflow, with live progress and retained results.',
    updated_at = now()
from public.course_guide_days d
join public.course_guides g on g.id = d.guide_id
join public.courses c on c.id = g.course_id
where r.guide_day_id = d.id
  and c.course_code = 'WLD 105'
  and g.status = 'active'
  and d.planner_day_number = 9
  and r.resource_url = '/classroom/planner?assessment=wld105_math_qc_08';
