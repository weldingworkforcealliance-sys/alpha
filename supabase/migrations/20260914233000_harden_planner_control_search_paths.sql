-- Harden planner-day, agenda, and owner-control SECURITY DEFINER functions.
-- Bodies already schema-qualify application objects and helper calls.
-- Authorization behavior and grants are intentionally unchanged.

alter function public.start_current_planner_day(uuid, date)
  set search_path = '';

alter function public.complete_current_planner_day(uuid, date, integer, text, boolean, text)
  set search_path = '';

alter function public.owner_clear_active_section_start(uuid, text)
  set search_path = '';

alter function public.owner_move_section_to_day(uuid, integer, text)
  set search_path = '';

alter function public.owner_reset_section_to_day(uuid, integer, text)
  set search_path = '';

alter function public.owner_set_section_hold(uuid, boolean, text)
  set search_path = '';

alter function public.save_my_agenda_slot_note(uuid, uuid, text, uuid, uuid, text)
  set search_path = '';

alter function public.school_review_agenda_note_change(uuid, text, text, integer, text)
  set search_path = '';

alter function public.owner_update_guide_agenda_slot(uuid, text, integer)
  set search_path = '';

alter function public.owner_update_math_agenda_slot(uuid, text, integer)
  set search_path = '';

alter function public.recalculate_guide_day_times(uuid)
  set search_path = '';

alter function public.recalculate_math_lesson_times(uuid)
  set search_path = '';
