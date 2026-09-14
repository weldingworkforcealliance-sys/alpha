create table if not exists public.branding_profiles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  program_id uuid null references public.programs(id) on delete cascade,
  skin_key text not null default 'ltg-default',
  display_name text null,
  short_name text null,
  logo_url text null,
  program_logo_url text null,
  primary_color text null,
  secondary_color text null,
  accent_color text null,
  header_text text null,
  footer_text text null,
  skin_config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branding_profiles_skin_key_check check (skin_key ~ '^[a-z0-9][a-z0-9-]{0,63}$')
);

create unique index if not exists branding_profiles_school_default_key
  on public.branding_profiles(school_id)
  where program_id is null;

create unique index if not exists branding_profiles_school_program_key
  on public.branding_profiles(school_id, program_id)
  where program_id is not null;

create index if not exists branding_profiles_lookup_idx
  on public.branding_profiles(school_id, program_id, active);

alter table public.branding_profiles enable row level security;

drop policy if exists branding_profiles_select_member on public.branding_profiles;
create policy branding_profiles_select_member
  on public.branding_profiles
  for select
  to authenticated
  using (
    public.is_platform_owner()
    or exists (
      select 1
      from public.school_memberships sm
      where sm.user_id = auth.uid()
        and sm.school_id = branding_profiles.school_id
        and sm.status = 'active'
    )
  );

insert into public.branding_profiles (
  school_id, skin_key, display_name, short_name, logo_url, program_logo_url,
  primary_color, secondary_color, accent_color, header_text, footer_text, active
)
select
  sb.school_id,
  'ltg-default',
  sb.display_name,
  sb.short_name,
  sb.logo_url,
  sb.program_logo_url,
  sb.primary_color,
  sb.secondary_color,
  sb.accent_color,
  sb.header_text,
  sb.footer_text,
  true
from public.school_branding sb
where not exists (
  select 1 from public.branding_profiles bp
  where bp.school_id = sb.school_id and bp.program_id is null
);
