-- Harden the most frequently used authenticated authorization helpers.
-- Their bodies already schema-qualify referenced objects, so this is a
-- no-behavior-change reduction of SECURITY DEFINER object-resolution risk.

alter function public.is_platform_owner()
  set search_path = '';

alter function public.is_school_member(uuid)
  set search_path = '';

alter function public.has_school_role(uuid, public.app_school_role[])
  set search_path = '';

alter function public.is_section_instructor(uuid, uuid)
  set search_path = '';

alter function public.can_manage_school(uuid)
  set search_path = '';

alter function public.can_manage_memberships(uuid)
  set search_path = '';

alter function public.can_review_instruction(uuid)
  set search_path = '';

alter function public.is_school_instructional_staff(uuid)
  set search_path = '';
