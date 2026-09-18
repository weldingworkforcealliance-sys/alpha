-- Service-safe audit writes for the class end-of-day cleanup.
-- Cron has no auth.uid(), so the cleanup records system actions directly with user_id = null.

create or replace function public.run_class_end_of_day_cleanup(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_local_date date := (p_now at time zone 'America/New_York')::date;
  v_local_time time := (p_now at time zone 'America/New_York')::time;
  v_session record;
  v_delivery record;
  v_attendance_finalized integer := 0;
  v_timers_closed integer := 0;
  v_failures integer := 0;
  v_max_days integer;
  v_completed_at timestamptz;
begin
  for v_session in
    select
      ats.*,
      ap.completion_section_id,
      ap.report_trigger,
      ap.report_email,
      ap.attendance_mode as pair_attendance_mode
    from public.attendance_sessions ats
    join public.attendance_pairs ap on ap.id = ats.pair_id
    where ats.status <> 'finalized'
      and ats.session_type = 'instructional'
      and ats.counts_toward_attendance = true
      and (
        ats.attendance_date < v_local_date
        or (ats.attendance_date = v_local_date and v_local_time >= time '23:30')
      )
      and not exists (
        select 1
        from public.attendance_pair_enrollments e
        join public.attendance_students stu
          on stu.id = e.student_id
         and stu.active = true
        left join public.attendance_records ar
          on ar.session_id = ats.id
         and ar.student_id = e.student_id
        where e.pair_id = ats.pair_id
          and e.active = true
          and e.created_at::date <= ats.attendance_date
          and (ar.id is null or ar.initial_status is null)
      )
  loop
    begin
      update public.attendance_records ar
      set final_status = coalesce(ar.final_status, ar.initial_status),
          completion_confirmed = true,
          updated_at = p_now
      where ar.session_id = v_session.id
        and ar.initial_status is not null;

      update public.attendance_sessions
      set status = 'finalized',
          finalized_at = p_now,
          finalized_by = null,
          report_recipient = case
            when v_session.attendance_mode = 'pvhs'
             and v_session.pair_attendance_mode = 'pvhs'
              then coalesce(report_recipient, v_session.report_email)
            else report_recipient
          end,
          updated_at = p_now
      where id = v_session.id;

      if v_session.attendance_mode = 'pvhs'
         and v_session.pair_attendance_mode = 'pvhs' then
        if v_session.report_trigger = 'initial_complete' then
          perform private.queue_pvhs_attendance_report_if_ready(v_session.id);
        elsif nullif(btrim(coalesce(v_session.report_email,'')),'') is not null then
          insert into public.attendance_report_queue
            (school_id, session_id, recipient_email, run_after, status)
          values
            (v_session.school_id, v_session.id, v_session.report_email, p_now, 'pending')
          on conflict (session_id) do update
          set recipient_email = excluded.recipient_email,
              run_after = excluded.run_after,
              status = case
                when public.attendance_report_queue.status = 'sent' then 'sent'
                else 'pending'
              end,
              last_error = null,
              updated_at = p_now;
        end if;
      end if;

      insert into public.audit_log
        (school_id,user_id,action,entity_type,entity_id,details,created_at)
      values
        (v_session.school_id,null,'automatic_end_of_day_attendance_finalize',
         'attendance_session',v_session.id,
         jsonb_build_object(
           'pair_id',v_session.pair_id,
           'attendance_date',v_session.attendance_date,
           'rule','copy_first_half_status_when_second_half_blank'
         ),
         p_now);

      v_attendance_finalized := v_attendance_finalized + 1;
    exception when others then
      v_failures := v_failures + 1;
      insert into public.audit_log
        (school_id,user_id,action,entity_type,entity_id,details,created_at)
      values
        (v_session.school_id,null,'automatic_end_of_day_attendance_finalize_failed',
         'attendance_session',v_session.id,
         jsonb_build_object(
           'pair_id',v_session.pair_id,
           'attendance_date',v_session.attendance_date,
           'error',sqlerrm
         ),
         p_now);
    end;
  end loop;

  for v_delivery in
    select
      pdd.id as delivery_id,
      pdd.school_id,
      pdd.section_id,
      pdd.planner_day_id,
      pdd.actual_date,
      pdd.started_at,
      pd.planner_day_number,
      pd.scheduled_date,
      s.end_time,
      s.planned_minutes_per_day,
      s.planned_instructional_days,
      sp.current_planner_day_number,
      sp.manual_hold
    from public.planner_day_delivery pdd
    join public.planner_days pd on pd.id = pdd.planner_day_id
    join public.sections s on s.id = pdd.section_id
    join public.section_progress sp on sp.section_id = pdd.section_id
    where pdd.delivery_status in ('in_progress','started')
      and pdd.started_at is not null
      and s.end_time is not null
      and (
        coalesce(pdd.actual_date, pd.scheduled_date) < v_local_date
        or (
          coalesce(pdd.actual_date, pd.scheduled_date) = v_local_date
          and v_local_time >= time '23:30'
        )
      )
  loop
    begin
      v_completed_at := greatest(
        v_delivery.started_at + interval '1 minute',
        (
          (coalesce(v_delivery.actual_date, v_delivery.scheduled_date)::timestamp + v_delivery.end_time)
          at time zone 'America/New_York'
        )
      );

      update public.planner_day_delivery
      set delivery_status = 'completed',
          completed_at = v_completed_at,
          actual_minutes = coalesce(
            v_delivery.planned_minutes_per_day,
            greatest(1, round(extract(epoch from (v_completed_at - v_delivery.started_at)) / 60.0)::integer)
          ),
          updated_at = p_now
      where id = v_delivery.delivery_id;

      update public.planner_day_coverage
      set status = 'completed',
          completed_at = v_completed_at,
          updated_at = p_now
      where planner_day_id = v_delivery.planner_day_id
        and status = 'active';

      if v_delivery.current_planner_day_number = v_delivery.planner_day_number then
        v_max_days := coalesce(
          v_delivery.planned_instructional_days,
          (select max(pd2.planner_day_number)
           from public.planner_days pd2
           where pd2.section_id = v_delivery.section_id)
        );

        if v_delivery.planner_day_number >= v_max_days then
          update public.section_progress
          set completed_at = coalesce(completed_at, v_completed_at),
              updated_at = p_now
          where section_id = v_delivery.section_id;
        elsif v_delivery.manual_hold then
          update public.section_progress
          set last_advanced_at = null,
              updated_at = p_now
          where section_id = v_delivery.section_id;
        else
          update public.section_progress
          set current_planner_day_number = v_delivery.planner_day_number + 1,
              last_advanced_at = v_completed_at,
              updated_at = p_now
          where section_id = v_delivery.section_id;
        end if;
      end if;

      insert into public.audit_log
        (school_id,user_id,action,entity_type,entity_id,details,created_at)
      values
        (v_delivery.school_id,null,'automatic_end_of_day_timer_close',
         'planner_day',v_delivery.planner_day_id,
         jsonb_build_object(
           'section_id',v_delivery.section_id,
           'planner_day_number',v_delivery.planner_day_number,
           'started_at',v_delivery.started_at,
           'completed_at',v_completed_at,
           'actual_minutes',coalesce(v_delivery.planned_minutes_per_day,1),
           'rule','scheduled_class_end'
         ),
         p_now);

      v_timers_closed := v_timers_closed + 1;
    exception when others then
      v_failures := v_failures + 1;
      insert into public.audit_log
        (school_id,user_id,action,entity_type,entity_id,details,created_at)
      values
        (v_delivery.school_id,null,'automatic_end_of_day_timer_close_failed',
         'planner_day',v_delivery.planner_day_id,
         jsonb_build_object(
           'section_id',v_delivery.section_id,
           'planner_day_number',v_delivery.planner_day_number,
           'error',sqlerrm
         ),
         p_now);
    end;
  end loop;

  return jsonb_build_object(
    'attendance_finalized', v_attendance_finalized,
    'timers_closed', v_timers_closed,
    'failures', v_failures,
    'local_date', v_local_date,
    'local_time', v_local_time
  );
end;
$$;
