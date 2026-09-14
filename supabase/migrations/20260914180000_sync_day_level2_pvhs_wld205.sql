-- Align PCCC Day Level 2 and PVHS Level 2 WLD 205 during their common 23-day
-- theory block. PVHS-only Fridays become reinforcement/shop-application days.
-- Preserve the full PVHS extension by compressing each project's A+B planning
-- block after the common theory closes.
--
-- Also create the PCCC Day Level 2 WLD 205/210 attendance pair and make Live
-- Classroom Student ID validation roster-scoped for every active class pair,
-- not only PVHS-mode pairs.

begin;

do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.resolve_classroom_submission_student_uuid()'::regprocedure) into v_def;
  if position('and ap.attendance_mode = ''pvhs''' in v_def) > 0 then
    v_new := regexp_replace(v_def,E'\\s+and ap\\.attendance_mode = ''pvhs''','','g');
    if position('order by (ap.attendance_mode = ''pvhs'') desc' in v_new) = 0 then
      v_new := replace(v_new,'order by ap.created_at desc','order by (ap.attendance_mode = ''pvhs'') desc, ap.created_at desc');
    end if;
    if v_new = v_def then raise exception 'Could not generalize classroom roster identity resolver'; end if;
    execute v_new;
  end if;
end
$$;

do $$
declare
  v_primary uuid;
  v_completion uuid;
  v_school uuid;
  v_pair uuid;
begin
  select id, school_id into v_primary, v_school from public.sections where section_code = 'PCCC-DAY-L2-WLD205-2627' limit 1;
  select id into v_completion from public.sections where section_code = 'PCCC-DAY-L2-WLD210-2627' and school_id = v_school limit 1;
  if v_primary is not null and v_completion is not null then
    select ap.id into v_pair from public.attendance_pairs ap
    where ap.school_id = v_school and ((ap.primary_section_id = v_primary and ap.completion_section_id = v_completion) or (ap.primary_section_id = v_completion and ap.completion_section_id = v_primary))
    order by ap.created_at desc limit 1;
    if v_pair is null then
      insert into public.attendance_pairs (school_id,pair_name,primary_section_id,completion_section_id,attendance_mode,report_email,report_delay_minutes,active)
      values (v_school,'PCCC Day Level 2 · WLD 205/210',v_primary,v_completion,'standard',null,30,true);
    else
      update public.attendance_pairs set pair_name='PCCC Day Level 2 · WLD 205/210',primary_section_id=v_primary,completion_section_id=v_completion,attendance_mode='standard',report_email=null,report_delay_minutes=30,active=true,updated_at=now() where id=v_pair;
    end if;
  end if;
end
$$;

create temporary table _ext_days on commit drop as
select pd.planner_day_number as source_day, pd.guide_day_id
from public.planner_days pd join public.sections s on s.id = pd.section_id
where s.section_code = 'PVHS-A-WLD205-2627' and pd.planner_day_number between 34 and 55;

create temporary table _ext_text on commit drop as
select d.source_day, cgd.* from _ext_days d join public.course_guide_days cgd on cgd.id = d.guide_day_id;

create temporary table _ext_segments on commit drop as
select d.source_day, seg.* from _ext_days d join public.course_guide_day_segments seg on seg.guide_day_id = d.guide_day_id;

create temporary table _ext_resources on commit drop as
select d.source_day, r.* from _ext_days d join public.course_guide_day_resources r on r.guide_day_id = d.guide_day_id;

create temporary table _ext_outcomes on commit drop as
select d.source_day, o.* from _ext_days d join public.course_guide_day_outcomes o on o.guide_day_id = d.guide_day_id;

create temporary table _shared_map on commit drop as
select pvhs.guide_day_id as target_gid,dayl2.guide_day_id as source_gid,pvhs.scheduled_date
from public.planner_days pvhs
join public.sections ps on ps.id = pvhs.section_id
join public.planner_days dayl2 on dayl2.scheduled_date = pvhs.scheduled_date
join public.sections ds on ds.id = dayl2.section_id
where ps.section_code = 'PVHS-A-WLD205-2627' and ds.section_code = 'PCCC-DAY-L2-WLD205-2627' and pvhs.scheduled_date between date '2026-09-28' and date '2026-11-02';

do $$
declare v_set text;
begin
  select string_agg(format('%1$I = src.%1$I', column_name),', ' order by ordinal_position) into v_set
  from information_schema.columns where table_schema='public' and table_name='course_guide_days' and data_type='text';
  if v_set is not null then
    execute format('update public.course_guide_days tgt set %s, updated_at = now() from _shared_map m join public.course_guide_days src on src.id = m.source_gid where tgt.id = m.target_gid',v_set);
  end if;
end
$$;

delete from public.course_guide_day_segments where guide_day_id in (select target_gid from _shared_map);
insert into public.course_guide_day_segments (school_id,course_id,guide_day_id,sequence_number,segment_type,segment_title,planned_minutes,instructor_actions,student_actions,notes,start_minute,end_minute)
select tgt.school_id,tgt.course_id,m.target_gid,s.sequence_number,s.segment_type,s.segment_title,s.planned_minutes,s.instructor_actions,s.student_actions,s.notes,s.start_minute,s.end_minute
from _shared_map m join public.course_guide_days tgt on tgt.id=m.target_gid join public.course_guide_day_segments s on s.guide_day_id=m.source_gid;

delete from public.course_guide_day_outcomes where guide_day_id in (select target_gid from _shared_map);
insert into public.course_guide_day_outcomes (school_id,course_id,guide_day_id,outcome_id)
select tgt.school_id,tgt.course_id,m.target_gid,o.outcome_id
from _shared_map m join public.course_guide_days tgt on tgt.id=m.target_gid join public.course_guide_day_outcomes o on o.guide_day_id=m.source_gid
on conflict (guide_day_id,outcome_id) do nothing;

delete from public.course_guide_day_resources where guide_day_id in (select target_gid from _shared_map);
insert into public.course_guide_day_resources (school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,resource_notes,required,source_id,integration_mode,rights_basis,external_resource_id,outcome_id,student_safe,license_notes)
select tgt.school_id,tgt.course_id,m.target_gid,r.sequence_number,r.resource_type,r.resource_title,r.resource_url,r.resource_notes,r.required,r.source_id,r.integration_mode,r.rights_basis,r.external_resource_id,r.outcome_id,r.student_safe,r.license_notes
from _shared_map m join public.course_guide_days tgt on tgt.id=m.target_gid join public.course_guide_day_resources r on r.guide_day_id=m.source_gid;

create temporary table _friday_map on commit drop as
select fri.guide_day_id as target_gid,prev.guide_day_id as source_gid,fri.scheduled_date
from public.planner_days fri
join public.sections s on s.id=fri.section_id
join public.planner_days prev on prev.section_id=fri.section_id and prev.planner_day_number=fri.planner_day_number-1
where s.section_code='PVHS-A-WLD205-2627' and fri.scheduled_date between date '2026-09-25' and date '2026-10-30' and extract(isodow from fri.scheduled_date)=5;

do $$
declare v_set text;
begin
  select string_agg(format('%1$I = src.%1$I', column_name),', ' order by ordinal_position) into v_set
  from information_schema.columns where table_schema='public' and table_name='course_guide_days' and data_type='text';
  if v_set is not null then
    execute format('update public.course_guide_days tgt set %s, updated_at = now() from _friday_map m join public.course_guide_days src on src.id = m.source_gid where tgt.id = m.target_gid',v_set);
  end if;
end
$$;

delete from public.course_guide_day_outcomes where guide_day_id in (select target_gid from _friday_map);
insert into public.course_guide_day_outcomes (school_id,course_id,guide_day_id,outcome_id)
select tgt.school_id,tgt.course_id,m.target_gid,o.outcome_id
from _friday_map m join public.course_guide_days tgt on tgt.id=m.target_gid join public.course_guide_day_outcomes o on o.guide_day_id=m.source_gid
on conflict (guide_day_id,outcome_id) do nothing;

delete from public.course_guide_day_resources where guide_day_id in (select target_gid from _friday_map);
insert into public.course_guide_day_resources (school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,resource_notes,required,source_id,integration_mode,rights_basis,external_resource_id,outcome_id,student_safe,license_notes)
select tgt.school_id,tgt.course_id,m.target_gid,r.sequence_number,r.resource_type,r.resource_title,r.resource_url,r.resource_notes,r.required,r.source_id,r.integration_mode,r.rights_basis,r.external_resource_id,r.outcome_id,r.student_safe,r.license_notes
from _friday_map m join public.course_guide_days tgt on tgt.id=m.target_gid join public.course_guide_day_resources r on r.guide_day_id=m.source_gid;

delete from public.course_guide_day_segments where guide_day_id in (select target_gid from _friday_map);
insert into public.course_guide_day_segments (school_id,course_id,guide_day_id,sequence_number,segment_type,segment_title,planned_minutes,instructor_actions,student_actions,notes,start_minute,end_minute)
select tgt.school_id,tgt.course_id,m.target_gid,v.seq,v.segment_type,v.segment_title,v.minutes,v.instructor_actions,v.student_actions,v.notes,v.start_minute,v.end_minute
from _friday_map m join public.course_guide_days tgt on tgt.id=m.target_gid
cross join lateral (values
(1,'opening','Retrieval review',10,'Review the most recent shared WLD 205 lesson and identify the governing source or decision.','Explain the current shared concept and identify one point that needs more practice.','No new WLD 205 theory.',0,10),
(2,'demonstration','Application / reteach demonstration',10,'Demonstrate or reteach only the current shared skill in a shop, print, WPS, math, metallurgy, or documentation context.','Observe, question, and connect the demonstration to the most recent common lesson.','Do not preview the next common theory lesson.',10,20),
(3,'guided_practice','Shop / application block',30,'Coach application, measurement, print reading, layout, documentation, or fabrication tied to the current shared lesson.','Apply the current shared concept and produce observable work/evidence.','Use the extra PVHS meeting for depth and practice, not acceleration.',20,50),
(4,'closure','Evidence check + correction',10,'Check evidence, correct misconceptions, and identify what must be retained for the next shared meeting.','Show evidence, explain the result, and record one correction or takeaway.','Formative reinforcement only.',50,60)
) as v(seq,segment_type,segment_title,minutes,instructor_actions,student_actions,notes,start_minute,end_minute);

update public.course_guide_days cgd set
  title='PVHS Friday Reinforcement / Shop Application — '||cgd.title,
  objective='Reinforce and apply the most recent shared WLD 205 lesson without introducing new theory. Use shop, print, math, WPS, metallurgy, documentation, or fabrication application so PVHS remains synchronized with PCCC Day Level 2.',
  instructor_prep=concat_ws(E'\n\n','PACING RULE: Do not introduce the next WLD 205 theory lesson today. The next new theory lesson waits for the next shared PCCC/PVHS meeting.',cgd.instructor_prep),
  opening_review='Brief retrieval review of the most recent shared WLD 205 lesson before application begins.',
  demonstration='Short reteach/application demonstration only. Do not advance into the next WLD 205 theory topic.',
  guided_practice='Instructor-guided application of the most recent common WLD 205 lesson.',
  independent_practice='Reinforcement/shop work using the current shared theory, with evidence and correction.',
  instructor_checks='Verify correct application and source use; correct misunderstandings before the next shared theory day.',
  assessment='Formative reinforcement only. Do not assess theory not yet taught to Day Level 2.',
  teaching_tips='Use Friday as a pacing buffer and application advantage for PVHS. Deepen competence without moving the common theory clock forward.',
  corresponding_application='PVHS-only reinforcement/shop application of the most recent common WLD 205 lesson.',
  evidence_check_for_understanding='Observable application evidence plus a student explanation of why the result is correct.',
  weekly_coaching_focus='Application, retention, correction, and evidence quality without theory acceleration.',
  coaching_focus='Strengthen the current common skill before the next shared WLD 205 lesson.',
  if_students_struggle='Reteach the current shared concept with a smaller example, physical sample, print callout, calculation scaffold, or demonstration. Do not move ahead.',
  keep_momentum='Students already secure should complete deeper application, peer verification, documentation, or additional practice rather than new theory.',
  focused_retry='Retry the same shared skill after immediate feedback until correct application is demonstrated.',
  qualification_guardrail=concat_ws(E'\n\n',cgd.qualification_guardrail,'This PVHS-only Friday is not authorization to advance beyond the shared WLD 205 theory sequence.'),updated_at=now()
where cgd.id in (select target_gid from _friday_map);

create temporary table _ext_map (target_day integer primary key,source_a integer not null,source_b integer,new_title text) on commit drop;
insert into _ext_map(target_day,source_a,source_b,new_title) values
(38,34,35,'PVHS Project 1A/B - Rectangular Frame: Print, Cut List + Squareness Math'),
(39,36,null,null),(40,37,null,null),(41,38,null,null),
(42,39,40,'PVHS Project 2A/B - Gusseted Bracket: Print, Joint Detail + Triangle/Angle Math'),
(43,41,null,null),(44,42,null,null),(45,43,null,null),
(46,44,45,'PVHS Project 3A/B - Round-Base Support: Print, Circular Features + Circle/Cylinder Math'),
(47,46,null,null),(48,47,null,null),(49,48,null,null),
(50,49,50,'PVHS Project 4A/B - Independent Mini-Fabrication: Project Selection, Source Map + Material Takeoff'),
(51,51,null,null),(52,52,null,null),(53,53,null,null),(54,54,null,null),(55,55,null,null);

create temporary table _ext_targets on commit drop as
select pd.planner_day_number as target_day,pd.guide_day_id as target_gid
from public.planner_days pd join public.sections s on s.id=pd.section_id
where s.section_code='PVHS-A-WLD205-2627' and pd.planner_day_number between 38 and 55;

do $$
declare v_set text;
begin
  select string_agg(case when column_name='title' then 'title = coalesce(m.new_title, a.title)' else format('%1$I = case when m.source_b is null then a.%1$I else concat_ws(E''\\n\\n'', a.%1$I, b.%1$I) end',column_name) end,', ' order by ordinal_position) into v_set
  from information_schema.columns where table_schema='public' and table_name='course_guide_days' and data_type='text';
  if v_set is not null then
    execute format('update public.course_guide_days tgt set %s, updated_at=now() from _ext_targets t join _ext_map m on m.target_day=t.target_day join _ext_text a on a.source_day=m.source_a left join _ext_text b on b.source_day=m.source_b where tgt.id=t.target_gid',v_set);
  end if;
end
$$;

delete from public.course_guide_day_segments where guide_day_id in (select target_gid from _ext_targets);
insert into public.course_guide_day_segments (school_id,course_id,guide_day_id,sequence_number,segment_type,segment_title,planned_minutes,instructor_actions,student_actions,notes,start_minute,end_minute)
select tgt.school_id,tgt.course_id,t.target_gid,a.sequence_number,a.segment_type,case when m.source_b is null or b.id is null then a.segment_title else concat_ws(' + ',a.segment_title,b.segment_title) end,a.planned_minutes,case when m.source_b is null or b.id is null then a.instructor_actions else concat_ws(E'\n\n',a.instructor_actions,b.instructor_actions) end,case when m.source_b is null or b.id is null then a.student_actions else concat_ws(E'\n\n',a.student_actions,b.student_actions) end,case when m.source_b is null or b.id is null then a.notes else concat_ws(E'\n\n',a.notes,b.notes) end,a.start_minute,a.end_minute
from _ext_targets t join _ext_map m on m.target_day=t.target_day join public.course_guide_days tgt on tgt.id=t.target_gid join _ext_segments a on a.source_day=m.source_a left join _ext_segments b on b.source_day=m.source_b and b.sequence_number=a.sequence_number;

delete from public.course_guide_day_outcomes where guide_day_id in (select target_gid from _ext_targets);
insert into public.course_guide_day_outcomes (school_id,course_id,guide_day_id,outcome_id)
select distinct tgt.school_id,tgt.course_id,t.target_gid,o.outcome_id
from _ext_targets t join _ext_map m on m.target_day=t.target_day join public.course_guide_days tgt on tgt.id=t.target_gid join _ext_outcomes o on o.source_day=m.source_a or o.source_day=m.source_b
on conflict (guide_day_id,outcome_id) do nothing;

delete from public.course_guide_day_resources where guide_day_id in (select target_gid from _ext_targets);
with source_resources as (
select t.target_gid,tgt.school_id as target_school_id,tgt.course_id as target_course_id,r.resource_type,r.resource_title,r.resource_url,r.resource_notes,r.required,r.source_id,r.integration_mode,r.rights_basis,r.external_resource_id,r.outcome_id,r.student_safe,r.license_notes,row_number() over(partition by t.target_gid order by case when r.source_day=m.source_a then 0 else 1 end,r.sequence_number,r.id) as new_sequence
from _ext_targets t join _ext_map m on m.target_day=t.target_day join public.course_guide_days tgt on tgt.id=t.target_gid join _ext_resources r on r.source_day=m.source_a or r.source_day=m.source_b)
insert into public.course_guide_day_resources (school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,resource_url,resource_notes,required,source_id,integration_mode,rights_basis,external_resource_id,outcome_id,student_safe,license_notes)
select target_school_id,target_course_id,target_gid,new_sequence,resource_type,resource_title,resource_url,resource_notes,required,source_id,integration_mode,rights_basis,external_resource_id,outcome_id,student_safe,license_notes from source_resources;

update public.planner_days pd set title=cgd.title from public.course_guide_days cgd
where pd.guide_day_id=cgd.id and pd.section_id=(select id from public.sections where section_code='PVHS-A-WLD205-2627' limit 1) and pd.planner_day_number between 13 and 55;

do $$
declare v_has_build boolean; v_mismatch integer; v_fridays integer; v_pair_count integer; v_days integer;
begin
  select exists(select 1 from public.sections where section_code='PVHS-A-WLD205-2627') and exists(select 1 from public.sections where section_code='PCCC-DAY-L2-WLD205-2627') into v_has_build;
  if v_has_build then
    select count(*) into v_mismatch from public.planner_days p join public.sections ps on ps.id=p.section_id join public.planner_days d on d.scheduled_date=p.scheduled_date join public.sections ds on ds.id=d.section_id where ps.section_code='PVHS-A-WLD205-2627' and ds.section_code='PCCC-DAY-L2-WLD205-2627' and p.scheduled_date between date '2026-09-28' and date '2026-11-02' and p.title<>d.title;
    if v_mismatch<>0 then raise exception 'PVHS/Day Level 2 shared WLD 205 title mismatch count: %',v_mismatch; end if;
    select count(*) into v_fridays from public.planner_days p join public.sections s on s.id=p.section_id where s.section_code='PVHS-A-WLD205-2627' and p.scheduled_date between date '2026-09-25' and date '2026-10-30' and extract(isodow from p.scheduled_date)=5 and p.title like 'PVHS Friday Reinforcement / Shop Application — %';
    if v_fridays<>6 then raise exception 'Expected 6 PVHS reinforcement Fridays, found %',v_fridays; end if;
    select count(*) into v_pair_count from public.attendance_pairs ap join public.sections p on p.id=ap.primary_section_id join public.sections c on c.id=ap.completion_section_id where p.section_code='PCCC-DAY-L2-WLD205-2627' and c.section_code='PCCC-DAY-L2-WLD210-2627' and ap.active=true and ap.attendance_mode='standard';
    if v_pair_count<>1 then raise exception 'Expected one active Day Level 2 WLD 205/210 pair, found %',v_pair_count; end if;
    select count(*) into v_days from public.planner_days p join public.sections s on s.id=p.section_id where s.section_code='PVHS-A-WLD205-2627';
    if v_days<>55 then raise exception 'PVHS WLD 205 planner should remain 55 days, found %',v_days; end if;
  end if;
end
$$;

commit;