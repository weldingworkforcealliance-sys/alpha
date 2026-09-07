-- Follow-up hardening/optimization for Level II Live Job Card.
-- Keeps the already-tested access rules while avoiding per-row auth.uid() calls
-- and adding covering indexes for every Job Card foreign key flagged by the
-- Supabase performance advisor.

create index if not exists job_card_sessions_school_id_idx
  on public.job_card_sessions(school_id);

create index if not exists job_card_sessions_template_id_idx
  on public.job_card_sessions(template_id);

create index if not exists job_card_submissions_school_id_idx
  on public.job_card_submissions(school_id);

create index if not exists job_card_submissions_reviewed_by_idx
  on public.job_card_submissions(reviewed_by);

drop policy if exists job_card_templates_select on public.job_card_templates;
create policy job_card_templates_select
on public.job_card_templates
for select
to authenticated
using (
  school_id is null
  or private.job_card_is_platform_owner((select auth.uid()))
  or exists (
    select 1
    from public.school_memberships sm
    where sm.school_id = job_card_templates.school_id
      and sm.user_id = (select auth.uid())
      and sm.status = 'active'::public.membership_status
  )
);

drop policy if exists job_card_sessions_select on public.job_card_sessions;
create policy job_card_sessions_select
on public.job_card_sessions
for select
to authenticated
using (
  instructor_id = (select auth.uid())
  or private.job_card_is_platform_owner((select auth.uid()))
);

drop policy if exists job_card_submissions_select on public.job_card_submissions;
create policy job_card_submissions_select
on public.job_card_submissions
for select
to authenticated
using (
  private.job_card_is_platform_owner((select auth.uid()))
  or exists (
    select 1
    from public.job_card_sessions s
    where s.id = job_card_submissions.job_card_session_id
      and s.instructor_id = (select auth.uid())
  )
);

-- Intentional RPC exposure note:
-- get_job_card_by_code() and submit_job_card() are the anonymous student entry
-- points. They remain SECURITY DEFINER because anon receives no direct table
-- privileges. Both validate an active unexpired join code; submit_job_card()
-- additionally sanitizes student results against instructor-authored requirements,
-- rejects duplicates, and enforces the 17-student ceiling.
