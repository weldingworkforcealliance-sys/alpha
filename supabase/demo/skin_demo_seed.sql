-- Development/demo-only skin seed.
-- Demonstrates program-level skin override without changing production data.

insert into public.branding_profiles (
  school_id,
  program_id,
  skin_key,
  display_name,
  short_name,
  primary_color,
  secondary_color,
  accent_color,
  skin_config,
  active
)
select
  p.school_id,
  p.id,
  'clinical-learning',
  'Radiography Demonstration',
  'RAD',
  '#1f5e7a',
  '#eaf3f7',
  '#48a3bd',
  '{"surface":"clinical","density":"calm","education_first":true}'::jsonb,
  true
from public.programs p
where p.name = 'Radiography Demonstration'
  and not exists (
    select 1
    from public.branding_profiles bp
    where bp.school_id = p.school_id
      and bp.program_id = p.id
  );
