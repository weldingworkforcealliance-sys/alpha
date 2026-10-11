-- Harden the staging migration's row-correlation references.
-- Fully qualify the candidate row so SQL cannot resolve "school_id" or
-- "section_id" to the subquery's own same-named columns.
-- Also idempotent when the original migration already had this correction.
alter policy planner_view_revisions_append on public.planner_view_revisions
  with check (
    (select auth.uid()) is not null
    and changed_by = (select auth.uid())
    and exists (
      select 1 from public.sections s
      where s.id = planner_view_revisions.section_id
        and s.school_id = planner_view_revisions.school_id
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
              where si.school_id = planner_view_revisions.school_id
                and si.section_id = planner_view_revisions.section_id
                and si.instructor_id = (select auth.uid())
                and si.active
            )
          )
        )
      )
    )
  );
