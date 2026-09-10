-- LTG stabilization: prevent clients from forging arbitrary audit events.
--
-- write_audit_event is an internal helper used by trusted SECURITY DEFINER RPCs.
-- It previously remained directly executable by any authenticated school member,
-- allowing a client to submit arbitrary action/entity/details values. Keep the
-- helper available to database-owned functions and service-role workflows, but
-- remove it from the browser RPC surface. The one legitimate browser use gets a
-- narrow Platform Owner-only wrapper with a fixed audit action/entity type.

begin;

create or replace function public.record_owner_password_reset_request(
  p_user_id uuid,
  p_email text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_platform_owner() then
    raise exception 'Platform Owner access required';
  end if;

  if p_user_id is null then
    raise exception 'User is required';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required';
  end if;

  perform public.write_audit_event(
    null,
    'owner_send_password_reset',
    'profile',
    p_user_id,
    jsonb_build_object(
      'email', nullif(btrim(coalesce(p_email, '')), ''),
      'reason', btrim(p_reason)
    )
  );
end;
$$;

revoke all on function public.record_owner_password_reset_request(uuid, text, text)
  from public, anon;
grant execute on function public.record_owner_password_reset_request(uuid, text, text)
  to authenticated;

-- The generic writer is an implementation detail, not a user-facing RPC.
revoke execute on function public.write_audit_event(uuid, text, text, uuid, jsonb)
  from public, anon, authenticated;

-- Preserve server-side/internal execution explicitly.
grant execute on function public.write_audit_event(uuid, text, text, uuid, jsonb)
  to service_role;

commit;
