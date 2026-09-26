-- Gltg only: ezlvivmeneefiiwqwgqd. Additive synthetic content, not production curriculum.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
do $guard$ begin
if not exists(select 1 from public.sections where id='881d8372-445c-4e1b-bfb3-23c211334bf0' and school_id='b8cd53eb-6795-4edd-976c-70a4ed7525b1' and course_id='9d96d5b6-407c-4844-b343-46e3c5dcbd05' and section_name='Tower Test Theory') then raise exception 'Staging fixture identity mismatch'; end if;
if exists(select 1 from public.planner_days where section_id='881d8372-445c-4e1b-bfb3-23c211334bf0') or exists(select 1 from public.section_progress where section_id='881d8372-445c-4e1b-bfb3-23c211334bf0') or exists(select 1 from public.course_guides where course_id='9d96d5b6-407c-4844-b343-46e3c5dcbd05') then raise exception 'Fixture is no longer empty; inspect before seeding'; end if;
end $guard$;
insert into public.course_guides(id,school_id,course_id,guide_name,planned_instructional_days,status,version_label)
values('92600000-0000-4000-8000-000000000001','b8cd53eb-6795-4edd-976c-70a4ed7525b1','9d96d5b6-407c-4844-b343-46e3c5dcbd05','STAGING SAMPLE - Tower theory planner',2,'active','staging-20260926');
insert into public.resource_sources(id,school_id,name,source_kind,notes)
values('92600000-0000-4000-8000-000000000002','b8cd53eb-6795-4edd-976c-70a4ed7525b1','STAGING SAMPLE - Test worksheets','school','Synthetic software-test material. Not an approved teaching or qualification standard.');
insert into public.course_guide_days(id,school_id,course_id,guide_id,planner_day_number,title,objective,materials_equipment,corresponding_application,evidence_check_for_understanding,weekly_coaching_focus,coaching_focus,if_students_struggle,keep_momentum)
select ('92600000-0000-4000-8000-'||lpad((10+n)::text,12,'0'))::uuid,'b8cd53eb-6795-4edd-976c-70a4ed7525b1','9d96d5b6-407c-4844-b343-46e3c5dcbd05','92600000-0000-4000-8000-000000000001',n,
case n when 1 then 'STAGING SAMPLE - Reading a project record' else 'STAGING SAMPLE - Reviewing recorded evidence' end,
'Synthetic test lesson: identify the project identifier, revision and evidence fields. This sample is for software validation only.',
'Sample project record, paper and pencil; no live equipment or practical welding activity.',
'Use the synthetic Tower cohort to inspect the relationship between the guide, resource notes and job-card records.',
'Ask the tester to locate the resource, explain one record field and move between guide days.',
'Clear records and traceable evidence.','Check that each displayed record belongs to the selected test class.',
'Reopen the resource notes and match each field to the sample record.',
'Move to the next sample day after verifying the displayed title.'
from generate_series(1,2) n;
insert into public.course_guide_day_segments(id,school_id,course_id,guide_day_id,sequence_number,segment_type,segment_title,planned_minutes,instructor_actions,student_actions,start_minute,end_minute)
select ('92600000-0000-4000-8000-'||lpad((100+n*10+s)::text,12,'0'))::uuid,'b8cd53eb-6795-4edd-976c-70a4ed7525b1','9d96d5b6-407c-4844-b343-46e3c5dcbd05',('92600000-0000-4000-8000-'||lpad((10+n)::text,12,'0'))::uuid,s,
case s when 1 then 'review' else 'guided_practice' end,
case s when 1 then 'Sample record review' else 'Sample evidence check' end,15,
'Synthetic lesson: open the attached resource notes, identify the sample record fields and verify that the selected day matches this segment.',
'Read the sample notes and record a test observation.',(s-1)*15,s*15
from generate_series(1,2) n cross join generate_series(1,2) s;
insert into public.course_guide_day_resources(id,school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_notes,required,source_id,integration_mode,rights_basis,license_notes,resource_url)
select ('92600000-0000-4000-8000-'||lpad((20+n)::text,12,'0'))::uuid,'b8cd53eb-6795-4edd-976c-70a4ed7525b1','9d96d5b6-407c-4844-b343-46e3c5dcbd05',('92600000-0000-4000-8000-'||lpad((10+n)::text,12,'0'))::uuid,1,'worksheet',
'STAGING SAMPLE - Record worksheet '||n,
'Software-test worksheet. Sample project: TOWER-TEST. Revision: SAMPLE-01. Identify the project label, revision, reviewer and evidence fields. Record an observation, then verify that the planner displays the correct day. No real student data, practical procedure or certification criteria are included.',
true,'92600000-0000-4000-8000-000000000002','url','school_owned','Original synthetic test notes; not copied from production or a publisher.','/staging-record-worksheet.html'
from generate_series(1,2) n;
insert into public.planner_days(id,school_id,section_id,course_id,guide_day_id,planner_day_number,scheduled_date,title)
select ('92600000-0000-4000-8000-'||lpad((30+n)::text,12,'0'))::uuid,'b8cd53eb-6795-4edd-976c-70a4ed7525b1','881d8372-445c-4e1b-bfb3-23c211334bf0','9d96d5b6-407c-4844-b343-46e3c5dcbd05',('92600000-0000-4000-8000-'||lpad((10+n)::text,12,'0'))::uuid,n,date '2026-09-28'+(n-1),'STAGING SAMPLE - Day '||n
from generate_series(1,2) n;
insert into public.section_progress(id,school_id,section_id,current_planner_day_number)
values('92600000-0000-4000-8000-000000000003','b8cd53eb-6795-4edd-976c-70a4ed7525b1','881d8372-445c-4e1b-bfb3-23c211334bf0',1);
select section_id,current_planner_day_number,guide_day_id,planner_day_title from public.current_teaching_sections where section_id='881d8372-445c-4e1b-bfb3-23c211334bf0';
commit;
