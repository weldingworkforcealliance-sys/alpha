-- One-time compatibility seed for the current PCCC Welding tenant.
-- Keep the school default neutral so future PCCC programs can use independent skins.

with target_program as (
  select
    s.id as school_id,
    p.id as program_id
  from public.schools s
  join public.programs p on p.school_id = s.id
  where p.status = 'active'
    and (
      lower(s.name) = 'passaic county community college'
      or lower(s.name) like '%passaic%community college%'
    )
    and lower(p.name) like '%weld%'
)
update public.branding_profiles bp
set
  skin_key = 'pccc-welding',
  display_name = coalesce(bp.display_name, 'PCCC Welding'),
  short_name = coalesce(bp.short_name, 'PCCC'),
  active = true,
  updated_at = now()
from target_program tp
where bp.school_id = tp.school_id
  and bp.program_id = tp.program_id;

with target_program as (
  select
    s.id as school_id,
    p.id as program_id
  from public.schools s
  join public.programs p on p.school_id = s.id
  where p.status = 'active'
    and (
      lower(s.name) = 'passaic county community college'
      or lower(s.name) like '%passaic%community college%'
    )
    and lower(p.name) like '%weld%'
)
insert into public.branding_profiles (
  school_id,
  program_id,
  skin_key,
  display_name,
  short_name,
  active
)
select
  tp.school_id,
  tp.program_id,
  'pccc-welding',
  'PCCC Welding',
  'PCCC',
  true
from target_program tp
where not exists (
  select 1
  from public.branding_profiles bp
  where bp.school_id = tp.school_id
    and bp.program_id = tp.program_id
);
