-- WLD 105 Day 4: add readable Motor Adaptor Bracket detail views.
-- These are derived from the existing verified Motor Adaptor Bracket reference asset;
-- no dimensions, notes, or geometry are redrawn or altered.

with src as (
  select image_url
  from public.assessment_reference_assets
  where assessment_slug='blueprint_day4'
    and asset_key='motor_adaptor_bracket'
), details(asset_key,title,sort_order,x,y,w,h,notes) as (
  values
    ('motor_upper_view','Motor Adaptor Bracket — Upper View / Top Dimension Cluster',3,520,20,760,455,'Detail view for the upper projection, hole callouts, weld symbol, and tight dimension cluster.'),
    ('motor_main_view','Motor Adaptor Bracket — Main Front View',4,555,385,690,555,'Detail view for the main circular front view, hole pattern, angular callouts, and right-side dimensions.'),
    ('motor_side_view','Motor Adaptor Bracket — Side View / Base Plate',5,35,420,600,510,'Detail view for View X, base plate, weld information, thickness note, and lower-left dimensions.'),
    ('motor_notes','Motor Adaptor Bracket — Notes / Title Block / Callouts',6,245,815,1060,265,'Detail view for the paint note, drawing identification, title block, and lower drawing information.')
)
insert into public.assessment_reference_assets(
  assessment_slug,asset_key,title,image_url,original_image_url,notes,sort_order,created_at,updated_at
)
select
  'blueprint_day4',
  d.asset_key,
  d.title,
  'data:image/svg+xml;base64,' || encode(convert_to(
    '<svg xmlns="http://www.w3.org/2000/svg" width="' || (d.w*3)::text || '" height="' || (d.h*3)::text || '" viewBox="' || d.x::text || ' ' || d.y::text || ' ' || d.w::text || ' ' || d.h::text || '">' ||
    '<rect x="' || d.x::text || '" y="' || d.y::text || '" width="' || d.w::text || '" height="' || d.h::text || '" fill="white"/>' ||
    '<image href="' || src.image_url || '" x="0" y="0" width="1332" height="1096" preserveAspectRatio="none" style="filter:contrast(1.18) brightness(1.04)"/>' ||
    '</svg>',
    'UTF8'
  ),'base64'),
  src.image_url,
  d.notes,
  d.sort_order,
  now(),
  now()
from src
cross join details d
on conflict (assessment_slug,asset_key) do update
set
  title=excluded.title,
  image_url=excluded.image_url,
  original_image_url=excluded.original_image_url,
  notes=excluded.notes,
  sort_order=excluded.sort_order,
  updated_at=now();

update public.assessment_modules
set
  version=greatest(coalesce(version,0),151),
  reference_title='DAY 4 BLUEPRINT REFERENCES — Robot Table + Motor Adaptor Bracket Detail Views'
where slug='blueprint_day4';
