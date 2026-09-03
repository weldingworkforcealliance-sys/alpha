-- Time-clock foreign-key indexes identified by Supabase performance advisor.

create index if not exists timeclock_credentials_set_by_idx
  on private.timeclock_employee_credentials(set_by)
  where set_by is not null;

create index if not exists timeclock_employees_profile_idx
  on public.timeclock_employees(profile_id)
  where profile_id is not null;

create index if not exists timeclock_employees_created_by_idx
  on public.timeclock_employees(created_by)
  where created_by is not null;

create index if not exists timeclock_entries_clock_in_actor_idx
  on public.timeclock_entries(clock_in_actor)
  where clock_in_actor is not null;

create index if not exists timeclock_entries_clock_out_actor_idx
  on public.timeclock_entries(clock_out_actor)
  where clock_out_actor is not null;

create index if not exists timeclock_adjustments_employee_idx
  on public.timeclock_adjustments(employee_id);

create index if not exists timeclock_adjustments_adjusted_by_idx
  on public.timeclock_adjustments(adjusted_by);
