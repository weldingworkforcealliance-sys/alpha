-- Emergency rollback of 20260925143000.
-- The public/demo and LTG workflows still depend on the demo-classroom RPC contract.
-- Restore the previous grants while the security hardening is redesigned and regression-tested.

begin;

grant execute on function public.connect_demo_classroom_student(text,text)
  to anon, authenticated;
grant execute on function public.create_demo_classroom_session(text,text,text,integer)
  to anon, authenticated;
grant execute on function public.end_demo_classroom_session(uuid,uuid)
  to anon, authenticated;
grant execute on function public.get_demo_classroom_assessment(text)
  to anon, authenticated;
grant execute on function public.get_demo_classroom_results(uuid,uuid)
  to anon, authenticated;
grant execute on function public.get_demo_classroom_submission_report(uuid,uuid)
  to anon, authenticated;
grant execute on function public.submit_demo_classroom_assessment(text,text,jsonb)
  to anon, authenticated;

commit;
