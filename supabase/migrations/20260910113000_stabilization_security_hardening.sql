-- LTG stabilization hardening
--
-- These helpers are internal implementation details. They are invoked by
-- higher-level SECURITY DEFINER functions or database triggers and should not
-- be callable directly through the authenticated/anonymous RPC surface.
-- Keeping direct execution closed reduces the blast radius of a leaked object
-- id or an over-permissive client without changing normal LTG workflows.

revoke execute on function public.build_training_report(uuid)
  from public, anon, authenticated;

revoke execute on function public.queue_training_report_and_purge(uuid)
  from public, anon, authenticated;

revoke execute on function public.recalculate_guide_day_times(uuid)
  from public, anon, authenticated;

revoke execute on function public.recalculate_math_lesson_times(uuid)
  from public, anon, authenticated;

-- Trigger functions execute as part of their owning trigger. They do not need
-- to be exposed as application RPC endpoints.
revoke execute on function public.sync_auth_user_profile()
  from public, anon, authenticated;

revoke execute on function public.sync_completed_day_instructor_note()
  from public, anon, authenticated;

-- Retired Connected Classroom v1 RPCs remain present for migration history,
-- but only the v2 endpoints are part of the live application contract.
revoke execute on function public.list_assessment_modules()
  from public, anon, authenticated;

revoke execute on function public.start_classroom_session(uuid, text)
  from public, anon, authenticated;

revoke execute on function public.submit_classroom_assessment(text, text, text, jsonb)
  from public, anon, authenticated;

-- Two non-unique indexes duplicate the exact left-to-right key order already
-- provided by UNIQUE indexes. Removing them reduces write amplification while
-- preserving both uniqueness enforcement and lookup capability.
drop index if exists public.attendance_sessions_pair_date_idx;
drop index if exists public.training_delivery_session_idx;
