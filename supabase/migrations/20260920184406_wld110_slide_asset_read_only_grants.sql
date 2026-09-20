-- Row-level SELECT policies remain the instructor authorization boundary.
-- Remove default table privileges that RLS does not protect, including TRUNCATE.
revoke all on table public.instructor_courseware_slide_assets from public, anon, authenticated;
grant select on table public.instructor_courseware_slide_assets to authenticated;
