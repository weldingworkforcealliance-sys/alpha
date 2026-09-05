-- LTG backend hardening pass, 2026-09-05.
--
-- Goals:
-- 1. Remove accidental anonymous EXECUTE access from public RPCs.
-- 2. Preserve the two intentionally anonymous Connected Classroom student endpoints.
-- 3. Disable verified-unused v1 classroom and old section-level planner entry points
--    without deleting their definitions yet.
-- 4. Retire the empty, superseded proposal/voting subsystem.

revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public;

-- Preserve the authenticated application surface. service_role remains available for
-- administrative migrations/scripts.
grant execute on all functions in schema public to authenticated, service_role;

-- Students join Connected Classroom without LTG accounts.
grant execute on function public.get_classroom_assessment(text) to anon;
grant execute on function public.submit_classroom_assessment_v2(text,text,text,text,jsonb) to anon;

-- Internal helper/trigger functions are not client RPCs.
revoke execute on function public.make_classroom_join_code() from authenticated, anon;
revoke execute on function public.block_protected_content_changes() from authenticated, anon;
revoke execute on function public.block_school_id_change() from authenticated, anon;

-- Stage 1 retirement of v1 Connected Classroom RPCs.
revoke execute on function public.list_assessment_modules() from authenticated, anon;
revoke execute on function public.start_classroom_session(uuid,text) from authenticated, anon;
revoke execute on function public.submit_classroom_assessment(text,text,text,jsonb) from authenticated, anon;

-- Stage 1 retirement of old section-level planner RPCs. Current LTG uses
-- start_current_planner_day / complete_current_planner_day plus owner admin RPCs.
revoke execute on function public.advance_section_planner(uuid) from authenticated, anon;
revoke execute on function public.complete_section_planner(uuid) from authenticated, anon;
revoke execute on function public.hold_section_planner(uuid,text) from authenticated, anon;
revoke execute on function public.resume_section_planner(uuid) from authenticated, anon;
revoke execute on function public.start_section_planner(uuid) from authenticated, anon;
revoke execute on function public.rebuild_section_schedule(uuid) from authenticated, anon;

-- The old proposal/voting subsystem had no live rows and no current frontend callers.
-- Agenda notes + agenda_change_reviews are the active review workflow.
drop table if exists public.proposal_votes;
drop table if exists public.change_proposals;

drop function if exists public.begin_proposal_review(uuid);
drop function if exists public.can_vote_on_proposal(uuid,uuid);
drop function if exists public.decide_change_proposal(uuid,text,text);
drop function if exists public.publish_approved_proposal(uuid);
drop function if exists public.submit_change_proposal(uuid);
drop function if exists public.enforce_proposal_rule_one();
drop function if exists public.flag_formal_review_category();
