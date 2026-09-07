-- Emergency rollback for the Live Job Card schema.
-- Use only before production data must be retained.

delete from public.course_guide_day_resources
where resource_url like '/classroom/job-card%';

revoke execute on function public.review_job_card_submission(uuid,text,text) from authenticated;
revoke execute on function public.submit_live_job_card(text,text,text,jsonb,jsonb,jsonb,jsonb,text,text,text,jsonb,text) from anon,authenticated;
revoke execute on function public.get_live_job_card(text) from anon,authenticated;
revoke execute on function public.end_job_card_session(uuid) from authenticated;
revoke execute on function public.start_job_card_session(uuid,text,jsonb,jsonb,integer,uuid) from authenticated;
revoke execute on function public.expire_job_card_sessions() from authenticated;
revoke execute on function public.list_job_card_templates() from authenticated;

drop function if exists public.review_job_card_submission(uuid,text,text);
drop function if exists public.submit_live_job_card(text,text,text,jsonb,jsonb,jsonb,jsonb,text,text,text,jsonb,text);
drop function if exists public.get_live_job_card(text);
drop function if exists public.end_job_card_session(uuid);
drop function if exists public.start_job_card_session(uuid,text,jsonb,jsonb,integer,uuid);
drop function if exists public.expire_job_card_sessions();
drop function if exists public.list_job_card_templates();
drop function if exists public.make_job_card_join_code();

drop table if exists public.job_card_submissions;
drop table if exists public.job_card_sessions;
drop table if exists public.job_card_templates;
