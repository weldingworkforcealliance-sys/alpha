-- Staging-certified hardening captured 2026-09-11.
--
-- Validated in the Gltg staging project before this migration was added:
--   * payroll draft generation + regeneration + finalize + report download
--   * cross-school RLS isolation
--   * anonymous Live Classroom / Live Job Card join and submit flows
--   * instructor/admin/Platform Owner authorization boundaries
--
-- This migration intentionally does NOT change the four anonymous student entry RPCs:
--   get_classroom_assessment(text)
--   submit_classroom_assessment_v2(text,text,text,text,jsonb)
--   get_job_card_by_code(text)
--   submit_job_card(text,text,text,jsonb,jsonb,jsonb,text,text)

-- 1) Repair the legacy payroll column references left behind after the ADP export
-- naming was replaced by the generic report-download naming.
do $payroll_fix$
declare
  v_oid oid;
  v_ddl text;
begin
  select p.oid
    into v_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'timeclock_generate_weekly_report_impl'
    and pg_get_function_identity_arguments(p.oid) = 'p_school_id uuid, p_week_start date';

  if v_oid is null then
    raise exception 'private.timeclock_generate_weekly_report_impl(uuid,date) was not found';
  end if;

  v_ddl := pg_get_functiondef(v_oid);

  if v_ddl ilike '%adp_exported_%' then
    v_ddl := replace(v_ddl, 'adp_exported_by', 'report_downloaded_by');
    v_ddl := replace(v_ddl, 'adp_exported_at', 'report_downloaded_at');
    execute v_ddl;
  end if;
end
$payroll_fix$;

-- 2) Remove accidental anonymous EXECUTE privileges from SECURITY DEFINER RPCs.
-- The allowlist below is intentional: students use short-lived class/job-card join
-- codes and server-side validation to access these four functions without an LTG login.
do $rpc_hardening$
declare
  r record;
begin
  for r in
    select
      p.oid,
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosecdef = true
      and has_function_privilege('anon', p.oid, 'EXECUTE')
      and p.proname not in (
        'get_classroom_assessment',
        'submit_classroom_assessment_v2',
        'get_job_card_by_code',
        'submit_job_card'
      )
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from anon, public',
      r.nspname,
      r.proname,
      r.args
    );
  end loop;
end
$rpc_hardening$;

-- 3) Make the training-report outbox's direct-access denial explicit.
-- Reports remain accessible only through the authorized SECURITY DEFINER report RPCs.
alter table public.training_report_outbox enable row level security;

drop policy if exists training_report_outbox_no_direct_access
  on public.training_report_outbox;

create policy training_report_outbox_no_direct_access
on public.training_report_outbox
as permissive
for all
to anon, authenticated
using (false)
with check (false);
