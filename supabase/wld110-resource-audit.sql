-- Read-only WLD 110 resource integrity audit.
do $$
declare
  v_blank integer;
  v_ofc integer;
  v_smaw integer;
  v_safety integer;
  v_licensed integer;
  v_fabm integer;
  v_dice integer;
  v_tube integer;
  v_bad_timing integer;
begin
  select count(*) into v_blank
  from public.course_guide_day_resources r
  join public.course_guide_days d on d.id=r.guide_day_id
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  where c.course_code='WLD 110'
    and g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
    and r.required=true
    and nullif(btrim(coalesce(r.resource_url,'')),'') is null;
  if v_blank<>0 then raise exception 'WLD 110 required resources with blank URL: %',v_blank; end if;

  select count(*) into v_ofc
  from public.course_guide_day_resources r
  join public.course_guide_days d on d.id=r.guide_day_id
  join public.course_guides g on g.id=d.guide_id
  where g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
    and r.resource_url='/resources/wld110/ofc-shop-reference.html#day-'||d.planner_day_number;
  if v_ofc<>23 then raise exception 'WLD 110 OFC linked days: %',v_ofc; end if;

  select count(*) into v_smaw
  from public.course_guide_day_resources r
  join public.course_guide_days d on d.id=r.guide_day_id
  join public.course_guides g on g.id=d.guide_id
  where g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
    and r.resource_url='/resources/wld110/smaw-shop-reference.html#day-'||d.planner_day_number;
  if v_smaw<>23 then raise exception 'WLD 110 SMAW linked days: %',v_smaw; end if;

  select count(*) into v_safety
  from public.course_guide_day_resources r
  join public.course_guide_days d on d.id=r.guide_day_id
  join public.course_guides g on g.id=d.guide_id
  where g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
    and r.sequence_number=3
    and r.resource_url='/resources/wld110/welding-safety-courseware-guide.html#day-'||d.planner_day_number;
  if v_safety<>23 then raise exception 'WLD 110 safety linked days: %',v_safety; end if;

  select count(*) into v_licensed
  from public.course_guide_day_resources r
  join public.course_guide_days d on d.id=r.guide_day_id
  join public.course_guides g on g.id=d.guide_id
  where g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
    and r.sequence_number in (1,2,3)
    and r.rights_basis='licensed'
    and r.license_notes ilike '%purchased courseware%';
  if v_licensed<>69 then raise exception 'WLD 110 licensed courseware rows: %',v_licensed; end if;

  select count(*) into v_fabm
  from public.course_guide_day_resources r
  join public.course_guide_days d on d.id=r.guide_day_id
  join public.course_guides g on g.id=d.guide_id
  where g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
    and d.planner_day_number between 14 and 16
    and r.sequence_number=4
    and r.resource_url='/resources/wld105/fabricated-m-project-packet.html';
  if v_fabm<>3 then raise exception 'WLD 110 Fabricated M resource mapping: %',v_fabm; end if;

  select count(*) into v_dice
  from public.course_guide_day_resources r
  join public.course_guide_days d on d.id=r.guide_day_id
  join public.course_guides g on g.id=d.guide_id
  where g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
    and d.planner_day_number between 17 and 23
    and r.sequence_number=4
    and r.resource_url='/resources/wld105/steel-dice-project-packet.html';
  if v_dice<>7 then raise exception 'WLD 110 Steel Dice resource mapping: %',v_dice; end if;

  select count(*) into v_tube
  from public.course_guide_days d
  join public.course_guides g on g.id=d.guide_id
  join public.courses c on c.id=d.course_id
  left join public.course_guide_day_segments s on s.guide_day_id=d.id
  left join public.course_guide_day_resources r on r.guide_day_id=d.id
  where c.course_code='WLD 110'
    and g.guide_name='WLD 110 College Day/Night 23-Day Instructor Guide'
    and (
      coalesce(d.title,'') ilike '%Tube Cube%'
      or coalesce(d.objective,'') ilike '%Tube Cube%'
      or coalesce(d.corresponding_application,'') ilike '%Tube Cube%'
      or coalesce(s.segment_title,'') ilike '%Tube Cube%'
      or coalesce(s.instructor_actions,'') ilike '%Tube Cube%'
      or coalesce(s.student_actions,'') ilike '%Tube Cube%'
      or coalesce(s.notes,'') ilike '%Tube Cube%'
      or coalesce(r.resource_title,'') ilike '%Tube Cube%'
      or coalesce(r.resource_url,'') ilike '%tube-cube%'
    );
  if v_tube<>0 then raise exception 'WLD 110 active Tube Cube references: %',v_tube; end if;

  select count(*) into v_bad_timing
  from public.planner_day_compliance
  where section_id='ced8a93c-755e-4c64-af70-3862df1a45db'::uuid
    and (ltg_time_authority_minutes<>190
      or effective_planned_minutes<>190
      or timing_status<>'PASS'
      or curriculum_status<>'PASS');
  if v_bad_timing<>0 then raise exception 'PCCC Night WLD 110 timing/curriculum failures: %',v_bad_timing; end if;

  raise notice 'PASS: WLD 110 licensed Safety/SMAW/OFC resources complete; project mapping correct; Tube Cube inactive; Night timing remains 190 minutes.';
end $$;
