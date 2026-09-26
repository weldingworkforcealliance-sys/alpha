-- Emergency rollback for the additive schema repair; do not use after report-trigger customization.
-- Restores the original staging schema gap and therefore breaks finalization again.
begin;
do $guard$ begin
if exists(select 1 from public.attendance_pairs where report_trigger <> 'finalization') then
raise exception 'Report settings changed; review rollback'; end if;
end $guard$;
alter table public.attendance_pairs drop column report_trigger;
commit;

