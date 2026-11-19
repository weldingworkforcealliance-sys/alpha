-- Production regression fixtures run in a subtransaction and always roll back.
-- No students, curriculum, or external messages are created.
do $test$
declare
  v_section uuid; v_day7 uuid; v_day8 uuid; v_day9 uuid; v_queue uuid;
  v_now timestamptz:=now(); v_count integer; v_before text; v_after text;
begin
  select s.id into strict v_section from public.sections s where s.section_code='PVHS-A-WLD205-2627';
  select id into strict v_day7 from public.planner_days where section_id=v_section and planner_day_number=7;
  select id into strict v_day8 from public.planner_days where section_id=v_section and planner_day_number=8;
  select id into strict v_day9 from public.planner_days where section_id=v_section and planner_day_number=9;
  select md5(jsonb_build_object(
    'section',(select to_jsonb(s) from public.sections s where id=v_section),
    'progress',(select to_jsonb(p) from public.section_progress p where section_id=v_section),
    'delivery',(select jsonb_agg(to_jsonb(d) order by id) from public.planner_day_delivery d where section_id=v_section),
    'queue',(select jsonb_agg(to_jsonb(q) order by id) from public.class_watchdog_queue q))::text) into v_before;
  begin
    delete from public.class_watchdog_queue where section_id=v_section;
    delete from public.planner_day_delivery where planner_day_id=v_day8;
    update public.section_progress set current_planner_day_number=7,manual_hold=false where section_id=v_section;
    update public.planner_day_delivery set delivery_status='in_progress',actual_date='2026-09-18',
      started_at='2026-09-18 15:45:00+00',completed_at=null where planner_day_id=v_day7;

    if not exists(select 1 from private.class_watchdog_candidates('2026-09-18 17:00:00+00') c
      where c.section_id=v_section and c.planner_day_id=v_day7 and c.scheduled_end_at='2026-09-18 16:30:00+00') then
      raise exception 'FAIL: actual-date stale planner timer not detected at +30'; end if;
    if exists(select 1 from private.class_watchdog_candidates('2026-09-18 16:59:59+00') where section_id=v_section) then
      raise exception 'FAIL: reminder before +30'; end if;
    if exists(select 1 from private.class_watchdog_candidates('2026-09-18 18:00:00+00') where section_id=v_section) then
      raise exception 'FAIL: reminder at or after +90'; end if;
    perform public.enqueue_class_watchdog_reminders('2026-09-18 17:00:00+00');
    perform public.enqueue_class_watchdog_reminders('2026-09-18 17:05:00+00');
    select count(*) into v_count from public.class_watchdog_queue where section_id=v_section;
    if v_count<>1 then raise exception 'FAIL: duplicate enqueue %',v_count; end if;

    update public.planner_day_delivery set delivery_status='completed',completed_at='2026-09-18 16:55:00+00' where planner_day_id=v_day7;
    update public.section_progress set current_planner_day_number=8 where section_id=v_section;
    if exists(select 1 from private.class_watchdog_candidates('2026-09-18 17:00:00+00') where section_id=v_section) then
      raise exception 'FAIL: completed actual class triggers phantom next-day reminder'; end if;
    if exists(select 1 from private.class_watchdog_candidates('2026-09-19 01:10:00+00') where section_id=v_section) then
      raise exception 'FAIL: reproduced 9:10 PM false reminder'; end if;

    update public.planner_day_delivery set actual_date='2026-09-17',started_at='2026-09-17 15:45:00+00' where planner_day_id=v_day7;
    update public.section_progress set current_planner_day_number=7 where section_id=v_section;
    if not exists(select 1 from private.class_watchdog_candidates('2026-09-18 17:00:00+00') c
      where c.section_id=v_section and c.planner_day_id=v_day8) then
      raise exception 'FAIL: stale counter hid missing scheduled class'; end if;
    update public.section_progress set manual_hold=true where section_id=v_section;
    if exists(select 1 from private.class_watchdog_candidates('2026-09-18 17:00:00+00') where section_id=v_section) then
      raise exception 'FAIL: manual hold ignored'; end if;
    update public.section_progress set manual_hold=false where section_id=v_section;

    -- Dynamic current-date fixture exercises the unchanged worker RPC signature.
    update public.sections set end_time=((v_now-interval '45 minutes') at time zone 'America/New_York')::time where id=v_section;
    update public.planner_day_delivery set delivery_status='in_progress',
      actual_date=(v_now at time zone 'America/New_York')::date,started_at=v_now-interval '60 minutes',completed_at=null
      where planner_day_id=v_day7;
    perform public.enqueue_class_watchdog_reminders(v_now);
    select id into strict v_queue from public.class_watchdog_queue
      where section_id=v_section and scheduled_end_at::date=v_now::date;
    if (select count(*) from public.class_watchdog_queue where section_id=v_section)<>2 then
      raise exception 'FAIL: same planner day on later actual date was deduplicated'; end if;
    perform * from public.claim_due_class_watchdog_reminders(100);
    if (select status from public.class_watchdog_queue where id=v_queue)<>'processing'
      or not public.class_watchdog_reminder_is_due(v_queue) then
      raise exception 'FAIL: valid candidate was not claimable'; end if;
    if exists(select 1 from public.class_watchdog_queue where section_id=v_section
      and scheduled_end_at='2026-09-18 16:30:00+00' and status<>'cancelled') then
      raise exception 'FAIL: expired queued reminder not cancelled'; end if;

    update public.planner_day_delivery set delivery_status='completed',completed_at=v_now where planner_day_id=v_day7;
    if public.class_watchdog_reminder_is_due(v_queue) then
      raise exception 'FAIL: resolved class remained sendable after claim'; end if;
    update public.class_watchdog_queue set status='failed' where id=v_queue;
    perform * from public.claim_due_class_watchdog_reminders(100);
    if (select status from public.class_watchdog_queue where id=v_queue)<>'cancelled' then
      raise exception 'FAIL: resolved retry not cancelled'; end if;

    if has_function_privilege('anon','public.class_watchdog_reminder_is_due(uuid)','EXECUTE')
      or has_function_privilege('authenticated','public.enqueue_class_watchdog_reminders(timestamptz)','EXECUTE')
      or has_function_privilege('authenticated','public.claim_due_class_watchdog_reminders(integer)','EXECUTE') then
      raise exception 'FAIL: worker RPC exposed to client roles'; end if;
    raise exception using errcode='PZ001',message='fixtures passed; rollback fixture subtransaction';
  exception when sqlstate 'PZ001' then null;
  end;
  select md5(jsonb_build_object(
    'section',(select to_jsonb(s) from public.sections s where id=v_section),
    'progress',(select to_jsonb(p) from public.section_progress p where section_id=v_section),
    'delivery',(select jsonb_agg(to_jsonb(d) order by id) from public.planner_day_delivery d where section_id=v_section),
    'queue',(select jsonb_agg(to_jsonb(q) order by id) from public.class_watchdog_queue q))::text) into v_after;
  if v_before is distinct from v_after then raise exception 'FAIL: fixtures changed persisted state'; end if;
end $test$;
