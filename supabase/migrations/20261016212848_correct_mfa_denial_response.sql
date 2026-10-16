begin;

-- Preserve the applied gate; return a valid PostgREST denial envelope.
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
      message = '{"code":"LTG_MFA_REQUIRED","message":"Verify your sign-in with your authenticator before accessing LTG staff data.","details":null,"hint":"Complete MFA sign-in."}',
      detail = '{"status":403,"status_text":"Forbidden","headers":{}}';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;

