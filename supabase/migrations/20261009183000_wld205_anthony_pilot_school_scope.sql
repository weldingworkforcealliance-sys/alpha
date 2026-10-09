-- Pilot school + section scoped preference policies.
-- FABTECH workspaces reuse visible WLD 205/section codes but have other UUIDs.
-- Keep core guides, learning outcomes, and other course data untouched.
begin;

alter policy planner_view_revisions_read
on public.planner_view_revisions
to authenticated
using (
  school_id = '08ccb452-83ab-482f-bb28-5576e02741b2'::uuid
  and section_id = '310623e6-c518-47b5-b7a0-8a1887df226e'::uuid
  and (select auth.uid()) is not null
  and (public.is_platform_owner() or public.is_school_member(school_id))
  and (
    scope = 'school'
    or instructor_id = (select auth.uid())
    or public.can_manage_memberships(school_id)
    or public.is_platform_owner()
  )
);

alter policy planner_view_revisions_append
on public.planner_view_revisions
to authenticated
with check (
  school_id = '08ccb452-83ab-482f-bb28-5576e02741b2'::uuid
  and section_id = '310623e6-c518-47b5-b7a0-8a1887df226e'::uuid
  and (select auth.uid()) is not null
  and changed_by = (select auth.uid())
  and exists (
    select 1
    from public.sections s
    join public.courses c on c.id = s.course_id and c.school_id = s.school_id
    where s.id = planner_view_revisions.section_id
      and s.school_id = planner_view_revisions.school_id
      and s.section_code = 'PCCC-DAY-L2-WLD205-2627'
      and c.course_code = 'WLD 205'
  )
  and (public.is_platform_owner() or public.is_school_member(school_id))
  and (
    (scope = 'school'
     and (public.can_manage_memberships(school_id) or public.is_platform_owner()))
    or
    (scope = 'instructor' and (
      public.can_manage_memberships(school_id)
      or public.is_platform_owner()
      or (
        instructor_id = (select auth.uid())
        and exists (
          select 1 from public.section_instructors si
          where si.school_id = planner_view_revisions.school_id
            and si.section_id = planner_view_revisions.section_id
            and si.instructor_id = (select auth.uid())
            and si.active
        )
      )
    ))
  )
);
commit;
