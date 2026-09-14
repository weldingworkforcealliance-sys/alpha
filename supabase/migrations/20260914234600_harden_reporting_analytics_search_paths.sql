-- Finish public SECURITY DEFINER search-path hardening for LTG reporting,
-- analytics, and synchronization functions. Referenced application objects and
-- helper functions are already schema-qualified. Reporting behavior, trigger
-- behavior, authorization, and grants remain unchanged.

alter function public.can_view_ltg_reports(uuid)
  set search_path = '';

alter function public.capture_ltg_table_analytics_event()
  set search_path = '';

alter function public.finalize_ltg_report_snapshot(uuid)
  set search_path = '';

alter function public.generate_ltg_report_snapshot(uuid, text, text, date, date)
  set search_path = '';

alter function public.get_ltg_platform_reporting_summary(date, date)
  set search_path = '';

alter function public.get_ltg_reporting_summary(uuid, date, date)
  set search_path = '';

alter function public.ltg_reporting_summary_internal(uuid, date, date)
  set search_path = '';

alter function public.mirror_audit_log_to_analytics_events()
  set search_path = '';

alter function public.sync_completed_day_instructor_note()
  set search_path = '';

alter function public.track_ltg_page_view(text)
  set search_path = '';
