-- LTG stabilization: official reporting must use finalized attendance only.
-- Draft sessions remain visible through attendance session/data-quality counts,
-- but they must not inflate attendance record totals or introduce "not recorded"
-- rows into official attendance metrics.

create or replace function public.ltg_reporting_summary_internal(
  check_school_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_school_name text;
  v_timezone text := 'America/New_York';
  v_scheduled_days integer := 0;
  v_completed_days integer := 0;
  v_instruction_minutes numeric := 0;
  v_followups integer := 0;
  v_sections integer := 0;
  v_students integer := 0;
  v_attendance_sessions integer := 0;
  v_attendance_finalized integer := 0;
  v_attendance_records integer := 0;
  v_attendance_present integer := 0;
  v_attendance_absent integer := 0;
  v_attendance_left_early integer := 0;
  v_attendance_statuses jsonb := '{}'::jsonb;
  v_classroom_sessions integer := 0;
  v_classroom_submissions integer := 0;
  v_classroom_students integer := 0;
  v_assessment_avg numeric := null;
  v_unlinked_classroom integer := 0;
  v_job_card_sessions integer := 0;
  v_job_card_submissions integer := 0;
  v_job_card_accepted integer := 0;
  v_job_card_recheck integer := 0;
  v_unlinked_job_cards integer := 0;
  v_instructor_notes integer := 0;
  v_agenda_reviews integer := 0;
  v_agenda_approved integer := 0;
  v_audit_events integer := 0;
  v_employee_hours numeric := 0;
  v_open_punches integer := 0;
  v_adjusted_entries integer := 0;
  v_missing_deliveries integer := 0;
  v_archived_delivery_rows integer := 0;
begin
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Invalid reporting period.';
  end if;

  select s.name into v_school_name
  from public.schools s
  where s.id = check_school_id;

  if v_school_name is null then
    raise exception 'School not found.';
  end if;

  select coalesce(t.timezone, 'America/New_York') into v_timezone
  from public.timeclock_school_settings t
  where t.school_id = check_school_id;
  v_timezone := coalesce(v_timezone, 'America/New_York');

  select count(*) into v_sections
  from public.sections s
  where s.school_id = check_school_id
    and coalesce(s.status, '') <> 'archived';

  select count(*) into v_students
  from public.attendance_students s
  where s.school_id = check_school_id
    and s.active = true;

  select count(*) into v_scheduled_days
  from public.planner_days d
  where d.school_id = check_school_id
    and d.scheduled_date between p_start_date and p_end_date;

  select
    count(*) filter (where d.delivery_status = 'completed'),
    coalesce(sum(d.actual_minutes) filter (where d.delivery_status = 'completed'), 0),
    count(*) filter (where d.follow_up_needed = true)
  into v_completed_days, v_instruction_minutes, v_followups
  from public.planner_day_delivery d
  where d.school_id = check_school_id
    and coalesce(d.actual_date, (d.completed_at at time zone v_timezone)::date)
        between p_start_date and p_end_date;

  select count(*) into v_missing_deliveries
  from public.planner_days pd
  where pd.school_id = check_school_id
    and pd.scheduled_date between p_start_date and p_end_date
    and not exists (
      select 1
      from public.planner_day_delivery dd
      where dd.planner_day_id = pd.id
        and dd.delivery_status = 'completed'
    );

  select count(*) into v_archived_delivery_rows
  from public.planner_day_delivery_archive a
  where a.school_id = check_school_id
    and coalesce(a.actual_date, (a.archived_at at time zone v_timezone)::date)
        between p_start_date and p_end_date;

  -- Session counts intentionally include drafts so the report can surface
  -- unfinished attendance as a data-quality issue.
  select
    count(*),
    count(*) filter (where s.status = 'finalized')
  into v_attendance_sessions, v_attendance_finalized
  from public.attendance_sessions s
  where s.school_id = check_school_id
    and s.attendance_date between p_start_date and p_end_date;

  -- Official attendance metrics come only from finalized sessions.
  select
    count(*),
    count(*) filter (where r.final_status = 'present'),
    count(*) filter (where r.final_status = 'absent'),
    count(*) filter (where r.final_status = 'left_early')
  into
    v_attendance_records,
    v_attendance_present,
    v_attendance_absent,
    v_attendance_left_early
  from public.attendance_records r
  join public.attendance_sessions s on s.id = r.session_id
  where s.school_id = check_school_id
    and s.attendance_date between p_start_date and p_end_date
    and s.status = 'finalized';

  select coalesce(jsonb_object_agg(status_key, n), '{}'::jsonb)
    into v_attendance_statuses
  from (
    select coalesce(r.final_status, 'not_recorded') as status_key, count(*) as n
    from public.attendance_records r
    join public.attendance_sessions s on s.id = r.session_id
    where s.school_id = check_school_id
      and s.attendance_date between p_start_date and p_end_date
      and s.status = 'finalized'
    group by coalesce(r.final_status, 'not_recorded')
  ) q;

  select count(*) into v_classroom_sessions
  from public.classroom_sessions cs
  where cs.school_id = check_school_id
    and (cs.started_at at time zone v_timezone)::date between p_start_date and p_end_date;

  select
    count(*),
    count(distinct coalesce(sub.student_uuid::text, nullif(btrim(sub.student_id), ''))),
    round(avg(
      case when sub.possible_score > 0
        then sub.score::numeric * 100.0 / sub.possible_score::numeric
      end
    ), 1),
    count(*) filter (where sub.student_uuid is null)
  into
    v_classroom_submissions,
    v_classroom_students,
    v_assessment_avg,
    v_unlinked_classroom
  from public.classroom_submissions sub
  join public.classroom_sessions cs on cs.id = sub.classroom_session_id
  where cs.school_id = check_school_id
    and (cs.started_at at time zone v_timezone)::date between p_start_date and p_end_date;

  select count(*) into v_job_card_sessions
  from public.job_card_sessions js
  where js.school_id = check_school_id
    and (js.started_at at time zone v_timezone)::date between p_start_date and p_end_date;

  select
    count(*),
    count(*) filter (where lower(coalesce(sub.review_decision, '')) in ('accepted','pass','approved')),
    count(*) filter (where lower(coalesce(sub.review_decision, '')) in ('recheck','revise','retry')),
    count(*) filter (where sub.student_uuid is null)
  into
    v_job_card_submissions,
    v_job_card_accepted,
    v_job_card_recheck,
    v_unlinked_job_cards
  from public.job_card_submissions sub
  join public.job_card_sessions js on js.id = sub.job_card_session_id
  where sub.school_id = check_school_id
    and (js.started_at at time zone v_timezone)::date between p_start_date and p_end_date;

  select count(*) into v_instructor_notes
  from public.instructor_notes n
  where n.school_id = check_school_id
    and (n.created_at at time zone v_timezone)::date between p_start_date and p_end_date;

  select
    count(*),
    count(*) filter (
      where lower(coalesce(r.school_decision, '')) in ('approved','accept','accepted')
         or lower(coalesce(r.owner_status, '')) in ('approved','accept','accepted')
    )
  into v_agenda_reviews, v_agenda_approved
  from public.agenda_change_reviews r
  where r.school_id = check_school_id
    and (r.created_at at time zone v_timezone)::date between p_start_date and p_end_date;

  select count(*) into v_audit_events
  from public.audit_log a
  where a.school_id = check_school_id
    and (a.created_at at time zone v_timezone)::date between p_start_date and p_end_date;

  select coalesce(
    round(sum(extract(epoch from (e.clock_out_at - e.clock_in_at)) / 3600.0)::numeric, 2),
    0
  ) into v_employee_hours
  from public.timeclock_entries e
  where e.school_id = check_school_id
    and e.clock_out_at is not null
    and (e.clock_in_at at time zone v_timezone)::date between p_start_date and p_end_date;

  select count(*) into v_open_punches
  from public.timeclock_entries e
  where e.school_id = check_school_id
    and e.clock_out_at is null
    and (e.clock_in_at at time zone v_timezone)::date <= p_end_date;

  select count(distinct a.entry_id) into v_adjusted_entries
  from public.timeclock_adjustments a
  where a.school_id = check_school_id
    and (a.created_at at time zone v_timezone)::date between p_start_date and p_end_date;

  return jsonb_build_object(
    'scope','school',
    'school_id',check_school_id,
    'school_name',v_school_name,
    'timezone',v_timezone,
    'period',jsonb_build_object('start',p_start_date,'end',p_end_date),
    'instruction',jsonb_build_object(
      'sections',v_sections,
      'scheduled_days',v_scheduled_days,
      'completed_days',v_completed_days,
      'instruction_minutes',v_instruction_minutes,
      'instruction_hours',round(v_instruction_minutes/60.0,2),
      'followups',v_followups,
      'missing_completed_days',v_missing_deliveries,
      'archived_delivery_rows',v_archived_delivery_rows
    ),
    'students',jsonb_build_object(
      'active_students',v_students,
      'attendance_sessions',v_attendance_sessions,
      'attendance_finalized_sessions',v_attendance_finalized,
      'attendance_records',v_attendance_records,
      'present',v_attendance_present,
      'absent',v_attendance_absent,
      'left_early',v_attendance_left_early,
      'attendance_statuses',v_attendance_statuses,
      'attendance_rate_pct',case
        when (v_attendance_present+v_attendance_absent+v_attendance_left_early)>0
          then round(
            v_attendance_present::numeric*100.0 /
            (v_attendance_present+v_attendance_absent+v_attendance_left_early)::numeric,
            1
          )
        else null
      end
    ),
    'learning',jsonb_build_object(
      'classroom_sessions',v_classroom_sessions,
      'classroom_submissions',v_classroom_submissions,
      'students_assessed',v_classroom_students,
      'assessment_average_pct',v_assessment_avg,
      'job_card_sessions',v_job_card_sessions,
      'job_card_submissions',v_job_card_submissions,
      'job_card_accepted',v_job_card_accepted,
      'job_card_recheck',v_job_card_recheck
    ),
    'instructional_improvement',jsonb_build_object(
      'instructor_notes',v_instructor_notes,
      'agenda_reviews',v_agenda_reviews,
      'approved_changes',v_agenda_approved
    ),
    'workforce',jsonb_build_object(
      'employee_hours',v_employee_hours,
      'open_punches',v_open_punches,
      'adjusted_entries',v_adjusted_entries
    ),
    'usage',jsonb_build_object('audit_events',v_audit_events),
    'data_quality',jsonb_build_object(
      'unfinalized_attendance_sessions',greatest(v_attendance_sessions-v_attendance_finalized,0),
      'unlinked_classroom_submissions',v_unlinked_classroom,
      'unlinked_job_card_submissions',v_unlinked_job_cards,
      'open_timeclock_punches',v_open_punches,
      'scheduled_days_without_completion',v_missing_deliveries,
      'archived_delivery_rows_excluded_from_totals',v_archived_delivery_rows
    )
  );
end;
$$;
