-- Harden training-session and training-report SECURITY DEFINER functions.
-- Their application object and helper references are already schema-qualified.
-- Authorization behavior, report lifecycle, and grants are unchanged.

alter function public.acknowledge_training_report(uuid)
  set search_path = '';

alter function public.build_training_report(uuid)
  set search_path = '';

alter function public.can_manage_training_session(uuid)
  set search_path = '';

alter function public.can_receive_training_report(uuid)
  set search_path = '';

alter function public.create_training_session(uuid, text)
  set search_path = '';

alter function public.end_training_session(uuid, text)
  set search_path = '';

alter function public.get_pending_training_reports()
  set search_path = '';

alter function public.get_training_report(uuid)
  set search_path = '';

alter function public.is_training_session_member(uuid)
  set search_path = '';

alter function public.join_training_session(uuid)
  set search_path = '';

alter function public.leave_training_session(uuid)
  set search_path = '';

alter function public.queue_training_report_and_purge(uuid)
  set search_path = '';

alter function public.touch_training_session(uuid)
  set search_path = '';

alter function public.training_add_note(uuid, uuid, integer, text, text, boolean)
  set search_path = '';

alter function public.training_complete_current_day(uuid, uuid, text, boolean, text)
  set search_path = '';

alter function public.training_set_section_hold(uuid, uuid, boolean, text)
  set search_path = '';

alter function public.training_start_current_day(uuid, uuid)
  set search_path = '';
