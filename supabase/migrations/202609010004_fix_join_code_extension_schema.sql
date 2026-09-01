-- Supabase installs pgcrypto in the extensions schema.

create or replace function public.make_classroom_join_code()
returns text language plpgsql volatile set search_path=public as $$
declare code text;
begin
  loop
    code := upper(substr(encode(extensions.gen_random_bytes(6),'hex'),1,6));
    exit when not exists(select 1 from public.classroom_sessions where join_code=code);
  end loop;
  return code;
end $$;

revoke execute on function public.make_classroom_join_code() from public, anon, authenticated;
