-- STAGING ONLY. Requires this task's isolated review school; never promote as-is.
do $guard$
begin
  if not exists (select 1 from public.schools where name = 'PVHS 55-day REVIEW 20261027') then
    raise exception 'PVHS review school missing; this migration is staging-only';
  end if;
end;
$guard$;

create function public.guard_pvhs55_review_pending_score()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.status_code = 'pending'
     and (new.score is not null or new.possible_score is not null)
     and exists (
       select 1 from public.gradebooks g
       join public.sections s on s.id = g.section_id
       join public.schools sc on sc.id = s.school_id
       where g.id = new.gradebook_id
         and sc.name = 'PVHS 55-day REVIEW 20261027'
     ) then
    raise exception 'PVHS pending assessments must remain unscored'
      using errcode = '23514';
  end if;
  return new;
end;
$function$;

revoke all on function public.guard_pvhs55_review_pending_score() from public, anon, authenticated;
create trigger pvhs55_review_pending_score
before insert on public.gradebook_revisions
for each row execute function public.guard_pvhs55_review_pending_score();
