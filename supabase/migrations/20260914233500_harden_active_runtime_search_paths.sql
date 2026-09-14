-- Harden active classroom, instructor-assignment, owner-agenda, and note-review
-- SECURITY DEFINER functions. Application objects/helper calls are already
-- schema-qualified; authorization behavior and grants remain unchanged.

alter function public.end_classroom_session(uuid)
  set search_path = '';

alter function public.get_classroom_submission_report(uuid)
  set search_path = '';

alter function public.assign_section_instructor(uuid, uuid, text)
  set search_path = '';

alter function public.deactivate_section_instructor(uuid, uuid)
  set search_path = '';

alter function public.owner_assign_instructor_to_section(uuid, uuid, text, text)
  set search_path = '';

alter function public.owner_remove_instructor_from_section(uuid, uuid, text)
  set search_path = '';

alter function public.owner_decide_agenda_change(uuid, text, text)
  set search_path = '';

alter function public.owner_move_guide_agenda_slot(uuid, integer)
  set search_path = '';

alter function public.owner_move_math_agenda_slot(uuid, integer)
  set search_path = '';

alter function public.review_day_completion_note(uuid, text, text)
  set search_path = '';
