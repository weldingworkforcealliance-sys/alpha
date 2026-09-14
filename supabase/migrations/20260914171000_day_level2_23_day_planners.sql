-- Day Level II 23-day WLD 205 / WLD 210 planner drafts.
-- Safe deployment: creates curriculum guides as DRAFT only. No sections, instructor
-- assignments, planner_days, section_progress, or live cohort wiring are created here.
--
-- WLD 205 rule: shared new theory advances only on dates when PVHS and PCCC Day L2
-- are both present. PVHS-only Fridays are shop/application days and 2026-10-27 is
-- a Day-L2-only theory hold because PVHS is absent.
-- WLD 210 rule: Day L2 uses an accelerated 300-minute shop block while preserving
-- protected course outcomes and evidence/qualification guardrails.

begin;

-- ---------------------------------------------------------------------------
-- Guides
-- ---------------------------------------------------------------------------
insert into public.course_guides (
  school_id, course_id, guide_name, academic_year, version_label,
  planned_instructional_days, status
)
select c.school_id, c.id,
       'WLD 205 Day Level II - 23-Day Synchronized Planner',
       '2026-2027', '2026-09-14-DAY-L2-23-v1', 23, 'draft'
from public.courses c
where c.course_code = 'WLD 205'
on conflict (school_id, course_id, academic_year, version_label)
do update set
  guide_name = excluded.guide_name,
  planned_instructional_days = excluded.planned_instructional_days,
  status = 'draft',
  updated_at = now();

insert into public.course_guides (
  school_id, course_id, guide_name, academic_year, version_label,
  planned_instructional_days, status
)
select c.school_id, c.id,
       'WLD 210 Day Level II - 23-Day Accelerated Shop Planner',
       '2026-2027', '2026-09-14-DAY-L2-23-v1', 23, 'draft'
from public.courses c
where c.course_code = 'WLD 210'
on conflict (school_id, course_id, academic_year, version_label)
do update set
  guide_name = excluded.guide_name,
  planned_instructional_days = excluded.planned_instructional_days,
  status = 'draft',
  updated_at = now();

-- Idempotent rebuild of only the two draft guides.
delete from public.course_guide_days d
using public.course_guides g, public.courses c
where d.guide_id = g.id
  and g.course_id = c.id
  and g.version_label = '2026-09-14-DAY-L2-23-v1'
  and c.course_code in ('WLD 205','WLD 210');

-- ---------------------------------------------------------------------------
-- WLD 205 day rows. Clone approved PVHS content, then adjust synchronization days.
-- ---------------------------------------------------------------------------
with src_guide as (
  select g.id
  from public.course_guides g
  join public.courses c on c.id = g.course_id
  where c.course_code = 'WLD 205'
    and g.guide_name = 'WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status = 'active'
  limit 1
), target_guide as (
  select g.id
  from public.course_guides g
  join public.courses c on c.id = g.course_id
  where c.course_code = 'WLD 205'
    and g.version_label = '2026-09-14-DAY-L2-23-v1'
  limit 1
), map(target_day, source_day) as (
  values
    (1,10),(2,11),(3,12),(4,13),(5,14),(6,15),(7,16),(8,17),(9,18),
    (10,19),(11,20),(12,21),(13,23),(14,24),(15,25),(16,26),(17,27),
    (18,28),(19,29),(20,30),(21,30),(22,32),(23,33)
)
insert into public.course_guide_days (
  school_id,course_id,guide_id,planner_day_number,title,objective,instructor_prep,
  safety_focus,opening_review,demonstration,guided_practice,independent_practice,
  instructor_checks,assessment,common_problems,teaching_tips,materials_equipment,
  corresponding_application,evidence_check_for_understanding,weekly_coaching_focus,
  coaching_focus,if_students_struggle,keep_momentum,aws_alignment,aws_key_indicators,
  safety_gate,procedure_variable_focus,evidence_type,inspection_acceptance_focus,
  focused_retry,record_link_expectation,qualification_guardrail
)
select d.school_id,d.course_id,tg.id,m.target_day,d.title,d.objective,d.instructor_prep,
       d.safety_focus,d.opening_review,d.demonstration,d.guided_practice,d.independent_practice,
       d.instructor_checks,d.assessment,d.common_problems,d.teaching_tips,d.materials_equipment,
       d.corresponding_application,d.evidence_check_for_understanding,d.weekly_coaching_focus,
       d.coaching_focus,d.if_students_struggle,d.keep_momentum,d.aws_alignment,d.aws_key_indicators,
       d.safety_gate,d.procedure_variable_focus,d.evidence_type,d.inspection_acceptance_focus,
       d.focused_retry,d.record_link_expectation,d.qualification_guardrail
from map m
cross join src_guide sg
cross join target_guide tg
join public.course_guide_days d
  on d.guide_id = sg.id and d.planner_day_number = m.source_day;

update public.course_guide_days d set
  title = 'Day Level II Day 1 - Intake Math Diagnostic / PVHS WLD 210 Full-Shop Overlap',
  objective = 'Complete the incoming Day Level II 20-minute Pre-Class Welding Math Assessment and intake/source-control setup. PVHS receives no WLD 205 theory and remains in WLD 210 straight shop time. No common WLD 205 theory begins until Day Level II Day 2 / the next shared PVHS meeting.',
  instructor_prep = 'Prepare the incoming PCCC math diagnostic and Day Level II intake materials. Coordinate with WLD 210 so PVHS stays in straight shop time. Do not launch shared WLD 205 theory today.',
  assessment = '20-minute Pre-Class Welding Math Assessment for incoming Day Level II students; diagnostic only. PVHS does not take new WLD 205 theory today.',
  updated_at = now()
from public.course_guides g, public.courses c
where d.guide_id = g.id and g.course_id = c.id
  and c.course_code='WLD 205'
  and g.version_label='2026-09-14-DAY-L2-23-v1'
  and d.planner_day_number=1;

update public.course_guide_days d set
  title = 'Trade Math Readiness + Official AWS SENSE II Trade Math Practical Knowledge Exam',
  objective = 'Complete a short non-secure readiness check, then administer the official AWS SENSE II Trade Math practical knowledge exam under the approved secure testing procedure. This day introduces no new WLD 205 theory.',
  instructor_prep = 'Prepare the non-secure readiness prompt, authorized secure exam procedure, roster, approved accommodations, and permitted status-recording workflow. PVHS may complete its Friday reinforcement separately; both cohorts begin the next new theory together.',
  safety_focus = 'Maintain secure testing conditions. No physical shop work is controlled by WLD 205; any shop activity follows WLD 210 controls.',
  opening_review = '5-10 minutes: identify only the final non-secure trade-math readiness concern. Do not rehearse secure exam content.',
  demonstration = null,
  guided_practice = 'Complete one short non-secure readiness/recheck item in the identified weak domain.',
  independent_practice = 'Complete the authorized secure AWS SENSE II Trade Math practical knowledge exam.',
  instructor_checks = 'Verify secure administration and record only permitted status/evidence. Do not store or reconstruct secure questions or answers in LTG.',
  assessment = 'Formal secure AWS SENSE II Trade Math practical knowledge exam; LTG stores status/evidence only.',
  common_problems = 'Coaching tested content; reproducing secure items; treating a readiness result as an AWS credential.',
  teaching_tips = 'Keep the readiness portion brief. Security outranks convenience. If remediation is needed, schedule it later with parallel non-secure items.',
  materials_equipment = 'Authorized secure testing system/materials; approved accommodations; non-secure readiness record; calculator/measuring tools only as permitted.',
  corresponding_application = 'Trade-math readiness and secure assessment before the metallurgy block.',
  evidence_check_for_understanding = 'Document the remaining non-secure weakness, exam status, and next action without storing secure content.',
  weekly_coaching_focus = 'Trade math closure',
  coaching_focus = 'Independent readiness and secure administration',
  if_students_struggle = 'Assign one parallel non-secure item after testing; never reteach from secure questions.',
  keep_momentum = 'Move directly to WLD 210 after secure closeout.',
  aws_alignment = 'AWS SENSE II Trade Math practical knowledge',
  aws_key_indicators = 'Secure exam status; units/source discipline in non-secure readiness work.',
  safety_gate = 'Testing security gate applies.',
  procedure_variable_focus = 'No universal procedure variables are introduced in WLD 205.',
  evidence_type = 'secure_exam_status',
  inspection_acceptance_focus = 'Use only approved scoring/status rules.',
  focused_retry = 'One non-secure parallel recheck only.',
  record_link_expectation = 'Record permitted status and next action only.',
  qualification_guardrail = 'Passing/qualification status follows the approved AWS/PCCC process; LTG does not infer credentials.',
  updated_at = now()
from public.course_guides g, public.courses c
where d.guide_id=g.id and g.course_id=c.id
  and c.course_code='WLD 205'
  and g.version_label='2026-09-14-DAY-L2-23-v1'
  and d.planner_day_number=12;

update public.course_guide_days d set
  title = 'Shared WLD 205 Shop-Application / Theory Hold Day',
  objective = 'Keep PVHS and Day Level II at the same WLD 205 theory pace by introducing no new theory. Apply previously taught blueprint, math, metallurgy, WPS/source-control, and documentation skills to current WLD 210 work.',
  instructor_prep = 'Coordinate with WLD 210 before class. Select actual current shop work that students can reference. No new protected WLD 205 content is introduced today.',
  safety_focus = 'All physical work follows WLD 210 shop controls. WLD 205 activity is application, source checking, measurement, inspection evidence, and documentation only.',
  opening_review = 'Review the current WLD 210 task and identify the print/WPS/source and the evidence students must capture.',
  demonstration = 'Model one short source-to-shop evidence chain using work already authorized in WLD 210.',
  guided_practice = 'Apply previously taught WLD 205 skills to current shop work: locate source, calculate/verify as needed, inspect evidence, and record.',
  independent_practice = 'Complete one source/evidence record from actual WLD 210 work. No new theory packet is assigned.',
  instructor_checks = 'Confirm students use only previously taught methods and actual evidence. Unknown or pending values remain unknown/pending.',
  assessment = 'Application/evidence check only; no new theory assessment.',
  common_problems = 'Turning the day into a new lecture; inventing procedure values; backfilling evidence; advancing either cohort theory independently.',
  teaching_tips = 'This is an intentional synchronization day. Use it to strengthen application and preserve the same next-theory starting point.',
  materials_equipment = 'Current approved print/WPS/SWPS; measuring tools; current WLD 210 work/evidence; reusable source-to-evidence record.',
  corresponding_application = 'Direct application to the current WLD 210 shop progression.',
  evidence_check_for_understanding = 'One complete source-to-evidence chain from actual work.',
  weekly_coaching_focus = 'Synchronization / application',
  coaching_focus = 'Apply existing knowledge without advancing theory.',
  if_students_struggle = 'Reduce the task to one source, one calculation/interpretation, and one evidence record.',
  keep_momentum = 'Move students back to productive WLD 210 practice as soon as the evidence check is complete.',
  aws_alignment = 'Supports existing WLD 205/WLD 210 outcomes; no new outcome introduced.',
  aws_key_indicators = 'Source location, units, actual evidence, traceable record.',
  safety_gate = 'WLD 210 safety controls govern all physical work.',
  procedure_variable_focus = 'Use only the current approved procedure/source.',
  evidence_type = 'application_evidence',
  inspection_acceptance_focus = 'Compare actual evidence only to an authorized requirement.',
  focused_retry = 'Repeat one evidence chain with reduced prompting.',
  record_link_expectation = 'Link the record to actual WLD 210 evidence.',
  qualification_guardrail = 'This day creates no qualification status by itself.',
  updated_at=now()
from public.course_guides g, public.courses c
where d.guide_id=g.id and g.course_id=c.id
  and c.course_code='WLD 205'
  and g.version_label='2026-09-14-DAY-L2-23-v1'
  and d.planner_day_number=20;

update public.course_guide_days d set
  title = 'Metallurgy Readiness + Official AWS SENSE II Welding Metallurgy Practical Knowledge Exam',
  objective = 'Complete a short non-secure metallurgy readiness check, then administer the official AWS SENSE II Welding Metallurgy practical knowledge exam under the approved secure testing procedure. This day introduces no new theory.',
  instructor_prep = 'Prepare the non-secure metallurgy readiness prompt, secure exam procedure, roster, approved accommodations, and permitted status-recording workflow.',
  safety_focus = 'Maintain secure testing conditions. Any physical activity follows WLD 210 shop controls.',
  opening_review = '5-10 minutes: identify the last non-secure metallurgy readiness concern using previously taught concepts.',
  demonstration = null,
  guided_practice = 'Complete one non-secure MATERIAL -> HEAT/CONDITION -> EFFECT -> RISK -> CONTROL readiness item.',
  independent_practice = 'Complete the authorized secure AWS SENSE II Welding Metallurgy practical knowledge exam.',
  instructor_checks = 'Verify secure administration and record only permitted status/evidence. Never store secure items in LTG.',
  assessment = 'Formal secure AWS SENSE II Welding Metallurgy practical knowledge exam; LTG stores status/evidence only.',
  common_problems = 'Coaching secure content; copying exam prompts; treating observation as exact metallurgical proof; recording more than permitted exam evidence.',
  teaching_tips = 'Keep the readiness portion source-based and brief. Use later non-secure remediation if needed.',
  materials_equipment = 'Authorized secure testing system/materials; approved accommodations; metallurgy readiness record; approved material/metallurgy source.',
  corresponding_application = 'Metallurgy closure before final blueprint/WPS integration.',
  evidence_check_for_understanding = 'Record remaining non-secure domain, exam status, and next action.',
  weekly_coaching_focus = 'Metallurgy closure',
  coaching_focus = 'Independent reasoning and secure administration',
  if_students_struggle = 'Assign one new non-secure source-based recheck after testing.',
  keep_momentum = 'After secure closeout, return to WLD 210 or approved review work.',
  aws_alignment = 'AWS SENSE II Welding Metallurgy practical knowledge',
  aws_key_indicators = 'Material/source discipline; secure exam status.',
  safety_gate = 'Testing security gate applies.',
  procedure_variable_focus = 'No procedure value may be invented from general metallurgy knowledge.',
  evidence_type = 'secure_exam_status',
  inspection_acceptance_focus = 'Use only approved scoring/status rules.',
  focused_retry = 'One non-secure parallel metallurgy recheck only.',
  record_link_expectation = 'Record permitted status and next action only.',
  qualification_guardrail = 'Credential/qualification status follows the approved AWS/PCCC process.',
  updated_at=now()
from public.course_guides g, public.courses c
where d.guide_id=g.id and g.course_id=c.id
  and c.course_code='WLD 205'
  and g.version_label='2026-09-14-DAY-L2-23-v1'
  and d.planner_day_number=21;

-- WLD 205 outcomes.
with src_guide as (
  select g.id from public.course_guides g join public.courses c on c.id=g.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' limit 1
), target as (
  select d.planner_day_number,d.id,d.school_id,d.course_id
  from public.course_guide_days d join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.version_label='2026-09-14-DAY-L2-23-v1'
), map(target_day,source_day) as (
  values (1,10),(2,11),(3,12),(4,13),(5,14),(6,15),(7,16),(8,17),(9,18),
         (10,19),(11,20),(13,23),(14,24),(15,25),(16,26),(17,27),(18,28),
         (19,29),(22,32),(23,33)
), src_days as (
  select d.planner_day_number,d.id from public.course_guide_days d cross join src_guide sg
  where d.guide_id=sg.id
)
insert into public.course_guide_day_outcomes(school_id,course_id,guide_day_id,outcome_id)
select distinct t.school_id,t.course_id,t.id,o.outcome_id
from map m join src_days sd on sd.planner_day_number=m.source_day
join public.course_guide_day_outcomes o on o.guide_day_id=sd.id
join target t on t.planner_day_number=m.target_day
on conflict (guide_day_id,outcome_id) do nothing;

with src_guide as (
  select g.id from public.course_guides g join public.courses c on c.id=g.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' limit 1
), target as (
  select d.planner_day_number,d.id,d.school_id,d.course_id
  from public.course_guide_days d join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.version_label='2026-09-14-DAY-L2-23-v1'
), custom_map(target_day,source_day) as (
  values (12,21),(12,22),(21,30),(21,31)
), src_days as (
  select d.planner_day_number,d.id from public.course_guide_days d cross join src_guide sg where d.guide_id=sg.id
)
insert into public.course_guide_day_outcomes(school_id,course_id,guide_day_id,outcome_id)
select distinct t.school_id,t.course_id,t.id,o.outcome_id
from custom_map m join src_days sd on sd.planner_day_number=m.source_day
join public.course_guide_day_outcomes o on o.guide_day_id=sd.id
join target t on t.planner_day_number=m.target_day
on conflict (guide_day_id,outcome_id) do nothing;

with target as (
  select d.id,d.school_id,d.course_id
  from public.course_guide_days d join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.version_label='2026-09-14-DAY-L2-23-v1'
    and d.planner_day_number=20
)
insert into public.course_guide_day_outcomes(school_id,course_id,guide_day_id,outcome_id)
select t.school_id,t.course_id,t.id,o.id
from target t join public.course_outcomes o on o.course_id=t.course_id
where o.outcome_code in ('CLO2','CLO3','CLO4','CLO5')
on conflict (guide_day_id,outcome_id) do nothing;

-- WLD 205 segments copied for normal days.
with src_guide as (
  select g.id from public.course_guides g join public.courses c on c.id=g.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' limit 1
), target as (
  select d.planner_day_number,d.id,d.school_id,d.course_id
  from public.course_guide_days d join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.version_label='2026-09-14-DAY-L2-23-v1'
), map(target_day,source_day) as (
  values (1,10),(2,11),(3,12),(4,13),(5,14),(6,15),(7,16),(8,17),(9,18),
         (10,19),(11,20),(13,23),(14,24),(15,25),(16,26),(17,27),(18,28),
         (19,29),(22,32),(23,33)
), src_days as (
  select d.planner_day_number,d.id from public.course_guide_days d cross join src_guide sg where d.guide_id=sg.id
)
insert into public.course_guide_day_segments(
  school_id,course_id,guide_day_id,sequence_number,segment_type,segment_title,
  planned_minutes,instructor_actions,student_actions,notes,start_minute,end_minute
)
select t.school_id,t.course_id,t.id,s.sequence_number,s.segment_type,s.segment_title,
       s.planned_minutes,s.instructor_actions,s.student_actions,
       coalesce(s.notes,'')||' | Day Level II synchronized copy of approved shared WLD 205 content.',
       s.start_minute,s.end_minute
from map m join src_days sd on sd.planner_day_number=m.source_day
join public.course_guide_day_segments s on s.guide_day_id=sd.id
join target t on t.planner_day_number=m.target_day;

-- WLD 205 custom 60-minute days.
with t as (
  select d.id,d.school_id,d.course_id from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.version_label='2026-09-14-DAY-L2-23-v1' and d.planner_day_number=12
)
insert into public.course_guide_day_segments(school_id,course_id,guide_day_id,sequence_number,segment_type,segment_title,planned_minutes,instructor_actions,student_actions,notes,start_minute,end_minute)
select t.school_id,t.course_id,t.id,v.seq,v.typ,v.title,v.mins,v.ia,v.sa,
       'No new WLD 205 theory. Secure exam content never stored in LTG.',v.sm,v.em
from t cross join (values
 (1,'review','Non-Secure Trade Math Readiness Check',10,'Assign one parallel readiness item from previously taught trade-math domains.','Complete the assigned non-secure readiness item independently.',0,10),
 (2,'assessment','Official AWS SENSE II Trade Math Practical Knowledge Exam',35,'Administer only through the authorized secure testing procedure. No coaching.','Complete the secure exam under the stated testing rules.',10,45),
 (3,'closure','Secure Closeout + Status Record',15,'Close the secure environment and record only permitted status/evidence and next action.','Return materials, confirm completion, and follow the instructor direction for next action.',45,60)
) v(seq,typ,title,mins,ia,sa,sm,em);

with t as (
  select d.id,d.school_id,d.course_id from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.version_label='2026-09-14-DAY-L2-23-v1' and d.planner_day_number=20
)
insert into public.course_guide_day_segments(school_id,course_id,guide_day_id,sequence_number,segment_type,segment_title,planned_minutes,instructor_actions,student_actions,notes,start_minute,end_minute)
select t.school_id,t.course_id,t.id,v.seq,v.typ,v.title,v.mins,v.ia,v.sa,
       'Intentional theory hold. Apply only previously taught WLD 205 content to current WLD 210 evidence.',v.sm,v.em
from t cross join (values
 (1,'opening','Current Job / Source Check',10,'Identify the actual current WLD 210 work and the governing print/WPS/source.','Locate the source and state what evidence must be captured.',0,10),
 (2,'guided_practice','Source-to-Shop Application',30,'Coach one complete PRINT/SOURCE -> MATH/MATERIAL -> WPS -> EVIDENCE chain without introducing new theory.','Apply previously taught WLD 205 skills to current WLD 210 work.',10,40),
 (3,'independent_practice','Independent Evidence Record',15,'Require one traceable record from actual work; pending evidence stays pending.','Complete one independent source/evidence record.',40,55),
 (4,'closure','Theory Hold Close / WLD 210 Handoff',5,'Confirm both cohorts remain aligned for the next theory lesson.','Submit the record and return to WLD 210.',55,60)
) v(seq,typ,title,mins,ia,sa,sm,em);

with t as (
  select d.id,d.school_id,d.course_id from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.version_label='2026-09-14-DAY-L2-23-v1' and d.planner_day_number=21
)
insert into public.course_guide_day_segments(school_id,course_id,guide_day_id,sequence_number,segment_type,segment_title,planned_minutes,instructor_actions,student_actions,notes,start_minute,end_minute)
select t.school_id,t.course_id,t.id,v.seq,v.typ,v.title,v.mins,v.ia,v.sa,
       'No new WLD 205 theory. Secure exam content never stored in LTG.',v.sm,v.em
from t cross join (values
 (1,'review','Non-Secure Metallurgy Readiness Check',10,'Assign one source-based readiness item from previously taught metallurgy domains.','Complete the assigned non-secure metallurgy readiness item independently.',0,10),
 (2,'assessment','Official AWS SENSE II Welding Metallurgy Practical Knowledge Exam',35,'Administer only through the authorized secure testing procedure. No coaching.','Complete the secure exam under the stated testing rules.',10,45),
 (3,'closure','Secure Closeout + Status Record',15,'Close the secure environment and record only permitted status/evidence and next action.','Return materials, confirm completion, and follow the instructor direction for next action.',45,60)
) v(seq,typ,title,mins,ia,sa,sm,em);

-- WLD 205 resources copied for normal days.
with src_guide as (
  select g.id from public.course_guides g join public.courses c on c.id=g.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' limit 1
), target as (
  select d.planner_day_number,d.id,d.school_id,d.course_id
  from public.course_guide_days d join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.version_label='2026-09-14-DAY-L2-23-v1'
), map(target_day,source_day) as (
  values (1,10),(2,11),(3,12),(4,13),(5,14),(6,15),(7,16),(8,17),(9,18),
         (10,19),(11,20),(13,23),(14,24),(15,25),(16,26),(17,27),(18,28),
         (19,29),(22,32),(23,33)
), src_days as (
  select d.planner_day_number,d.id from public.course_guide_days d cross join src_guide sg where d.guide_id=sg.id
), res as (
  select m.target_day,r.*,row_number() over(partition by m.target_day order by r.sequence_number,r.id) as rn
  from map m join src_days sd on sd.planner_day_number=m.source_day
  join public.course_guide_day_resources r on r.guide_day_id=sd.id
)
insert into public.course_guide_day_resources(
  school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,
  resource_url,resource_notes,required,source_id,integration_mode,rights_basis,
  external_resource_id,outcome_id,student_safe,license_notes
)
select t.school_id,t.course_id,t.id,res.rn,res.resource_type,res.resource_title,
       res.resource_url,res.resource_notes,res.required,res.source_id,res.integration_mode,
       res.rights_basis,res.external_resource_id,res.outcome_id,res.student_safe,res.license_notes
from res join target t on t.planner_day_number=res.target_day;

-- Combined resources for assessment days.
with src_guide as (
  select g.id from public.course_guides g join public.courses c on c.id=g.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' limit 1
), target as (
  select d.planner_day_number,d.id,d.school_id,d.course_id
  from public.course_guide_days d join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.version_label='2026-09-14-DAY-L2-23-v1'
), map(target_day,source_day) as (values (12,21),(12,22),(21,30),(21,31)),
src_days as (
  select d.planner_day_number,d.id from public.course_guide_days d cross join src_guide sg where d.guide_id=sg.id
), res as (
  select m.target_day,r.*,row_number() over(partition by m.target_day order by m.source_day,r.sequence_number,r.id) as rn
  from map m join src_days sd on sd.planner_day_number=m.source_day
  join public.course_guide_day_resources r on r.guide_day_id=sd.id
)
insert into public.course_guide_day_resources(
  school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,
  resource_url,resource_notes,required,source_id,integration_mode,rights_basis,
  external_resource_id,outcome_id,student_safe,license_notes
)
select t.school_id,t.course_id,t.id,res.rn,res.resource_type,res.resource_title,
       res.resource_url,res.resource_notes,res.required,res.source_id,res.integration_mode,
       res.rights_basis,res.external_resource_id,res.outcome_id,res.student_safe,res.license_notes
from res join target t on t.planner_day_number=res.target_day;

with t as (
  select d.id,d.school_id,d.course_id from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.version_label='2026-09-14-DAY-L2-23-v1' and d.planner_day_number=20
)
insert into public.course_guide_day_resources(
  school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,
  resource_notes,required,integration_mode,rights_basis,student_safe,license_notes
)
select t.school_id,t.course_id,t.id,1,'other','Current WLD 210 Job Evidence + Approved Governing Sources',
       'Use the current approved print/WPS/SWPS and actual WLD 210 evidence. This is an application day, not a new theory lesson.',
       true,'native','school_owned',true,'No copied proprietary content; authorized sources remain controlling.'
from t;

-- Calendar mapping resource on every WLD 205 day.
with target as (
  select d.planner_day_number,d.id,d.school_id,d.course_id
  from public.course_guide_days d join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.version_label='2026-09-14-DAY-L2-23-v1'
), cal(day_no, note) as (values
 (1,'Day Level II Day 1 | 09/22/2026 | PVHS Day 10. Transition day. Day Level II completes intake math diagnostic in WLD 205; PVHS WLD 205 introduces no new theory and PVHS WLD 210 remains straight shop.'),
 (2,'Day Level II Day 2 | 09/23/2026 | PVHS Day 11. First shared new-theory day. Both cohorts receive the same WLD 205 lesson at the same time.'),
 (3,'Day Level II Day 3 | 09/24/2026 | PVHS Day 12. Shared new-theory day.'),
 (4,'Day Level II Day 4 | 09/28/2026 | PVHS Day 14. Shared new-theory day. PVHS Day 13 on Friday 2026-09-25 is a shop/application day with no new WLD 205 theory.'),
 (5,'Day Level II Day 5 | 09/29/2026 | PVHS Day 15. Shared new-theory day.'),
 (6,'Day Level II Day 6 | 09/30/2026 | PVHS Day 16. Shared new-theory day.'),
 (7,'Day Level II Day 7 | 10/01/2026 | PVHS Day 17. Shared new-theory day.'),
 (8,'Day Level II Day 8 | 10/05/2026 | PVHS Day 19. Shared new-theory day. PVHS Day 18 on Friday 2026-10-02 is a shop/application day with no new WLD 205 theory.'),
 (9,'Day Level II Day 9 | 10/06/2026 | PVHS Day 20. Shared new-theory day.'),
 (10,'Day Level II Day 10 | 10/07/2026 | PVHS Day 21. Shared new-theory day.'),
 (11,'Day Level II Day 11 | 10/08/2026 | PVHS Day 22. Shared new-theory day.'),
 (12,'Day Level II Day 12 | 10/13/2026 | PVHS Day 24. Shared assessment/readiness day. PVHS Day 23 on Friday 2026-10-09 is a shop/reinforcement day; 2026-10-12 is closed.'),
 (13,'Day Level II Day 13 | 10/14/2026 | PVHS Day 25. Shared new-theory day.'),
 (14,'Day Level II Day 14 | 10/15/2026 | PVHS Day 26. Shared new-theory day.'),
 (15,'Day Level II Day 15 | 10/19/2026 | PVHS Day 28. Shared new-theory day. PVHS Day 27 on Friday 2026-10-16 is a shop/application day with no new WLD 205 theory.'),
 (16,'Day Level II Day 16 | 10/20/2026 | PVHS Day 29. Shared new-theory day.'),
 (17,'Day Level II Day 17 | 10/21/2026 | PVHS Day 30. Shared new-theory day.'),
 (18,'Day Level II Day 18 | 10/22/2026 | PVHS Day 31. Shared new-theory day.'),
 (19,'Day Level II Day 19 | 10/26/2026 | PVHS Day 33. Shared new-theory day. PVHS Day 32 on Friday 2026-10-23 is a shop/application day with no new WLD 205 theory.'),
 (20,'Day Level II Day 20 | 10/27/2026 | PVHS not in attendance. Day Level II receives no new WLD 205 theory. Use application/shop-support work only.'),
 (21,'Day Level II Day 21 | 10/28/2026 | PVHS Day 34. Shared metallurgy readiness and secure assessment day.'),
 (22,'Day Level II Day 22 | 10/29/2026 | PVHS Day 35. Shared integration day.'),
 (23,'Day Level II Day 23 | 11/02/2026 | PVHS Day 37. Shared WLD 205 capstone and final Day Level II WLD 205 day. PVHS Day 36 on Friday 2026-10-30 is shop/capstone preparation only; no new WLD 205 theory.')
)
insert into public.course_guide_day_resources(
  school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,
  resource_notes,required,integration_mode,rights_basis,student_safe,license_notes
)
select t.school_id,t.course_id,t.id,90,'reference','Day Level II / PVHS Synchronization Map',
       cal.note,true,'native','school_owned',false,
       'Internal calendar/synchronization control. Does not alter protected course outcomes.'
from target t join cal on cal.day_no=t.planner_day_number;

-- ---------------------------------------------------------------------------
-- WLD 210 day rows.
-- ---------------------------------------------------------------------------
with src_guide as (
  select g.id
  from public.course_guides g join public.courses c on c.id=g.course_id
  where c.course_code='WLD 210'
    and g.guide_name='WLD 210 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Fabrication Extension'
    and g.status='active'
  limit 1
), target_guide as (
  select g.id
  from public.course_guides g join public.courses c on c.id=g.course_id
  where c.course_code='WLD 210' and g.version_label='2026-09-14-DAY-L2-23-v1'
  limit 1
), map(target_day,source_day) as (
  values (1,10),(2,11),(3,13),(4,14),(5,15),(6,16),(7,18),(8,19),(9,20),
         (10,21),(11,22),(12,23),(13,24),(14,25),(15,26),(16,27),(17,28),
         (18,29),(19,31),(20,32),(21,33),(22,29),(23,33)
)
insert into public.course_guide_days (
  school_id,course_id,guide_id,planner_day_number,title,objective,instructor_prep,
  safety_focus,opening_review,demonstration,guided_practice,independent_practice,
  instructor_checks,assessment,common_problems,teaching_tips,materials_equipment,
  corresponding_application,evidence_check_for_understanding,weekly_coaching_focus,
  coaching_focus,if_students_struggle,keep_momentum,aws_alignment,aws_key_indicators,
  safety_gate,procedure_variable_focus,evidence_type,inspection_acceptance_focus,
  focused_retry,record_link_expectation,qualification_guardrail
)
select d.school_id,d.course_id,tg.id,m.target_day,d.title,d.objective,d.instructor_prep,
       d.safety_focus,d.opening_review,d.demonstration,d.guided_practice,d.independent_practice,
       d.instructor_checks,d.assessment,d.common_problems,d.teaching_tips,d.materials_equipment,
       d.corresponding_application,d.evidence_check_for_understanding,d.weekly_coaching_focus,
       d.coaching_focus,d.if_students_struggle,d.keep_momentum,d.aws_alignment,d.aws_key_indicators,
       d.safety_gate,d.procedure_variable_focus,d.evidence_type,d.inspection_acceptance_focus,
       d.focused_retry,d.record_link_expectation,d.qualification_guardrail
from map m cross join src_guide sg cross join target_guide tg
join public.course_guide_days d on d.guide_id=sg.id and d.planner_day_number=m.source_day;

-- Day titles/objectives for accelerated shop sequence.
with target as (
  select d.planner_day_number,d.id from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 210' and g.version_label='2026-09-14-DAY-L2-23-v1'
)
update public.course_guide_days d set
  title = v.title,
  objective = coalesce(v.objective,d.objective),
  updated_at=now()
from target t
join (values
 (1,'Day Level II Day 1 - Intake / Shop Readiness Baseline','Use the first day as intake and shop-readiness baseline. Incoming Day Level II students complete the WLD 205 math diagnostic during the intake window; PVHS WLD 210 remains straight shop. Day Level II begins the accelerated WLD 210 core progression on Day 2.'),
 (2,'Accelerated Thermal Cutting I - Source-to-Shop + OFC Setup/Square-Edge Cutting','Combine source-to-shop workflow, thermal-cutting baseline, advanced OFC setup, and square-edge cutting into one extended Day Level II shop block while preserving safety, source-control, inspection, correction, and evidence requirements.'),
 (3,'Accelerated Thermal Cutting II - OFC Bevel Cutting + Workpiece Preparation',null),
 (4,'Accelerated Thermal Cutting III - PAC Square/Bevel/Shape Cutting',null),
 (5,'Accelerated Thermal Cutting IV - Cut Quality, Fit-Up Prep + Rework',null),
 (6,'Thermal Cutting Readiness + Official Knowledge Exam + Remaining Practical Evidence','Complete thermal-cutting readiness, administer the authorized secure practical knowledge exam, then use the extended shop block to finish legitimate OFC/PAC practical evidence and corrective work.'),
 (7,'SMAW Level II Plate Reset - WPS, Setup + Multipass Baseline',null),
 (8,'SMAW 3G - Joint Preparation, Fit-Up + Root/First Pass',null),
 (9,'SMAW 3G - Fill-Pass Control + Extended Repetition',null),
 (10,'SMAW 3G - Cap + Visual Inspection',null),
 (11,'SMAW 3G - Discontinuity Correction + Rework Cycle',null),
 (12,'SMAW 4G - Joint Preparation, Fit-Up + Root/First Pass',null),
 (13,'SMAW 4G - Fill-Pass Control + Extended Repetition',null),
 (14,'SMAW 4G - Cap + Visual Inspection',null),
 (15,'SMAW 4G - Discontinuity Correction + Rework Cycle',null),
 (16,'SMAW Parameter Control - Deliberate Adjustment + Repeatability',null),
 (17,'Fit-Up, Tack Strategy + Distortion-Control Exercise',null),
 (18,'SMAW Plate Readiness + Official Knowledge Exam + Targeted Remediation','Complete the non-secure SMAW plate readiness check, administer the official secure practical knowledge exam, then use the extended shop block for targeted non-secure remediation and legitimate test-readiness evidence.'),
 (19,'SMAW 3G Performance Qualification Attempt / Program Test',null),
 (20,'SMAW 4G Performance Qualification Attempt / Program Test',null),
 (21,'Accelerated WLD 210 Capstone - Cut -> Fit -> Weld -> Inspect -> Record',null),
 (22,'Targeted Remediation / Qualification Evidence Recovery','Use actual student evidence to target remaining WLD 210 deficiencies in thermal cutting, 3G, 4G, fit-up, parameter control, inspection, or documentation. No student is marked complete without the required evidence.'),
 (23,'Final Practical Closeout / Remaining Qualification Evidence','Complete legitimate remaining practical work, inspection, retest or evidence routing allowed by the program; audit the WLD 210 portfolio; and close the 23-day Day Level II sequence without inventing completion or qualification status.')
) v(day_no,title,objective) on v.day_no=t.planner_day_number
where d.id=t.id;

-- WLD 210 outcomes, including combined-source days.
with src_guide as (
  select g.id from public.course_guides g join public.courses c on c.id=g.course_id
  where c.course_code='WLD 210'
    and g.guide_name='WLD 210 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Fabrication Extension'
    and g.status='active' limit 1
), target as (
  select d.planner_day_number,d.id,d.school_id,d.course_id from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 210' and g.version_label='2026-09-14-DAY-L2-23-v1'
), map(target_day,source_day) as (
  values (1,10),(2,11),(2,12),(3,13),(4,14),(5,15),(6,16),(6,17),(7,18),(8,19),
         (9,20),(10,21),(11,22),(12,23),(13,24),(14,25),(15,26),(16,27),(17,28),
         (18,29),(18,30),(19,31),(20,32),(21,33),(22,29),(23,31),(23,32),(23,33)
), src_days as (
  select d.planner_day_number,d.id from public.course_guide_days d cross join src_guide sg where d.guide_id=sg.id
)
insert into public.course_guide_day_outcomes(school_id,course_id,guide_day_id,outcome_id)
select distinct t.school_id,t.course_id,t.id,o.outcome_id
from map m join src_days sd on sd.planner_day_number=m.source_day
join public.course_guide_day_outcomes o on o.guide_day_id=sd.id
join target t on t.planner_day_number=m.target_day
on conflict (guide_day_id,outcome_id) do nothing;

with target as (
  select d.id,d.school_id,d.course_id from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 210' and g.version_label='2026-09-14-DAY-L2-23-v1'
    and d.planner_day_number in (22,23)
)
insert into public.course_guide_day_outcomes(school_id,course_id,guide_day_id,outcome_id)
select t.school_id,t.course_id,t.id,o.id
from target t join public.course_outcomes o on o.course_id=t.course_id
on conflict (guide_day_id,outcome_id) do nothing;

-- Normal 300-minute Day L2 WLD 210 shop structure.
with target as (
  select d.id,d.school_id,d.course_id,d.planner_day_number,d.title
  from public.course_guide_days d join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 210' and g.version_label='2026-09-14-DAY-L2-23-v1'
    and d.planner_day_number not in (6,18,19,20)
)
insert into public.course_guide_day_segments(
  school_id,course_id,guide_day_id,sequence_number,segment_type,segment_title,
  planned_minutes,instructor_actions,student_actions,notes,start_minute,end_minute
)
select t.school_id,t.course_id,t.id,v.seq,v.typ,
       case v.seq
         when 1 then 'Toolbox Talk / Demonstration - '||t.title
         when 2 then 'Guided Shop Cycle'
         when 3 then 'Extended Independent Practice'
         when 4 then 'Inspect / Correct / Record Evidence'
         else 'Cleanup / Accountability / Handoff' end,
       v.mins,
       case v.seq
         when 1 then 'Open with the approved source/WPS and demonstrate only the critical setup, safety, technique, or inspection point for today.'
         when 2 then 'Coach the assigned task with controlled corrections. Require source use, safe setup, and deliberate technique.'
         when 3 then 'Maximize arc/cut time. Reduce prompting and require students to repeat the assigned skill until evidence is stable.'
         when 4 then 'Inspect actual work, require correction/recheck where needed, and record only evidence that actually exists.'
         else 'Complete cleanup, tool accountability, hot-metal control, and status handoff.' end,
       case v.seq
         when 1 then 'Follow the toolbox talk/demo and identify the controlling source and today''s evidence target.'
         when 2 then 'Perform the assigned shop task with instructor coaching and corrections.'
         when 3 then 'Repeat the skill independently, making only approved adjustments and preserving evidence.'
         when 4 then 'Inspect, correct/recheck, and record actual results.'
         else 'Clean the station, account for tools/material, and confirm next action.' end,
       'Day Level II accelerated WLD 210. Same protected outcomes as PVHS; pacing differs because the day cohort has an extended shop block.',
       v.sm,v.em
from target t cross join (values
 (1,'demonstration',25,0,25),(2,'guided_practice',120,25,145),
 (3,'independent_practice',110,145,255),(4,'assessment',35,255,290),
 (5,'closure',10,290,300)
) v(seq,typ,mins,sm,em);

-- WLD 210 custom secure/test days.
with t as (
  select d.id,d.school_id,d.course_id from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 210' and g.version_label='2026-09-14-DAY-L2-23-v1' and d.planner_day_number=6
)
insert into public.course_guide_day_segments(school_id,course_id,guide_day_id,sequence_number,segment_type,segment_title,planned_minutes,instructor_actions,student_actions,notes,start_minute,end_minute)
select t.school_id,t.course_id,t.id,v.seq,v.typ,v.title,v.mins,v.ia,v.sa,
       'Secure exam content is never stored in LTG. Practical evidence remains separate from exam content.',v.sm,v.em
from t cross join (values
 (1,'review','Thermal Cutting Readiness Check',20,'Use only non-secure readiness evidence and the approved practical checklist.','Complete the assigned non-secure readiness check.',0,20),
 (2,'assessment','Official Thermal Cutting Practical Knowledge Exam',35,'Administer the approved secure exam with no coaching.','Complete the secure exam under testing rules.',20,55),
 (3,'demonstration','PPE / Equipment Re-Entry Check',15,'Re-establish shop controls before practical work resumes.','Verify PPE, equipment, and work-area controls.',55,70),
 (4,'guided_practice','Remaining OFC / PAC Practical Evidence',190,'Use the long block to finish legitimate cutting evidence and corrective work.','Complete assigned cutting evidence and corrections.',70,260),
 (5,'assessment','Inspection / Correction / Evidence Record',30,'Inspect actual work and record only verified evidence.','Inspect, correct/recheck, and record actual results.',260,290),
 (6,'closure','Cleanup / Closeout',10,'Complete cleanup and status handoff.','Clean the station and confirm next action.',290,300)
) v(seq,typ,title,mins,ia,sa,sm,em);

with t as (
  select d.id,d.school_id,d.course_id from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 210' and g.version_label='2026-09-14-DAY-L2-23-v1' and d.planner_day_number=18
)
insert into public.course_guide_day_segments(school_id,course_id,guide_day_id,sequence_number,segment_type,segment_title,planned_minutes,instructor_actions,student_actions,notes,start_minute,end_minute)
select t.school_id,t.course_id,t.id,v.seq,v.typ,v.title,v.mins,v.ia,v.sa,
       'Secure exam content is never stored in LTG. Remediation uses non-secure parallel evidence only.',v.sm,v.em
from t cross join (values
 (1,'review','SMAW Plate Readiness Check',20,'Use the approved non-secure readiness checklist and actual weld evidence.','Complete the assigned readiness check.',0,20),
 (2,'assessment','Official AWS SENSE II SMAW Plate Practical Knowledge Exam',35,'Administer the secure exam with no coaching.','Complete the secure exam under testing rules.',20,55),
 (3,'demonstration','Shop Re-Entry / Targeted Correction Demo',20,'Demonstrate one non-secure correction tied to actual evidence.','Observe the targeted correction and identify the variable being controlled.',55,75),
 (4,'guided_practice','Targeted SMAW Remediation + Repeatability',185,'Assign only the remaining demonstrated weakness and require repeated evidence.','Practice the assigned 3G/4G or parameter-control weakness and repeat until stable.',75,260),
 (5,'assessment','Visual / Dimensional Evidence Check',30,'Inspect, correct/recheck, and record actual status.','Inspect and record actual results.',260,290),
 (6,'closure','Cleanup / Test-Day Prep',10,'Close the shop and confirm the next qualification route.','Clean the station and confirm next action.',290,300)
) v(seq,typ,title,mins,ia,sa,sm,em);

with target as (
  select d.id,d.school_id,d.course_id,d.planner_day_number
  from public.course_guide_days d join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 210' and g.version_label='2026-09-14-DAY-L2-23-v1'
    and d.planner_day_number in (19,20)
)
insert into public.course_guide_day_segments(school_id,course_id,guide_day_id,sequence_number,segment_type,segment_title,planned_minutes,instructor_actions,student_actions,notes,start_minute,end_minute)
select t.school_id,t.course_id,t.id,v.seq,v.typ,
       case when t.planner_day_number=19 then replace(v.title,'POSITION','3G') else replace(v.title,'POSITION','4G') end,
       v.mins,v.ia,v.sa,
       'Qualification remains pending unless the approved evaluation process and required evidence are complete.',v.sm,v.em
from target t cross join (values
 (1,'opening','POSITION Test-Day Safety / Source Check',25,'Verify test-day safety, approved procedure/source, coupon identity, and permitted conditions.','Verify PPE, source, coupon, and test-day instructions.',0,25),
 (2,'assessment','POSITION Final Non-Coaching Setup Verification',20,'Verify setup without coaching technique or tested content.','Complete the final setup independently.',25,45),
 (3,'assessment','POSITION SMAW Plate Performance Test / Program Attempt',200,'Administer the approved performance attempt and preserve traceable evidence.','Complete the approved performance attempt.',45,245),
 (4,'assessment','Visual Examination / Specimen Routing',35,'Perform permitted visual examination and route specimens/evidence correctly.','Present the completed work for examination and follow specimen-routing instructions.',245,280),
 (5,'closure','Record Status / Cleanup',20,'Record actual status, keep pending evidence pending, and complete cleanup.','Clean the station and confirm recorded status.',280,300)
) v(seq,typ,title,mins,ia,sa,sm,em);

-- WLD 210 standard resources on every day.
with target as (
  select d.id,d.school_id,d.course_id,d.planner_day_number
  from public.course_guide_days d join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 210' and g.version_label='2026-09-14-DAY-L2-23-v1'
)
insert into public.course_guide_day_resources(
  school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,
  resource_url,resource_notes,required,integration_mode,rights_basis,student_safe,license_notes
)
select school_id,course_id,id,10,'other','Launch Level II Live Job Card','/classroom/job-card',
       'Launch a section-scoped Live Job Card tied to the actual planner day. Record actual settings, measurements, inspection, correction/recheck, and evidence only.',
       true,'native','school_owned',false,'LTG/PCCC instructional record; does not itself create AWS qualification.'
from target;

with target as (
  select d.id,d.school_id,d.course_id from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 210' and g.version_label='2026-09-14-DAY-L2-23-v1'
)
insert into public.course_guide_day_resources(
  school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,
  resource_notes,required,integration_mode,rights_basis,student_safe,license_notes
)
select school_id,course_id,id,20,'reference','Approved WPS / SWPS / WPQTS + Current Print',
       'Use only the current instructor-authorized procedure, print, and qualification/test source applicable to today. Never invent amperage, dimensions, acceptance limits, or test conditions.',
       true,'file_reference','school_authorized',true,'Authorized school/AWS-controlled sources remain controlling.'
from target;

with target as (
  select d.id,d.school_id,d.course_id from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 210' and g.version_label='2026-09-14-DAY-L2-23-v1'
)
insert into public.course_guide_day_resources(
  school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,
  resource_notes,required,integration_mode,rights_basis,student_safe,license_notes
)
select school_id,course_id,id,30,'other','Daily Shop Evidence / Inspection Record',
       'Capture actual fit-up, parameter, cut/weld, visual/dimensional inspection, corrective-action, and recheck evidence required by today''s task.',
       true,'native','school_owned',true,'Original LTG/PCCC evidence workflow.'
from target;

with target as (
  select d.id,d.school_id,d.course_id from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 210' and g.version_label='2026-09-14-DAY-L2-23-v1'
    and d.planner_day_number in (6,18,19,20,23)
)
insert into public.course_guide_day_resources(
  school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,
  resource_notes,required,integration_mode,rights_basis,student_safe,license_notes
)
select school_id,course_id,id,40,'document','Secure Exam / Performance-Test Administration Checklist',
       'Instructor-only checklist for roster, approved accommodations, test security, coupon/specimen identity, permitted evidence, and status routing. Secure questions/answers are never stored in LTG.',
       true,'file_reference','school_authorized',false,'Instructor-only; secure AWS/PCCC testing source controls.'
from target;

-- Calendar reference for WLD 210 Day L2 section creation later.
with target as (
  select d.planner_day_number,d.id,d.school_id,d.course_id
  from public.course_guide_days d join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 210' and g.version_label='2026-09-14-DAY-L2-23-v1'
), cal(day_no,class_date) as (values
 (1,'09/22/2026'),(2,'09/23/2026'),(3,'09/24/2026'),(4,'09/28/2026'),
 (5,'09/29/2026'),(6,'09/30/2026'),(7,'10/01/2026'),(8,'10/05/2026'),
 (9,'10/06/2026'),(10,'10/07/2026'),(11,'10/08/2026'),(12,'10/13/2026'),
 (13,'10/14/2026'),(14,'10/15/2026'),(15,'10/19/2026'),(16,'10/20/2026'),
 (17,'10/21/2026'),(18,'10/22/2026'),(19,'10/26/2026'),(20,'10/27/2026'),
 (21,'10/28/2026'),(22,'10/29/2026'),(23,'11/02/2026')
)
insert into public.course_guide_day_resources(
  school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,
  resource_notes,required,integration_mode,rights_basis,student_safe,license_notes
)
select t.school_id,t.course_id,t.id,90,'reference','Day Level II Calendar Map',
       'Day Level II Day '||t.planner_day_number||' | '||cal.class_date||'. Draft curriculum mapping only; live section activation is separate.',
       true,'native','school_owned',false,'Internal scheduling reference; protected outcomes unchanged.'
from target t join cal on cal.day_no=t.planner_day_number;

commit;
