-- WLD 205 remaining-day instructor-support upgrade.
-- Improves Day 4 and Days 10-55 without changing protected course outcomes.
-- Authorized prints, WPS/SWPS, material references, licensed Chasan content, and secure AWS exams remain controlling.

-- DAY 4: finish the skipped bridge resource/support pass.
with target as (
  select d.id as guide_day_id,d.school_id,d.course_id
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205'
    and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' and d.planner_day_number=4
  order by g.updated_at desc limit 1
)
update public.course_guide_days d set
  instructor_prep='BEFORE CLASS: Launch Day 4 Live Class Activity. Open/print the Day 4 Decimal Student Pack and Instructor Guide. Stage ruler/tape and caliper if available. Keep the live whiteboard visible. Do not make an accept/reject decision unless a stated tolerance/source is present.',
  opening_review='0–8 min — Fraction/Decimal Retrieval: Students convert 1/8, 1/4, 3/8, 1/2, 5/8, 3/4, and 7/8 in, then complete Live Questions 1–7. Correction cue: numerator ÷ denominator; preserve the unit.',
  demonstration='8–20 min — Model 3/8 in = 0.375 in and 1 7/16 in = 1.4375 in. Show reverse reasoning with a common shop fraction/decimal. Emphasize that changing number format does not change physical length.',
  guided_practice='20–40 min — Decimal Shop Set A: 2.375 + 1.625; 6.500 − 2.1875; 1.25 × 3; 7.5 ÷ 3. Require work, answer with unit, and one reasonableness check; complete Live Questions 8–11.',
  independent_practice='40–54 min — Measurement Record: Convert 1 3/8 in to 1.375 in, compare to 1.372 in, calculate absolute difference 0.003 in, and state why difference alone is not an accept/reject decision. Complete Live Questions 12–13.',
  assessment='54–60 min — Rounding/Tolerance Preview: complete Live Questions 14–15 independently. 2.3764 to nearest .001 = 2.376; 4.000 ± .020 gives 3.980–4.020. Day 7 owns formal tolerance accept/reject reasoning.',
  instructor_checks='Instructor Rule: READ VALUE → CONVERT → CALCULATE/COMPARE → KEEP UNIT → ROUND ONLY WHEN DIRECTED → CHECK SOURCE. Remediate only the unresolved domain: Fraction→Decimal, Decimal Operations, Measurement Comparison, Rounding/Precision, or Tolerance Preview.',
  common_problems='Dropping units; converting the denominator incorrectly; mixing fraction and decimal values without conversion; rounding too early; treating a measured difference as an automatic pass/fail; or changing a measured value to fit a tolerance.',
  teaching_tips='Ask students to say the operation before calculating. Keep original and converted measurements visible side-by-side. For every comparison ask: What source gives the required precision or tolerance?',
  materials_equipment='Day 4 Decimal Student Pack; Day 4 Instructor Guide; live whiteboard; ruler/tape; caliper where available; authorized conversion/tolerance source where used.',
  updated_at=now()
from target t where d.id=t.guide_day_id;

with target as (
  select d.id as guide_day_id from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' and d.planner_day_number=4 order by g.updated_at desc limit 1
)
update public.course_guide_day_segments s set
  instructor_actions=case s.sequence_number
    when 1 then 'Use the Day 4 Student Pack retrieval set. Students convert the seven common fractions and complete Live Questions 1–7. Correct conversion method and units immediately.'
    when 2 then 'Model 3/8 → 0.375 and 1 7/16 → 1.4375, then reverse one common decimal to a fraction using the authorized reference/method. Keep units visible.'
    when 3 then 'Run Decimal Shop Set A. Require work, unit, and reasonableness check before Live Questions 8–11.'
    when 4 then 'Use the Measurement Record: 1 3/8 = 1.375; compare to 1.372; absolute difference .003. Ask why this is not yet a pass/fail decision; complete Live Questions 12–13.'
    when 5 then 'Run Live Questions 14–15 independently. Preview rounding and limits only; do not replace Day 7 tolerance instruction.'
    else s.instructor_actions end,
  student_actions=case s.sequence_number
    when 1 then 'Convert all seven common fractions to decimals with units and complete Live Questions 1–7.'
    when 2 then 'Follow both conversion examples and explain the conversion operation in plain language.'
    when 3 then 'Complete all four Decimal Shop Set A problems with work, units, and a reasonableness check; answer Live Questions 8–11.'
    when 4 then 'Complete the measurement record, calculate the .003 in difference, and explain why a tolerance/source is still required; answer Live Questions 12–13.'
    when 5 then 'Complete Live Questions 14–15 independently without instructor help.'
    else s.student_actions end,
  notes='2026-09-09 Day 4 instructor-support completion. Protected outcomes unchanged.',updated_at=now()
from target t where s.guide_day_id=t.guide_day_id and s.sequence_number between 1 and 5;

update public.assessment_modules set version=greatest(coalesce(version,0),13),
  instructions='DAY 4 LIVE CLASS\n0–8 min — Convert 1/8, 1/4, 3/8, 1/2, 5/8, 3/4, and 7/8 in; complete Questions 1–7.\n8–20 min — Model 3/8 and 1 7/16 conversions and reverse reasoning. Preserve units.\n20–40 min — Decimal Shop Set A; show work, units, and reasonableness; complete Questions 8–11.\n40–54 min — Measurement Record: convert 1 3/8 to decimal, compare to 1.372 in, find absolute difference, and explain why tolerance/source is still required; complete Questions 12–13.\n54–60 min — Complete Questions 14–15 independently as rounding/tolerance preview.\nDo not round a measurement to make it pass or invent a tolerance.',
  reference_body='Preserve the unit. Convert before comparing. Round only to the precision required by the source/job. A measured difference is not automatically an accept/reject decision; the stated tolerance/source is required.'
where slug='wld205_pvhs_bridge_day4';

-- DAYS 10-55: day-level delivery support and explicit source/evidence rules.
with target as (
  select d.id,d.planner_day_number,d.title from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' and d.planner_day_number between 10 and 55
)
update public.course_guide_days d set
  instructor_prep=case
    when t.planner_day_number=10 then 'BEFORE CLASS: Open the Days 10–33 Instructor Guide at Day 10. Verify the incoming PCCC math diagnostic and coordinate the WLD-210 full-shop overlap. PVHS has no WLD-205 theory today.'
    when t.planner_day_number in (22,31) then 'BEFORE CLASS: Open the secure AWS Exam Administration Checklist and the authorized testing procedure. Verify roster, approved accommodations, devices/materials, secure environment, and permitted status-recording workflow. Do not store secure exam content in LTG.'
    when t.planner_day_number between 11 and 33 then 'BEFORE CLASS: Open the WLD 205 Days 10–33 Instructor Guide at Day '||t.planner_day_number||' and the student record named in Resources. Open the exact authorized print/WPS/material/metallurgy or licensed math source named for today. Stage one correct source-based example and one realistic error. Coordinate with WLD-210 so referenced physical evidence actually exists.'
    else 'BEFORE CLASS: Open the WLD 205 Days 34–55 Project Extension Instructor Guide at Day '||t.planner_day_number||' and the student record named in Resources. Have the current project print/brief, approved WPS/SWPS, material/source records, measurement/inspection packet, and actual WLD-210 evidence available. Never invent acceptance limits, procedure values, revisions, or physical evidence.' end,
  materials_equipment=case
    when t.planner_day_number=10 then 'Days 10–33 Instructor Guide — Day 10; connected incoming PCCC Pre-Class Welding Math Assessment; WLD-210 Day 10 resources control all physical work.'
    when t.planner_day_number in (22,31) then 'Secure AWS Exam Administration Checklist; authorized AWS secure testing system/materials; approved roster/accommodations; no secure questions or answers stored in LTG.'
    when t.planner_day_number between 11 and 21 then 'Days 10–33 Instructor Guide — Day '||t.planner_day_number||'; Source→Calculate→Verify student record or Focused Readiness record as listed; authorized daily print/source; licensed Chasan pages/original PCCC items named in the planner; calculator/measuring tools as allowed.'
    when t.planner_day_number between 23 and 30 then 'Days 10–33 Instructor Guide — Day '||t.planner_day_number||'; Material→Heat→Effect→Risk→Control student record; authorized metallurgy/material reference; approved WPS/material context; samples/photos only where instructor-approved; licensed math source named in planner.'
    when t.planner_day_number between 32 and 33 then 'Days 10–33 Instructor Guide — Day '||t.planner_day_number||'; Governing-Source/Source→Calculate records as listed; approved print; WPS/SWPS; material/source documentation; actual or explicitly pending WLD-210 evidence.'
    else 'Days 34–55 Project Extension Instructor Guide — Day '||t.planner_day_number||'; project record named in Resources; current project print/brief; approved WPS/SWPS; material/source records; measurement/inspection documentation; actual WLD-210 evidence.' end,
  instructor_checks=case
    when t.planner_day_number=10 then 'Verify the PCCC diagnostic completes and support needs are recorded. Verify PVHS remains under the WLD-210 Day 10 shop plan. Do not create common WLD-205 theory evidence.'
    when t.planner_day_number in (22,31) then 'Secure Exam Rule: follow the authorized procedure; record only permitted status/evidence. Never store or reconstruct secure questions, answer choices, answers, screenshots, or coached item content in LTG.'
    when t.planner_day_number between 11 and 21 then 'Instructor Rule: SOURCE → CALCULATE / INTERPRET → PLAN → VERIFY → RECORD. Require source location and units/evidence. If a student struggles, remediate one weak domain with one parallel item; do not repeat a secure domain.'
    when t.planner_day_number between 23 and 30 then 'Instructor Rule: MATERIAL → HEAT/CONDITION → EFFECT → RISK → SOURCE-CONTROLLED CONTROL. Separate observation from exact conclusion. Remediate only the unresolved metallurgy domain with a parallel source-based item.'
    when t.planner_day_number between 32 and 33 then 'Instructor Rule: locate the governing source before deciding. Trace PRINT → MATH → METALLURGY → WPS/SOURCE → ACTUAL/PENDING WLD-210 EVIDENCE → RECORD. Pending evidence stays pending.'
    else 'Instructor Rule: PRINT/SOURCE → PLAN/MATH → WPS/MATERIAL → ACTUAL WLD-210 EVIDENCE → INSPECT/RECHECK → RECORD. Preserve original measurements and document only work/evidence that actually occurred.' end,
  common_problems=case
    when t.planner_day_number in (22,31) then 'Unsecured testing materials; coaching or paraphrasing secure questions; copying screenshots/prompts into LTG; recording more than the permitted exam status/evidence.'
    when t.planner_day_number between 11 and 21 then 'Guessing instead of locating the source; dropping units; selecting a formula before identifying the required quantity; rounding too early; treating a measured difference as acceptance without limits; repeating already-secure domains.'
    when t.planner_day_number between 23 and 30 then 'Treating appearance as exact material identification; confusing observation with metallurgical cause; inventing hardness/microstructure/procedure values; using general theory as a substitute for material/WPS source context.'
    when t.planner_day_number between 32 and 33 then 'Using the wrong governing source; filling missing values from memory; treating pending WLD-210 evidence as completed; changing a controlled requirement without authorization.'
    else 'Using stale or wrong project revisions; unsupported kerf/allowance or acceptance values; losing source traceability; erasing original measurements; backfilling evidence for physical work that did not occur; sending unverified instructions to WLD-210.' end,
  teaching_tips=case
    when t.planner_day_number=10 then 'Keep cohort directions visually separate. The diagnostic is intake support only; the shop overlap controls the rest of the day.'
    when t.planner_day_number in (22,31) then 'Keep administration boring and controlled. Security outranks convenience. Use broad permitted status/domain language for follow-up, never secure item content.'
    when t.planner_day_number between 11 and 21 then 'Ask three questions repeatedly: Which source? What unit/result? How did you verify it? Make students point to the source before calculation or interpretation.'
    when t.planner_day_number between 23 and 30 then 'Ask in order: What material/source? What heat/condition? What effect is supported? What risk matters? Which source controls the response? Reduce prompting as the chain becomes independent.'
    when t.planner_day_number between 32 and 33 then 'Have students draw the source chain before starting. Audit one decision end-to-end instead of checking isolated answers.'
    else 'Keep the WLD-205/WLD-210 boundary explicit. WLD-205 plans and records; WLD-210 performs physical work. Require a source/evidence location beside every important project decision.' end,
  updated_at=now()
from target t where d.id=t.id;

-- Make student actions explicit and evidence-oriented across the remaining sequence.
with target as (
  select d.id as guide_day_id,d.planner_day_number from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' and d.planner_day_number between 10 and 55
)
update public.course_guide_day_segments s set student_actions=case
  when t.planner_day_number=10 then case s.sequence_number when 1 then 'Follow your cohort direction: PVHS reports to WLD-210; incoming PCCC completes the connected diagnostic independently, then joins WLD-210.' else 'Remain with the WLD-210 overlap. Do not begin a WLD-205 theory packet.' end
  when t.planner_day_number in (22,31) then case when s.segment_title ilike '%Exam%' then 'Complete the authorized secure exam under the stated testing rules. Do not copy, photograph, discuss, or reproduce secure content.' else 'Follow the secure setup/closeout direction and provide only permitted administrative information.' end
  when t.planner_day_number between 11 and 21 then case
    when s.segment_title ilike '%Math Day%' then 'Complete the named licensed/original PCCC math activity using GIVEN → OPERATION/FORMULA → WORK → ANSWER WITH UNIT → CHECK. Record the source/units requested.'
    when s.segment_title ilike '%Readiness%' or s.segment_title ilike '%Remediation%' then 'Complete the assigned non-secure readiness/repair item independently where directed. Work only the identified weak domain and record the recheck result.'
    when s.segment_title ilike '%Evidence Check%' or s.segment_title ilike '%Independent Check%' then 'Complete the named independent check without coaching. Cite the source/location, show units/work where applicable, and record the verification.'
    when s.segment_title ilike '%Blueprint%' or s.segment_title ilike '%Source%' or s.segment_title ilike '%Joint%' or s.segment_title ilike '%WPS%' or s.segment_title ilike '%Assembly%' then 'Locate the exact controlling feature/source for the named task, mark or record it, complete the required interpretation/calculation, and verify before moving on.'
    else 'Complete the named '||s.segment_title||' task using the authorized source. Show the decision/work with units or evidence, verify it, and record the result.' end
  when t.planner_day_number between 23 and 30 then case
    when s.segment_title ilike '%Math Day%' then 'Complete the named math activity using the licensed/original source. Show work, units, and a verification check.'
    when s.segment_title ilike '%Readiness%' or s.segment_title ilike '%Remediation%' then 'Complete only the assigned non-secure metallurgy readiness/repair domain, then complete one new independent parallel recheck.'
    when s.segment_title ilike '%Evidence Check%' or s.segment_title ilike '%Decision Check%' then 'Complete one independent source-based metallurgy decision using MATERIAL → HEAT/CONDITION → EFFECT → RISK → CONTROL. State what cannot be concluded.'
    else 'Complete the named '||s.segment_title||' task from the authorized material/metallurgy/WPS source. Separate observation from exact conclusion and record the supported risk/control.' end
  when t.planner_day_number between 32 and 33 then case
    when s.segment_title ilike '%Math Day%' then 'Complete the integrated job-math item with source values, operation/formula, work, units, and verification.'
    when s.segment_title ilike '%Audit%' then 'Audit the record using actual or explicitly pending WLD-210 evidence. Mark missing/pending evidence accurately; do not invent completion.'
    else 'Complete the named '||s.segment_title||' task by tracing the governing source and recording the decision chain from print/source through calculation/material/WPS to evidence.' end
  else case
    when s.segment_title ilike '%Handoff%' then 'Hand off only verified print/source/math/WPS/evidence requirements to WLD-210. Do not add assumptions or unapproved changes.'
    when s.segment_title ilike '%Math%' or s.segment_title ilike '%Cut List%' or s.segment_title ilike '%Takeoff%' or s.segment_title ilike '%Geometry%' then 'Complete the named project math/takeoff task from the current print/source. Show source values, operation/formula, work, answer with units, and verification.'
    when s.segment_title ilike '%Material%' or s.segment_title ilike '%Metallurgy%' or s.segment_title ilike '%Distortion%' or s.segment_title ilike '%HAZ%' or s.segment_title ilike '%WPS%' then 'Complete the named material/WPS/distortion task from the actual project sources using MATERIAL/CONDITION → RISK → SOURCE-CONTROLLED PLAN. List the WLD-210 evidence required.'
    when s.segment_title ilike '%Evidence%' or s.segment_title ilike '%Measurement%' or s.segment_title ilike '%Inspection%' or s.segment_title ilike '%Corrective%' or s.segment_title ilike '%Audit%' or s.segment_title ilike '%Closeout%' or s.segment_title ilike '%As-Built%' then 'Record actual WLD-210 evidence for the named task, compare it to the controlling requirement, preserve original results, and document only the verified correction/recheck/closeout status.'
    when s.segment_title ilike '%Print%' or s.segment_title ilike '%Source%' or s.segment_title ilike '%Joint%' or s.segment_title ilike '%Project%' then 'Use the current project print/source to complete the named task. Mark the controlling dimensions/notes/source chain and flag any unknown instead of guessing.'
    else 'Complete the named '||s.segment_title||' task from the current project source and actual WLD-210 evidence. Verify the result and record its source/evidence location.' end end,
  notes=coalesce(s.notes,'')||' | 2026-09-09 remaining-day instructor-support upgrade; protected outcomes unchanged.',updated_at=now()
from target t where s.guide_day_id=t.guide_day_id;

-- Replace only the resources owned by this upgrade.
with target as (
  select d.id as guide_day_id from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' and (d.planner_day_number=4 or d.planner_day_number between 10 and 55)
)
delete from public.course_guide_day_resources r using target t
where r.guide_day_id=t.guide_day_id and r.resource_title like 'WLD 205 Support:%';

-- Day 4 resources.
with target as (
  select d.id as guide_day_id,d.school_id,d.course_id from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' and d.planner_day_number=4 order by g.updated_at desc limit 1
)
insert into public.course_guide_day_resources(school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,resource_notes,required,integration_mode,rights_basis,student_safe,license_notes)
select t.school_id,t.course_id,t.guide_day_id,v.seq,'other',v.title,v.url,v.notes,true,'native','school_owned',v.safe,'Original PCCC/LTG support content; authorized sources remain controlling.'
from target t cross join (values
 (1,'WLD 205 Support: Day 4 Decimal Student Pack','/live-activities/wld205-day4-decimal-student-pack.html','Fraction/decimal retrieval, Decimal Shop Set A, measurement record, and rounding/tolerance preview.',true),
 (2,'WLD 205 Support: Day 4 Instructor Guide','/live-activities/wld205-day4-instructor-guide.html','Instructor timing, worked keys, correction cues, live-question mapping, and focused remediation.',false)
) v(seq,title,url,notes,safe);

-- Days 10-33 instructor guide on every day in the block.
with target as (
  select d.id as guide_day_id,d.school_id,d.course_id,d.planner_day_number from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' and d.planner_day_number between 10 and 33
)
insert into public.course_guide_day_resources(school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,resource_notes,required,integration_mode,rights_basis,student_safe,license_notes)
select school_id,course_id,guide_day_id,1,'other','WLD 205 Support: Days 10-33 Instructor Guide — Day '||planner_day_number,
 '/live-activities/wld205-days10-33-instructor-guide.html#day'||planner_day_number,
 'Day-specific instructor cues, evidence expectations, source boundaries, and remediation guidance.',true,'native','school_owned',false,'Original PCCC/LTG instructor support; authorized sources remain controlling.' from target;

-- Student records for common-core/math/metallurgy/source days.
with target as (
  select d.id as guide_day_id,d.school_id,d.course_id,d.planner_day_number from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' and d.planner_day_number between 11 and 21
)
insert into public.course_guide_day_resources(school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,resource_notes,required,integration_mode,rights_basis,student_safe,license_notes)
select school_id,course_id,guide_day_id,2,'other',
 case when planner_day_number=21 then 'WLD 205 Support: Focused Readiness Record' else 'WLD 205 Support: Source → Calculate → Verify Record' end,
 case when planner_day_number=21 then '/live-activities/wld205-reusable-student-records.html#readiness' else '/live-activities/wld205-reusable-student-records.html#source-calc' end,
 case when planner_day_number=21 then 'Non-secure domain-remediation/recheck record.' else 'Reusable student source/calculation/verification evidence record.' end,
 true,'native','school_owned',true,'Original PCCC/LTG student record.' from target;

with target as (
  select d.id as guide_day_id,d.school_id,d.course_id,d.planner_day_number from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' and d.planner_day_number in (22,31)
)
insert into public.course_guide_day_resources(school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,resource_notes,required,integration_mode,rights_basis,student_safe,license_notes)
select school_id,course_id,guide_day_id,2,'other','WLD 205 Support: Secure AWS Exam Administration Checklist','/live-activities/wld205-secure-exam-checklist.html','Administrative setup/security/closeout checklist only; contains no secure exam items.',true,'native','school_owned',false,'Original administrative checklist. Secure AWS content is never stored in LTG.' from target;

with target as (
  select d.id as guide_day_id,d.school_id,d.course_id,d.planner_day_number from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' and d.planner_day_number between 23 and 30
)
insert into public.course_guide_day_resources(school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,resource_notes,required,integration_mode,rights_basis,student_safe,license_notes)
select school_id,course_id,guide_day_id,2,'other','WLD 205 Support: Material → Heat → Effect → Risk → Control Record','/live-activities/wld205-reusable-student-records.html#metallurgy','Reusable source-controlled metallurgy decision record.',true,'native','school_owned',true,'Original PCCC/LTG student record.' from target;

with target as (
  select d.id as guide_day_id,d.school_id,d.course_id,d.planner_day_number from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' and d.planner_day_number in (30)
)
insert into public.course_guide_day_resources(school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,resource_notes,required,integration_mode,rights_basis,student_safe,license_notes)
select school_id,course_id,guide_day_id,3,'other','WLD 205 Support: Focused Readiness Record','/live-activities/wld205-reusable-student-records.html#readiness','Non-secure metallurgy domain remediation/recheck record.',true,'native','school_owned',true,'Original PCCC/LTG student record.' from target;

with target as (
  select d.id as guide_day_id,d.school_id,d.course_id,d.planner_day_number from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' and d.planner_day_number in (32,33)
)
insert into public.course_guide_day_resources(school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,resource_notes,required,integration_mode,rights_basis,student_safe,license_notes)
select school_id,course_id,guide_day_id,2,'other','WLD 205 Support: Blueprint / Governing-Source Record','/live-activities/wld205-reusable-student-records.html#blueprint-source','Student source-map/governing-source evidence record.',true,'native','school_owned',true,'Original PCCC/LTG student record.' from target;

with target as (
  select d.id as guide_day_id,d.school_id,d.course_id from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' and d.planner_day_number=33
)
insert into public.course_guide_day_resources(school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,resource_notes,required,integration_mode,rights_basis,student_safe,license_notes)
select school_id,course_id,guide_day_id,3,'other','WLD 205 Support: Source → Calculate → Verify Record','/live-activities/wld205-reusable-student-records.html#source-calc','Capstone math/source/verification evidence record.',true,'native','school_owned',true,'Original PCCC/LTG student record.' from target;

-- Days 34-55 project guide on every project-extension/closeout day.
with target as (
  select d.id as guide_day_id,d.school_id,d.course_id,d.planner_day_number from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' and d.planner_day_number between 34 and 55
)
insert into public.course_guide_day_resources(school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,resource_notes,required,integration_mode,rights_basis,student_safe,license_notes)
select school_id,course_id,guide_day_id,1,'other','WLD 205 Support: Project Extension Instructor Guide — Day '||planner_day_number,
 '/live-activities/wld205-days34-55-instructor-guide.html#day'||planner_day_number,'Day-specific project planning/evidence/handoff guidance.',true,'native','school_owned',false,'Original PCCC/LTG instructor support.' from target;

with target as (
  select d.id as guide_day_id,d.school_id,d.course_id,d.planner_day_number from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id join public.courses c on c.id=d.course_id
  where c.course_code='WLD 205' and g.guide_name='WLD 205 Master Instructor Guide - Level II - PVHS Bridge + 23-Day Core + Project Extension'
    and g.status='active' and d.planner_day_number between 34 and 55
)
insert into public.course_guide_day_resources(school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,resource_notes,required,integration_mode,rights_basis,student_safe,license_notes)
select school_id,course_id,guide_day_id,2,'other',
 case
  when planner_day_number in (34,39,44,49) then 'WLD 205 Support: Project Source Map + Unknowns'
  when planner_day_number in (35,40,45,50) then 'WLD 205 Support: Project Math / Takeoff / QC Record'
  when planner_day_number in (36,41,46,51) then 'WLD 205 Support: Project Material / WPS / Distortion Plan'
  when planner_day_number in (37,42,47,52) then 'WLD 205 Support: In-Process Measurement / Correction / Recheck Record'
  else 'WLD 205 Support: Project / Portfolio Closeout Record' end,
 case
  when planner_day_number in (34,39,44,49) then '/live-activities/wld205-reusable-student-records.html#project-source'
  when planner_day_number in (35,40,45,50) then '/live-activities/wld205-reusable-student-records.html#project-math'
  when planner_day_number in (36,41,46,51) then '/live-activities/wld205-reusable-student-records.html#project-wps'
  when planner_day_number in (37,42,47,52) then '/live-activities/wld205-reusable-student-records.html#project-evidence'
  else '/live-activities/wld205-reusable-student-records.html#closeout' end,
 'Reusable student record selected to match the day-specific project evidence task.',true,'native','school_owned',true,'Original PCCC/LTG student record; actual project sources/evidence remain controlling.' from target;
