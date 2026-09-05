-- Keep PVHS report mode unavailable until the server-side email worker,
-- sender, API credential, scheduler, and controlled delivery test are verified.
-- Standard attendance remains fully usable.

create table if not exists public.attendance_reporting_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  pvhs_reporting_enabled boolean not null default false,
  readiness_note text not null default 'PVHS email reporting is pending server configuration and a controlled delivery test.',
  activated_at timestamptz,
  activated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.attendance_reporting_settings (school_id)
select id from public.schools
on conflict (school_id) do nothing;

alter table public.attendance_reporting_settings enable row level security;

drop policy if exists attendance_reporting_settings_select_management
  on public.attendance_reporting_settings;
create policy attendance_reporting_settings_select_management
on public.attendance_reporting_settings
for select to authenticated
using (public.can_manage_school(school_id));

grant select on public.attendance_reporting_settings to authenticated;

create or replace function public.guard_pvhs_reporting_readiness()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_enabled boolean := false;
begin
  if new.active and new.attendance_mode = 'pvhs' then
    select s.pvhs_reporting_enabled
      into v_enabled
    from public.attendance_reporting_settings s
    where s.school_id = new.school_id;

    if not coalesce(v_enabled, false) then
      raise exception 'PVHS email reporting is not enabled for this school yet. Complete server email configuration and the controlled delivery test first.';
    end if;
  end if;

  return new;
end;
$$;

create or replace trigger attendance_pairs_pvhs_readiness_guard
before insert or update of attendance_mode, active, school_id
on public.attendance_pairs
for each row execute function public.guard_pvhs_reporting_readiness();

revoke all on function public.guard_pvhs_reporting_readiness()
  from public, anon, authenticated;
