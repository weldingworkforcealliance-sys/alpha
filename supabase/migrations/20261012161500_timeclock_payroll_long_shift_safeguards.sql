-- LTG payroll safety: raw punch evidence stays intact; only reviewed completed
-- shifts enter calculated weekly totals. Reconcile unusually long shifts before
-- payroll finalization. Designed for staging-first rollout.
--
-- Deliberately patches the deployed function bodies rather than reconstructing
-- older variants and regressing existing security / report-download fixes.
do $timeclock_payroll_safety$
declare
  v_oid oid;
  v_ddl text;
  v_old_count int;
begin
  select p.oid into strict v_oid
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'timeclock_generate_weekly_report_impl'
    and pg_get_function_identity_arguments(p.oid) = 'p_school_id uuid, p_week_start date';

  v_ddl := pg_get_functiondef(v_oid);
  v_old_count := regexp_count(v_ddl, 'round\(sum\(re.hours_snapshot\), 2\)');
  if v_old_count = 4 then
    v_ddl := replace(
      v_ddl,
      'round(sum(re.hours_snapshot), 2)',
      'round(sum(re.hours_snapshot) filter (where not re.open_shift and not re.long_shift), 2)'
    );
    execute v_ddl;
  elsif position('sum(re.hours_snapshot) filter (where not re.open_shift and not re.long_shift)' in v_ddl) = 0 then
    raise exception 'Unexpected weekly-report function body; refusing unsafe rewrite';
  end if;

  -- The public weekly-report RPC recomputes calendar-day breakdowns after
  -- generating the snapshot. Make that routine exclude the same shifts.
  select p.oid into strict v_oid
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'timeclock_refresh_daily_hours_impl'
    and pg_get_function_identity_arguments(p.oid) = 'p_report_id uuid';

  v_ddl := pg_get_functiondef(v_oid);
  if position('when re.clock_out_at_snapshot is null then 0' in v_ddl) > 0 then
    v_ddl := replace(
      v_ddl,
      'when re.clock_out_at_snapshot is null then 0',
      'when re.clock_out_at_snapshot is null or re.long_shift then 0'
    );
    execute v_ddl;
  elsif position('when re.clock_out_at_snapshot is null or re.long_shift then 0' in v_ddl) = 0 then
    raise exception 'Unexpected daily-hours function body; refusing unsafe rewrite';
  end if;

  -- A report with unreviewed long shifts must not be finalized with missing
  -- wages. Correct the punches and regenerate the draft, retaining audit logs.
  select p.oid into strict v_oid
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'timeclock_finalize_weekly_report_impl'
    and pg_get_function_identity_arguments(p.oid) = 'p_report_id uuid';

  v_ddl := pg_get_functiondef(v_oid);
  if position('if v_report.long_shift_count > 0 then' in v_ddl) = 0 then
    if position('if v_report.open_shift_count > 0 then raise exception ''Resolve all open shifts before finalizing payroll''; end if;' in v_ddl) = 0 then
      raise exception 'Unexpected payroll finalization function body; refusing unsafe rewrite';
    end if;
    v_ddl := replace(
      v_ddl,
      'if v_report.open_shift_count > 0 then raise exception ''Resolve all open shifts before finalizing payroll''; end if;',
      'if v_report.open_shift_count > 0 then raise exception ''Resolve all open shifts before finalizing payroll''; end if;' || E'\n  ' ||
      'if v_report.long_shift_count > 0 then raise exception ''Correct overlong shifts and regenerate payroll before finalizing''; end if;'
    );
    execute v_ddl;
  end if;
end
$timeclock_payroll_safety$;

-- Existing snapshots, including finalized reports, are intentionally unchanged.
-- Unfinalized reports require regeneration after the migration. Original time
-- entries and adjustment history are never rewritten by this migration.
