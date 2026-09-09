update public.assessment_modules
set version=greatest(coalesce(version,0),13)
where slug='wld205_pvhs_bridge_day5';
