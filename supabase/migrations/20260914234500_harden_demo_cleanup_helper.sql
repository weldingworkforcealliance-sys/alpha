-- The demo cleanup helper is not directly executable by anon/authenticated,
-- but it runs underneath intentional anonymous SECURITY DEFINER RPCs.
-- Keep object resolution deterministic there as well.

begin;

alter function public.cleanup_demo_classroom_sessions()
  set search_path = '';

revoke all on function public.cleanup_demo_classroom_sessions()
  from public, anon, authenticated;

commit;
