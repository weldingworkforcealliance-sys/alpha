-- Instructor resource delivery only. Preserve the shared 55-day curriculum,
-- planner assignments, outcomes, transport allowance, cleanup and cube days.
do $$
declare
  target_guide uuid;
  licensed_source uuid;
  day_count integer;
begin
  select g.id into target_guide
  from public.course_guides g join public.courses c on c.id=g.course_id
  where g.guide_name='WLD 110 Master Instructor Guide - PVHS'
    and c.course_code='WLD 110'
    and g.school_id='08ccb452-83ab-482f-bb28-5576e02741b2'::uuid;
  -- Empty isolated preview projects do not contain live curriculum.
  if target_guide is null then return; end if;

  select count(*) into day_count from public.course_guide_days
  where guide_id=target_guide and planner_day_number between 1 and 55;
  if day_count<>55 then raise exception 'Expected 55 PVHS guide days, found %',day_count; end if;

  select id into strict licensed_source from public.resource_sources
  where school_id='08ccb452-83ab-482f-bb28-5576e02741b2'::uuid
    and name='Fundamentals of Welding Courseware — Licensed' and active;

  if exists (
    select 1 from public.course_guide_day_resources r
    join public.course_guide_days d on d.id=r.guide_day_id
    where d.guide_id=target_guide and r.sequence_number in (10,11,12)
      and r.resource_url is distinct from
        '/resources/wld110/pvhs-courseware.html?chapter='||
        case r.sequence_number when 10 then 'ofc' when 11 then 'smaw' else 'safety' end||
        '#day-'||d.planner_day_number
  ) then raise exception 'PVHS courseware slots conflict with an existing resource'; end if;

  -- Reuse the two old blank packet records rather than leaving duplicate placeholders.
  update public.course_guide_day_resources r
  set sequence_number=case r.resource_title
      when 'AWS Oxy-Fuel Cutting (OFC) Instructional Packet' then 10 else 11 end,
      updated_at=now()
  from public.course_guide_days d
  where d.id=r.guide_day_id and d.guide_id=target_guide
    and r.resource_url is null
    and r.resource_title in ('AWS Oxy-Fuel Cutting (OFC) Instructional Packet',
                            'AWS Shielded Metal Arc Welding (SMAW) Instructional Packet');

  insert into public.course_guide_day_resources(
    school_id,course_id,guide_day_id,sequence_number,resource_type,resource_title,
    resource_url,resource_notes,required,source_id,integration_mode,rights_basis,
    student_safe,license_notes
  )
  select d.school_id,d.course_id,d.id,k.seq,'reference',
         k.label||' Original Slides — PVHS Day '||d.planner_day_number,
         '/resources/wld110/pvhs-courseware.html?chapter='||k.chapter||'#day-'||d.planner_day_number,
         'Original purchased full-slide visuals selected for PVHS Day '||d.planner_day_number||
         ': '||d.title||'. Use for instructor demonstration or review within the existing 55-day plan.',
         true,licensed_source,'native','licensed',false,
         'Instructor-only use of school-purchased courseware. Students use their separate AWS learning resources.'
  from public.course_guide_days d
  cross join (values (10,'ofc','OFC'),(11,'smaw','SMAW'),(12,'safety','Safety')) k(seq,chapter,label)
  where d.guide_id=target_guide and d.planner_day_number between 1 and 55
  on conflict(guide_day_id,sequence_number) do update set
    resource_type=excluded.resource_type,resource_title=excluded.resource_title,
    resource_url=excluded.resource_url,resource_notes=excluded.resource_notes,
    required=excluded.required,source_id=excluded.source_id,
    integration_mode=excluded.integration_mode,rights_basis=excluded.rights_basis,
    student_safe=excluded.student_safe,license_notes=excluded.license_notes,updated_at=now();

  if (select count(*) from public.course_guide_day_resources r
      join public.course_guide_days d on d.id=r.guide_day_id
      where d.guide_id=target_guide and r.sequence_number in (10,11,12)
        and r.required and not r.student_safe and r.rights_basis='licensed')<>165
  then raise exception 'Incomplete PVHS instructor courseware'; end if;
end $$;
