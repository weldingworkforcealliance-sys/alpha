-- Harden sensitive account-management SECURITY DEFINER functions.
-- Referenced objects/functions are already schema-qualified, so this changes
-- object resolution without changing authorization or account behavior.

alter function public.activate_my_invited_memberships()
  set search_path = '';

alter function public.can_invite_school_role(uuid, text)
  set search_path = '';

alter function public.admin_add_existing_user_to_school(uuid, text, text, text)
  set search_path = '';

alter function public.admin_lookup_user_by_email(uuid, text)
  set search_path = '';

alter function public.admin_prepare_invited_user(uuid, uuid, text, text, text, text)
  set search_path = '';

alter function public.owner_update_profile_display_name(uuid, text, text)
  set search_path = '';

alter function public.owner_update_school_membership(uuid, text, text, text)
  set search_path = '';

alter function public.write_audit_event(uuid, text, text, uuid, jsonb)
  set search_path = '';
