create or replace function public.start_current_planner_day(
  p_section_id uuid,
  p_actual_date date default current_date
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_school_id uuid;
  v_day_number integer;
  v_planner_day_id uuid;
  v_scheduled_date date;
  v_delivery_status text;
  v_started_at timestamptz;
  v_started_by uuid;
  v_started_by_name text;
  v_is_assigned boolean := false;
begin
  select s.school_id, sp.current_planner_day_number, pd.id, pd.scheduled_date
    into v_school_id, v_day_number, v_planner_day_id, v_scheduled_date
  from public.sections s
  join public.section_progress sp on sp.section_id = s.id
  join public.planner_days pd
    on pd.section_id = s.id
   and pd.planner_day_number = sp.current_planner_day_number
  where s.id = p_section_id
  for update of sp;

  if v_school_id is null then
    raise exception 'Section or current planner day not found';
  end if;

  if not public.is_school_instructional_staff(v_school_id) then
    raise exception 'Active instructional staff access required';
  end if;

  if v_scheduled_date is not null and p_actual_date < v_scheduled_date then
    raise exception 'This planner day is scheduled for %. Update the class schedule before starting it early.',
      to_char(v_scheduled_date, 'Mon DD, YYYY');
  end if;

  select exists (
    select 1
    from public.section_instructors si
    where si.school_id = v_school_id
      and si.section_id = p_section_id
      and si.instructor_id = auth.uid()
      and si.active = true
  ) into v_is_assigned;

  select pdd.delivery_status, pdd.started_at, pdd.instructor_id
    into v_delivery_status, v_started_at, v_started_by
  from public.planner_day_delivery pdd
  where pdd.planner_day_id = v_planner_day_id
  for update;

  if found and v_delivery_status = 'completed' then
    raise exception 'This class day is already completed';
  end if;

  if found and v_started_at is not null and v_delivery_status in ('in_progress','started') then
    select coalesce(nullif(btrim(p.display_name), ''), p.email, 'another instructor')
      into v_started_by_name
    from public.profiles p
    where p.id = v_started_by;
    raise exception 'Class already started by %', coalesce(v_started_by_name, 'another instructor');
  end if;

  update public.section_progress
  set started_at = coalesce(started_at, now()),
      updated_at = now()
  where section_id = p_section_id;

  insert into public.planner_day_delivery (
    school_id, section_id, planner_day_id, delivery_status,
    actual_date, started_at, instructor_id
  ) values (
    v_school_id, p_section_id, v_planner_day_id, 'in_progress',
    p_actual_date, now(), auth.uid()
  )
  on conflict (planner_day_id)
  do update set
    delivery_status = 'in_progress',
    actual_date = excluded.actual_date,
    started_at = now(),
    completed_at = null,
    instructor_id = auth.uid(),
    updated_at = now();

  if not v_is_assigned then
    insert into public.planner_day_coverage (
      school_id, section_id, planner_day_id, covering_instructor_id,
      started_at, completed_at, status, updated_at
    ) values (
      v_school_id, p_section_id, v_planner_day_id, auth.uid(),
      now(), null, 'active', now()
    )
    on conflict (planner_day_id)
    do update set
      covering_instructor_id = excluded.covering_instructor_id,
      started_at = excluded.started_at,
      completed_at = null,
      status = 'active',
      updated_at = now();
  end if;

  perform public.write_audit_event(
    v_school_id,
    case when v_is_assigned then 'planner_day_started' else 'planner_day_coverage_started' end,
    'planner_day',
    v_planner_day_id,
    jsonb_build_object(
      'section_id', p_section_id,
      'planner_day_number', v_day_number,
      'scheduled_date', v_scheduled_date,
      'actual_date', p_actual_date,
      'instructor_id', auth.uid(),
      'covering', not v_is_assigned
    )
  );

  return v_day_number;
end;
$function$;
