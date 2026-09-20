-- Run only in the isolated staging project after loading the purchased slides.
-- Uses the two explicitly approved temporary preview accounts. All changes roll back.
begin;
do $$
declare
  teacher uuid;
  noninstructor uuid;
  expected integer;
  visible integer;
begin
  select id into strict teacher from auth.users where email='wld110-preview-instructor@ltg-staging.invalid';
  select id into strict noninstructor from auth.users where email='wld110-preview-noninstructor@ltg-staging.invalid';
  select count(*) into expected from public.instructor_courseware_slide_assets;
  if expected<>77 then raise exception 'Expected all 77 mapped staging slides, found %',expected; end if;
  if has_table_privilege('anon','public.instructor_courseware_slide_assets','SELECT') then raise exception 'Anonymous slide grant'; end if;
  if has_table_privilege('authenticated','public.instructor_courseware_slide_assets','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES') then raise exception 'Unexpected client write grant'; end if;

  perform set_config('request.jwt.claim.sub',teacher::text,true);
  execute 'set local role authenticated';
  select count(*) into visible from public.instructor_courseware_slide_assets;
  if visible<>expected then raise exception 'Instructor cannot read every slide'; end if;

  perform set_config('request.jwt.claim.sub',noninstructor::text,true);
  select count(*) into visible from public.instructor_courseware_slide_assets;
  if visible<>0 then raise exception 'Non-instructor can read courseware'; end if;
  execute 'reset role';

  -- The existing staging School A has no access to the PCCC licensed courseware.
  -- Use the existing School A instructor fixture; memberships are immutable.
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-222222222222',true);
  execute 'set local role authenticated';
  select count(*) into visible from public.instructor_courseware_slide_assets;
  if visible<>0 then raise exception 'Instructor from another school can read courseware'; end if;
  execute 'reset role';
end $$;
rollback;
