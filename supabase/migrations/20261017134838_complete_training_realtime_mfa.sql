begin;
set local lock_timeout = '5s';

-- Match production's training publication on staging and enforce the same
-- current-enrollment rule on every staff-readable Realtime table. Existing
-- tenant/member/manager policies remain authoritative alongside this gate.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'training_activity', 'training_day_delivery', 'training_notes',
    'training_report_outbox', 'training_section_state',
    'training_session_members', 'training_sessions'
  ] loop
    execute format('create policy %I on public.%I as restrictive for select to authenticated using ((select private.meets_enrolled_mfa()))',
      table_name || '_enrolled_mfa', table_name);
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
