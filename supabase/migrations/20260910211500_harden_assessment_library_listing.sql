-- LTG stabilization: make the authenticated-only assessment library boundary
-- explicit inside the SECURITY DEFINER function as defense in depth.

begin;

create or replace function public.list_assessment_modules_v2()
returns table(
  slug text,
  title text,
  description text,
  category text,
  estimated_minutes integer,
  question_count bigint,
  instructions text,
  allow_team_members boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    m.slug,
    m.title,
    m.description,
    m.category,
    m.estimated_minutes,
    count(q.id),
    m.instructions,
    m.allow_team_members
  from public.assessment_modules m
  left join public.assessment_questions q
    on q.assessment_slug = m.slug
  where m.active
  group by
    m.slug,
    m.title,
    m.description,
    m.category,
    m.estimated_minutes,
    m.sort_order,
    m.instructions,
    m.allow_team_members
  order by m.sort_order, m.title;
end;
$$;

revoke all on function public.list_assessment_modules_v2()
  from public, anon, authenticated;
grant execute on function public.list_assessment_modules_v2()
  to authenticated;

commit;
