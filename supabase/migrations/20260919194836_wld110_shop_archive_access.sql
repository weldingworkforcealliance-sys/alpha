-- Extend the existing read-only archive role without exposing personal links.
do $$ begin
 if exists(select 1 from pg_roles where rolname='ltg_archive_reader') then
  grant select on public.wld110_shop_progress,public.wld110_shop_attempts,
   public.wld110_shop_completions to ltg_archive_reader;
 end if;
end $$;
