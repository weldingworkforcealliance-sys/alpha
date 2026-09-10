-- LTG stabilization: RLS performance cleanup
--
-- 1) Wrap auth.uid() in a scalar SELECT so Postgres can initialize it once
--    per statement instead of re-evaluating it for every candidate row.
-- 2) Split three attendance management FOR ALL policies into write-only
--    policies. Their SELECT access was redundant because every management
--    role is already included in is_school_instructional_staff().
--
-- Access semantics are intentionally unchanged.

-- school_memberships
DROP POLICY IF EXISTS school_memberships_select ON public.school_memberships;
CREATE POLICY school_memberships_select
ON public.school_memberships
FOR SELECT TO authenticated
USING (
  public.is_platform_owner()
  OR user_id = (SELECT auth.uid())
  OR public.is_school_member(school_id)
);

-- platform_owners
DROP POLICY IF EXISTS platform_owners_select ON public.platform_owners;
CREATE POLICY platform_owners_select
ON public.platform_owners
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

-- instructor_notes
DROP POLICY IF EXISTS instructor_notes_select ON public.instructor_notes;
CREATE POLICY instructor_notes_select
ON public.instructor_notes
FOR SELECT TO authenticated
USING (
  instructor_id = (SELECT auth.uid())
  OR (
    visibility = 'shared'
    AND (
      public.is_platform_owner()
      OR public.is_school_member(school_id)
    )
  )
);

DROP POLICY IF EXISTS instructor_notes_insert ON public.instructor_notes;
CREATE POLICY instructor_notes_insert
ON public.instructor_notes
FOR INSERT TO authenticated
WITH CHECK (
  instructor_id = (SELECT auth.uid())
  AND public.is_school_member(school_id)
  AND public.is_section_instructor(school_id, section_id)
);

DROP POLICY IF EXISTS instructor_notes_update ON public.instructor_notes;
CREATE POLICY instructor_notes_update
ON public.instructor_notes
FOR UPDATE TO authenticated
USING (instructor_id = (SELECT auth.uid()))
WITH CHECK (
  instructor_id = (SELECT auth.uid())
  AND public.is_school_member(school_id)
  AND public.is_section_instructor(school_id, section_id)
);

DROP POLICY IF EXISTS instructor_notes_delete ON public.instructor_notes;
CREATE POLICY instructor_notes_delete
ON public.instructor_notes
FOR DELETE TO authenticated
USING (instructor_id = (SELECT auth.uid()));

-- profiles
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
CREATE POLICY profiles_insert
ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select
ON public.profiles
FOR SELECT TO authenticated
USING (
  public.is_platform_owner()
  OR id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.school_memberships sm
    WHERE sm.user_id = profiles.id
      AND sm.status = 'active'::public.membership_status
      AND (
        public.can_manage_school(sm.school_id)
        OR public.can_review_instruction(sm.school_id)
      )
  )
);

DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update
ON public.profiles
FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid()))
WITH CHECK (id = (SELECT auth.uid()));

-- analytics_events
DROP POLICY IF EXISTS analytics_events_insert ON public.analytics_events;
CREATE POLICY analytics_events_insert
ON public.analytics_events
FOR INSERT TO authenticated
WITH CHECK (
  actor_user_id = (SELECT auth.uid())
  AND public.is_school_member(school_id)
);

-- Attendance SELECT access is already granted to instructional staff. The
-- management role set (platform owner, school_admin, program_lead) is a strict
-- subset of that staff set, so FOR ALL created duplicate permissive SELECT
-- policies. Replace FOR ALL with write-only policies.

DROP POLICY IF EXISTS attendance_enrollments_manage_school
ON public.attendance_pair_enrollments;
CREATE POLICY attendance_enrollments_insert_manage_school
ON public.attendance_pair_enrollments
FOR INSERT TO authenticated
WITH CHECK (public.can_manage_school(school_id));
CREATE POLICY attendance_enrollments_update_manage_school
ON public.attendance_pair_enrollments
FOR UPDATE TO authenticated
USING (public.can_manage_school(school_id))
WITH CHECK (public.can_manage_school(school_id));
CREATE POLICY attendance_enrollments_delete_manage_school
ON public.attendance_pair_enrollments
FOR DELETE TO authenticated
USING (public.can_manage_school(school_id));

DROP POLICY IF EXISTS attendance_pairs_manage_school
ON public.attendance_pairs;
CREATE POLICY attendance_pairs_insert_manage_school
ON public.attendance_pairs
FOR INSERT TO authenticated
WITH CHECK (public.can_manage_school(school_id));
CREATE POLICY attendance_pairs_update_manage_school
ON public.attendance_pairs
FOR UPDATE TO authenticated
USING (public.can_manage_school(school_id))
WITH CHECK (public.can_manage_school(school_id));
CREATE POLICY attendance_pairs_delete_manage_school
ON public.attendance_pairs
FOR DELETE TO authenticated
USING (public.can_manage_school(school_id));

DROP POLICY IF EXISTS attendance_students_manage_school
ON public.attendance_students;
CREATE POLICY attendance_students_insert_manage_school
ON public.attendance_students
FOR INSERT TO authenticated
WITH CHECK (public.can_manage_school(school_id));
CREATE POLICY attendance_students_update_manage_school
ON public.attendance_students
FOR UPDATE TO authenticated
USING (public.can_manage_school(school_id))
WITH CHECK (public.can_manage_school(school_id));
CREATE POLICY attendance_students_delete_manage_school
ON public.attendance_students
FOR DELETE TO authenticated
USING (public.can_manage_school(school_id));
