-- Increase entropy for newly created anonymous classroom/job-card join codes.
-- Existing six-character active codes remain valid because lookup RPCs treat
-- join_code as text and do not enforce a fixed length.

begin;

create or replace function public.make_classroom_join_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  code text;
begin
  loop
    code := upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,8));
    exit when not exists(
      select 1 from public.classroom_sessions where join_code=code
    );
  end loop;
  return code;
end
$$;

revoke all on function public.make_classroom_join_code()
  from public, anon, authenticated;

create or replace function private.job_card_generate_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,8));
    exit when not exists (
      select 1
      from public.job_card_sessions s
      where upper(s.join_code) = v_code
    );
  end loop;
  return v_code;
end
$$;

revoke all on function private.job_card_generate_code()
  from public, anon, authenticated;

commit;
