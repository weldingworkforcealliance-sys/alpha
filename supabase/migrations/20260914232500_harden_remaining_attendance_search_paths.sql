-- Complete search-path hardening for the remaining active attendance RPCs.
-- These functions already schema-qualify application objects and authorization
-- helpers. Behavior and grants are intentionally unchanged.

alter function public.bulk_upsert_attendance_roster(uuid, text)
  set search_path = '';

alter function public.request_attendance_report_resend(uuid)
  set search_path = '';

alter function public.save_attendance_pair(uuid, uuid, uuid, text, text, text, integer, boolean)
  set search_path = '';
