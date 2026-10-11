-- Allow an explicit instructor "follow school default" revision without
-- deleting prior personal choices. School-level revisions must always be
-- standard or a named presentation preset.
alter table public.planner_view_revisions
  drop constraint if exists planner_view_revisions_preset_check;
alter table public.planner_view_revisions
  add constraint planner_view_revisions_preset_check check (
    preset in ('standard', 'anthony_wld205_v1')
    or (scope = 'instructor' and preset = 'inherit')
  );
