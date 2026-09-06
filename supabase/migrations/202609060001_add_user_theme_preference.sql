alter table public.profiles
  add column if not exists theme_preference text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_theme_preference_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_theme_preference_check
      check (theme_preference is null or theme_preference in ('light', 'dark'));
  end if;
end
$$;

comment on column public.profiles.theme_preference is
  'LTG visual theme preference. Null means no explicit user selection yet; supported values are light and dark.';
