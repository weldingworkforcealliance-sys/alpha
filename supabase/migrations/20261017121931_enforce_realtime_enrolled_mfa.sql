begin;

-- Realtime evaluates table RLS without PostgREST's pre-request hook. Keep the
-- same current-enrollment rule at that boundary, without exposing Auth records.
create function private.meets_enrolled_mfa()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  request_user_id uuid;
begin
  if current_setting('role', true) is distinct from 'authenticated' then
    return false;
  end if;
  begin
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
    request_user_id := (claims->>'sub')::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  if request_user_id is null or (claims->>'role') is distinct from 'authenticated' then
    return false;
  end if;
  return coalesce((claims->>'aal') = 'aal2', false) or not exists (
    select 1 from auth.mfa_factors f
    where f.user_id = request_user_id and f.status = 'verified'
  );
end;
$$;

revoke all on function private.meets_enrolled_mfa() from public;
grant usage on schema private to authenticated;
grant execute on function private.meets_enrolled_mfa() to authenticated;

-- Restrictive policies AND with every existing instructor/owner policy. A new
-- permissive policy would OR with the existing grants and would not close this.
create policy classroom_submissions_enrolled_mfa
on public.classroom_submissions as restrictive for select to authenticated
using ((select private.meets_enrolled_mfa()));

create policy job_card_submissions_enrolled_mfa
on public.job_card_submissions as restrictive for select to authenticated
using ((select private.meets_enrolled_mfa()));

-- Postgres Changes DELETE payloads do not undergo RLS. Neither submission UI
-- has a delete workflow: normal operations are student INSERT / teacher UPDATE.
-- Refuse to change publication semantics if unrelated tables were added.
do $$
begin
  if (select array_agg(schemaname || '.' || tablename order by schemaname, tablename)
      from pg_publication_tables where pubname = 'supabase_realtime')
     is distinct from array['public.classroom_submissions', 'public.job_card_submissions'] then
    raise exception 'Review Realtime publication membership before applying the MFA boundary';
  end if;
end;
$$;
alter publication supabase_realtime set (publish = 'insert, update');

notify pgrst, 'reload schema';
commit;
