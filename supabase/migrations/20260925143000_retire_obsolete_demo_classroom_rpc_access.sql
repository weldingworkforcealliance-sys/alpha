-- Retire obsolete public demo-classroom RPC execution.
-- The current /demo experience is synthetic/static and does not call these functions.
-- Production Connected Classroom and Job Card student entry points remain unchanged.

begin;

revoke all on function public.connect_demo_classroom_student(text,text)
  from anon, authenticated;
revoke all on function public.create_demo_classroom_session(text,text,text,integer)
  from anon, authenticated;
revoke all on function public.end_demo_classroom_session(uuid,uuid)
  from anon, authenticated;
revoke all on function public.get_demo_classroom_assessment(text)
  from anon, authenticated;
revoke all on function public.get_demo_classroom_results(uuid,uuid)
  from anon, authenticated;
revoke all on function public.get_demo_classroom_submission_report(uuid,uuid)
  from anon, authenticated;
revoke all on function public.submit_demo_classroom_assessment(text,text,jsonb)
  from anon, authenticated;

commit;
