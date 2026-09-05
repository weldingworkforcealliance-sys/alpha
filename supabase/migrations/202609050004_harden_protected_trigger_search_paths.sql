-- Harden protected trigger functions by fixing their search_path.
-- These trigger functions use only auth.* and trigger record variables, so an empty
-- search_path is safe and avoids role-mutable lookup behavior.

create or replace function public.block_protected_content_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.role() is not null then
    raise exception 'Protected curriculum and course outcomes cannot be modified through the application.';
  end if;

  return case
    when tg_op = 'DELETE' then old
    else new
  end;
end;
$$;

create or replace function public.block_school_id_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.school_id is distinct from old.school_id
     and auth.uid() is not null then
    raise exception 'school_id is immutable after record creation';
  end if;

  return new;
end;
$$;
