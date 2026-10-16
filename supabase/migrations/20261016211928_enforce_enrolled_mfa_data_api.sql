begin;

-- PostgREST calls this AFTER SET LOCAL ROLE. Every request role needs EXECUTE,
-- including public student/demo requests and trusted background services.
-- Keep the factor lookup outside exposed schemas; never grant clients Auth data.
create or replace function private.enforce_enrolled_mfa()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_role text := current_setting('role', true);
  claims jsonb;
  request_user_id uuid;
begin
  if request_role in ('anon', 'service_role') then
    return;
  end if;
  if request_role is distinct from 'authenticated' then
    raise insufficient_privilege using message = 'Invalid API request role.';
  end if;

  begin
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
    request_user_id := (claims->>'sub')::uuid;
  exception when invalid_text_representation then
    raise insufficient_privilege using message = 'Invalid authenticated API request.';
  end;
  if request_user_id is null or (claims->>'role') is distinct from 'authenticated' then
    raise insufficient_privilege using message = 'Invalid authenticated API request.';
  end if;

  -- Match the sign-in policy: require the second factor for enrolled users.
  -- Enrollment is authoritative even when the JWT predates factor verification.
  -- Do not exempt owners, RPC names, request paths, or caller-supplied headers.
  if (claims->>'aal') is distinct from 'aal2' and exists (
    select 1 from auth.mfa_factors f
    where f.user_id = request_user_id and f.status = 'verified'
  ) then
    raise sqlstate 'PGRST' using
      message = '{"code":"LTG_MFA_REQUIRED","message":"Verify your sign-in with your authenticator before accessing LTG staff data."}',
      detail = '{"status":403,"status_text":"Forbidden"}';
  end if;
end;
$$;

revoke all on function private.enforce_enrolled_mfa() from public;
grant usage on schema private to anon, authenticated, service_role;
grant execute on function private.enforce_enrolled_mfa() to anon, authenticated, service_role;

-- Does not intercept Auth endpoints used to challenge/verify MFA or recover a
-- password. Existing table RLS and RPC authorization still apply after this gate.
alter role authenticator set pgrst.db_pre_request = 'private.enforce_enrolled_mfa';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';

commit;
