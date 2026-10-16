-- Restore the existing Live Job Card subscription after database cloning.
-- SELECT grants and row-level policies remain unchanged.
do $migration$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'job_card_submissions'
     ) then
    alter publication supabase_realtime add table public.job_card_submissions;
  end if;
end;
$migration$;
