-- Allow any active instructor assigned to a section to complete a class day.
-- The instructor who started the day and school management remain authorized.
-- Attendance finalization is still enforced separately by the planner-delivery trigger.

create or replace function public.complete_current_planner_day(
  p_section_id uuid,
  p_actual_date date default current_date,
  p_actual_minutes integer default null,
  p_deviation_summary text default null,
  p_follow_up_needed boolean default false,
  p_follow_up_notes text default null
)
returns table(
  completed_day integer,
  new_current_day integer,
  section_complete boolean,
  planner_held boolean
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_school_id uuid;
  v_day_number integer;
  v_max_days integer;
  v_planner_day_id uuid;
  v_hold boolean;
  v_new_day integer;
  v_complete boolean := false;
  v_delivery_status text;
  v_started_at timestamptz;
  v_started_by uuid;
  v_completed_at timestamptz;
  v_actual_minutes integer;
begin
  select s.school_id, sp.current_planner_day_number, s.planned_instructional_days,
         pd.id, sp.manual_hold
    into v_school_id, v_day_number, v_max_days, v_planner_day_id, v_hold
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

  select pdd.delivery_status, pdd.started_at, pdd.instructor_id
    into v_delivery_status, v_started_at, v_started_by
  from public.planner_day_delivery pdd
  where pdd.planner_day_id = v_planner_day_id
    and pdd.section_id = p_section_id
  for update;

  if not found or v_started_at is null then
    raise exception 'Start Today must be used before completing the day';
  end if;

  if not (
    public.is_platform_owner()
    or public.can_review_instruction(v_school_id)
    or v_started_by = auth.uid()
    or exists (
      select 1
      from public.section_instructors si
      where si.section_id = p_section_id
        and si.instructor_id = auth.uid()
        and si.active = true
    )
  ) then
    raise exception 'Only the instructor who started this class, an assigned instructor, or school management can complete it';
  end if;

  if v_delivery_status = 'completed' then
    raise exception 'This class day is already completed';
  end if;

  if v_delivery_status not in ('in_progress','started') then
    raise exception 'This class day is not currently in progress';
  end if;

  v_completed_at := now();
  v_actual_minutes := greatest(
    1,
    round(extract(epoch from (v_completed_at - v_started_at)) / 60.0)::integer
  );

  update public.planner_day_delivery
  set delivery_status = 'completed',
      actual_date = p_actual_date,
      completed_at = v_completed_at,
      actual_minutes = v_actual_minutes,
      deviation_summary = p_deviation_summary,
      follow_up_needed = p_follow_up_needed,
      follow_up_notes = p_follow_up_notes,
      updated_at = now()
  where planner_day_id = v_planner_day_id;

  update public.planner_day_coverage
  set status = 'completed',
      completed_at = v_completed_at,
      updated_at = now()
  where planner_day_id = v_planner_day_id
    and status = 'active';

  perform public.write_audit_event(
    v_school_id,
    'planner_day_completed',
    'planner_day',
    v_planner_day_id,
    jsonb_build_object(
      'section_id', p_section_id,
      'planner_day_number', v_day_number,
      'started_at', v_started_at,
      'started_by', v_started_by,
      'completed_by', auth.uid(),
      'completed_at', v_completed_at,
      'actual_minutes', v_actual_minutes,
      'follow_up_needed', p_follow_up_needed
    )
  );

  if v_day_number >= v_max_days then
    update public.section_progress
    set completed_at = coalesce(completed_at, v_completed_at),
        updated_at = now()
    where section_id = p_section_id;
    v_new_day := v_day_number;
    v_complete := true;
  elsif v_hold then
    update public.section_progress
    set last_advanced_at = null,
        updated_at = now()
    where section_id = p_section_id;
    v_new_day := v_day_number;
  else
    v_new_day := v_day_number + 1;
    update public.section_progress
    set current_planner_day_number = v_new_day,
        last_advanced_at = v_completed_at,
        updated_at = now()
    where section_id = p_section_id;
  end if;

  return query select v_day_number, v_new_day, v_complete, v_hold;
end;
$function$;
