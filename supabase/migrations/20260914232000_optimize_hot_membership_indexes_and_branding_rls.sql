-- Target the authorization lookups LTG executes frequently instead of blindly
-- indexing every foreign key reported by the database advisor.

begin;

create index if not exists school_memberships_user_status_idx
  on public.school_memberships(user_id, status, school_id);

create index if not exists section_instructors_instructor_active_idx
  on public.section_instructors(instructor_id, active, section_id);

-- Avoid re-evaluating auth.uid() and the owner check for every candidate row.
drop policy if exists branding_profiles_select_member on public.branding_profiles;
create policy branding_profiles_select_member
on public.branding_profiles
for select
to authenticated
using (
  (select public.is_platform_owner())
  or exists (
    select 1
    from public.school_memberships sm
    where sm.user_id = (select auth.uid())
      and sm.school_id = branding_profiles.school_id
      and sm.status = 'active'
  )
);

commit;
