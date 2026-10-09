-- Instructor/school presentation overlays. No course-guide, outcome, attendance,
-- gradebook, or planner progress rows are modified by this migration.
-- Every preference change is an immutable revision; "Standard" is a new revision,
-- not a deletion. Production application requires a separate promotion approval.
begin;

create table if not exists public.planner_view_revisions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  scope text not null check (scope in ('school', 'instructor')),
  instructor_id uuid references public.profiles(id) on delete cascade,
  preset text not null check (preset in ('standard', 'anthony_wld205_v1')),
  change_note text check (length(change_note) <= 500),
  changed_by uuid not null default auth.uid() references auth.users(id),
  changed_at timestamptz not null default now(),
  constraint planner_view_revisions_scope_owner_check
    check ((scope = 'school' and instructor_id is null)
        or (scope = 'instructor' and instructor_id is not null))
);

create index if not exists planner_view_revisions_lookup_idx
  on public.planner_view_revisions
    (school_id, section_id, scope, instructor_id, changed_at desc, id desc);

alter table public.planner_view_revisions enable row level security;
revoke all on table public.planner_view_revisions from public, anon, authenticated;
grant select on table public.planner_view_revisions to authenticated;
-- Explicit column grant prevents caller-forged timestamps, actor IDs, or row IDs.
grant insert (school_id, section_id, scope, instructor_id, preset, change_note)
  on table public.planner_view_revisions to authenticated;

create policy planner_view_revisions_read
  on public.planner_view_revisions
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and (public.is_platform_owner() or public.is_school_member(school_id))
    and (
      scope = 'school'
      or instructor_id = (select auth.uid())
      or public.can_manage_memberships(school_id)
      or public.is_platform_owner()
    )
  );

create policy planner_view_revisions_append
  on public.planner_view_revisions
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and changed_by = (select auth.uid())
    and exists (
      select 1 from public.sections s
      where s.id = section_id and s.school_id = school_id
    )
    and (public.is_platform_owner() or public.is_school_member(school_id))
    and (
      (
        scope = 'school'
        and (public.can_manage_memberships(school_id) or public.is_platform_owner())
      )
      or (
        scope = 'instructor'
        and (
          public.can_manage_memberships(school_id)
          or public.is_platform_owner()
          or (
            instructor_id = (select auth.uid())
            and exists (
              select 1 from public.section_instructors si
              where si.school_id = school_id
                and si.section_id = section_id
                and si.instructor_id = (select auth.uid())
                and si.active
            )
          )
        )
      )
    )
  );

comment on table public.planner_view_revisions is
  'Append-only versioned presentation preferences: canonical course guides and assessment records are unaffected.';

commit;
