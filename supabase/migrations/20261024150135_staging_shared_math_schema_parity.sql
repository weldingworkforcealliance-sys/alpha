-- Additive compatibility repair; preserve existing production mappings.
alter table public.course_guide_day_math add column if not exists shared_math_day_number integer;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.course_guide_day_math'::regclass and conname='course_guide_day_math_shared_math_day_number_check') then
  alter table public.course_guide_day_math add constraint course_guide_day_math_shared_math_day_number_check check (shared_math_day_number between 1 and 22);
 end if;
end $$;
