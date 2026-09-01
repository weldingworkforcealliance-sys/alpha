-- Advisor-driven hardening for the live classroom migration.

create index if not exists classroom_sessions_school_id_idx on public.classroom_sessions(school_id);
create index if not exists classroom_sessions_section_id_idx on public.classroom_sessions(section_id);
create index if not exists classroom_sessions_instructor_id_idx on public.classroom_sessions(instructor_id);
create index if not exists classroom_sessions_assessment_slug_idx on public.classroom_sessions(assessment_slug);

drop policy if exists assessment_modules_no_direct_access on public.assessment_modules;
create policy assessment_modules_no_direct_access on public.assessment_modules
for all to anon, authenticated using (false) with check (false);

drop policy if exists assessment_questions_no_direct_access on public.assessment_questions;
create policy assessment_questions_no_direct_access on public.assessment_questions
for all to anon, authenticated using (false) with check (false);

drop policy if exists classroom_sessions_instructor_read on public.classroom_sessions;
create policy classroom_sessions_instructor_read on public.classroom_sessions for select to authenticated
using (instructor_id = (select auth.uid()) or (select public.is_platform_owner()));

drop policy if exists classroom_submissions_instructor_read on public.classroom_submissions;
create policy classroom_submissions_instructor_read on public.classroom_submissions for select to authenticated
using (exists(
  select 1
  from public.classroom_sessions s
  where s.id=classroom_session_id
    and (s.instructor_id=(select auth.uid()) or (select public.is_platform_owner()))
));

create or replace function public.make_classroom_join_code()
returns text language plpgsql volatile set search_path=public as $$
declare code text;
begin
  loop
    code := upper(substr(encode(extensions.gen_random_bytes(6),'hex'),1,6));
    exit when not exists(select 1 from public.classroom_sessions where join_code=code);
  end loop;
  return code;
end $$;

revoke execute on function public.make_classroom_join_code() from public, anon, authenticated;
