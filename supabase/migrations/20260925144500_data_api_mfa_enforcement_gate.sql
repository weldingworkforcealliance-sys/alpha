-- Optional Data API-wide MFA enforcement for signed-in LTG staff.
-- Anonymous student entry points and server/service-role traffic are unaffected.
-- Production is installed disabled; enable only after user enrollment is ready.

begin;

create table if not exists private.security_runtime_settings (
  setting_key text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

revoke all on table private.security_runtime_settings from public, anon, authenticated;

insert into private.security_runtime_settings(setting_key, enabled)
values ('require_authenticated_aal2', false)
on conflict (setting_key) do nothing;

create or replace function public.enforce_ltg_request_security()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_claims_text text;
  v_claims jsonb;
  v_role text;
  v_aal text;
  v_require_aal2 boolean := false;
begin
  v_claims_text := current_setting('request.jwt.claims', true);
  if nullif(v_claims_text, '') is null then
    return;
  end if;

  begin
    v_claims := v_claims_text::jsonb;
  exception when others then
    return;
  end;

  v_role := coalesce(v_claims->>'role', '');
  if v_role <> 'authenticated' then
    return;
  end if;

  select s.enabled
  into v_require_aal2
  from private.security_runtime_settings s
  where s.setting_key = 'require_authenticated_aal2';

  if coalesce(v_require_aal2, false) is false then
    return;
  end if;

  v_aal := coalesce(v_claims->>'aal', 'aal1');
  if v_aal <> 'aal2' then
    raise sqlstate 'PGRST'
      using message = json_build_object(
        'message', 'Multi-factor authentication is required for LTG staff access.',
        'code', 'LTG_MFA_REQUIRED'
      )::text,
      detail = json_build_object(
        'status', 403,
        'status_text', 'Forbidden'
      )::text;
  end if;
end;
$function$;

revoke all on function public.enforce_ltg_request_security() from public, anon, authenticated, service_role;
grant execute on function public.enforce_ltg_request_security() to authenticator;

alter role authenticator
  set pgrst.db_pre_request = 'public.enforce_ltg_request_security';

notify pgrst, 'reload config';

commit;
