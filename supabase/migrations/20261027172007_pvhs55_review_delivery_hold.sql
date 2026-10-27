-- Staging review only: do not promote as a production migration.
do $guard$
begin
  if not exists(select 1 from public.schools where name='PVHS 55-day REVIEW 20261027') then
    raise exception 'PVHS review school missing; staging-only migration';
  end if;
end;
$guard$;

create function public.guard_pvhs55_review_delivery_hold()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  if new.delivery_status in ('started','in_progress','completed') and exists (
    select 1 from public.sections s
    join public.schools sc on sc.id=s.school_id
    where s.id=new.section_id and sc.name='PVHS 55-day REVIEW 20261027'
  ) and not exists (
    select 1 from public.sections s
    join public.section_progress sp on sp.section_id=s.id
    join public.planner_days pd on pd.section_id=s.id and pd.id=new.planner_day_id
    where s.id=new.section_id and s.school_id=new.school_id
      and s.status='active' and not sp.manual_hold
      and pd.scheduled_date is not null
  ) then
    raise exception 'PVHS review is held: approved calendar and section activation are required before instruction'
      using errcode='23514';
  end if;
  return new;
end;
$function$;

revoke all on function public.guard_pvhs55_review_delivery_hold() from public,anon,authenticated;
create trigger pvhs55_review_delivery_hold
before insert or update on public.planner_day_delivery
for each row execute function public.guard_pvhs55_review_delivery_hold();
