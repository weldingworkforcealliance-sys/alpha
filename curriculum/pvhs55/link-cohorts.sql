-- Insert only: continue each cohort's existing theory/lab instructor assignments.
-- No enrollment, attendance event, report queue entry, or grade is created.
begin;
insert into public.section_instructors(school_id,section_id,instructor_id,instructor_role,active)
select distinct n.school_id,n.id,si.instructor_id,si.instructor_role,true
from public.sections n
join public.courses nc on nc.id=n.course_id
join public.sections old on old.cohort_id=n.cohort_id and old.school_id=n.school_id
join public.courses oc on oc.id=old.course_id
join public.section_instructors si on si.section_id=old.id and si.school_id=old.school_id and si.active
where n.school_id='08ccb452-83ab-482f-bb28-5576e02741b2'
and n.section_code in('PVHS-B-WLD114-2627-55','PVHS-B-WLD115-2627-55','PVHS-B-WLD120-2627-55','PVHS-B-WLD150-2627-55','PVHS-C-WLD114-2627-55','PVHS-C-WLD115-2627-55','PVHS-C-WLD120-2627-55','PVHS-C-WLD150-2627-55')
and old.status='active'
and oc.course_code=case when nc.course_code in('WLD 114','WLD 120') then 'WLD 105' else 'WLD 110' end
and not exists(select 1 from public.section_instructors x where x.section_id=n.id and x.instructor_id=si.instructor_id);

-- Reuse the cohort's established PVHS reporting settings, without copying rosters.
insert into public.attendance_pairs(school_id,pair_name,primary_section_id,completion_section_id,attendance_mode,report_email,report_delay_minutes,report_trigger,active)
select n.school_id,'PVHS Level 1 '||right(left(h.cohort_code,6),1)||' · '||nc.course_code||'/'||lc.course_code||' · 55 days',n.id,l.id,
ap.attendance_mode,ap.report_email,ap.report_delay_minutes,ap.report_trigger,true
from public.sections n join public.courses nc on nc.id=n.course_id
join public.cohorts h on h.id=n.cohort_id
join public.sections l on l.cohort_id=n.cohort_id and l.school_id=n.school_id
join public.courses lc on lc.id=l.course_id and lc.course_code=case nc.course_code when 'WLD 114' then 'WLD 115' when 'WLD 120' then 'WLD 150' end
join public.sections old on old.cohort_id=n.cohort_id and old.school_id=n.school_id
join public.courses oc on oc.id=old.course_id and oc.course_code='WLD 105'
join public.attendance_pairs ap on ap.primary_section_id=old.id and ap.active
where n.school_id='08ccb452-83ab-482f-bb28-5576e02741b2'
and n.section_code in('PVHS-B-WLD114-2627-55','PVHS-B-WLD120-2627-55','PVHS-C-WLD114-2627-55','PVHS-C-WLD120-2627-55')
and l.section_code in('PVHS-B-WLD115-2627-55','PVHS-B-WLD150-2627-55','PVHS-C-WLD115-2627-55','PVHS-C-WLD150-2627-55')
and not exists(select 1 from public.attendance_pairs x where x.primary_section_id=n.id or x.completion_section_id=l.id);
do $check$ begin
 if (select count(*) from public.attendance_pairs ap join public.sections s on s.id=ap.primary_section_id where s.school_id='08ccb452-83ab-482f-bb28-5576e02741b2' and s.section_code in('PVHS-B-WLD114-2627-55','PVHS-B-WLD120-2627-55','PVHS-C-WLD114-2627-55','PVHS-C-WLD120-2627-55') and ap.active)<>4 then raise exception 'Expected four new attendance pairs'; end if;
 if exists(select 1 from public.sections s where s.school_id='08ccb452-83ab-482f-bb28-5576e02741b2' and s.section_code in('PVHS-B-WLD114-2627-55','PVHS-B-WLD115-2627-55','PVHS-B-WLD120-2627-55','PVHS-B-WLD150-2627-55','PVHS-C-WLD114-2627-55','PVHS-C-WLD115-2627-55','PVHS-C-WLD120-2627-55','PVHS-C-WLD150-2627-55') and not exists(select 1 from public.section_instructors si where si.section_id=s.id and si.active)) then raise exception 'Missing instructor assignment'; end if;
end $check$;
commit;
