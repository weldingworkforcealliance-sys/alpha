-- Every canonical SMAW position is graded separately with the two approved
-- electrode groups: 6010/11 and 7018. Existing assignment IDs become the
-- 6010/11 records so saved evidence and gradebook links remain intact.
begin;

update public.tower_assignments as assignment
set definition = assignment.definition || jsonb_build_object(
  'name', format(
    'SMAW 6010/11 %s %s %s%s',
    coalesce(assignment.definition->>'material', 'Carbon Steel'),
    assignment.definition->>'position',
    assignment.definition->>'family',
    case
      when assignment.definition->>'family' = 'Groove'
        then ' — ' || coalesce(assignment.definition->>'backing', 'Backing')
      else ' Weld'
    end
  ),
  'electrode', 'E6010/E6011 · 1/8 in.',
  'electrodeCode', '6010/11',
  'electrodeSize', '1/8 in.',
  'rodGroup', '6010/11'
)
where assignment.id ~ '^smaw-(fillet-[1-4]F|groove-(backing|no-backing)-[1-4]G)$'
  and assignment.definition->>'processId' = 'smaw'
  and assignment.definition->>'rubricType' = 'weld'
  and assignment.definition->>'type' = 'position';

insert into public.tower_assignments(id, definition)
select
  assignment.id || '-e7018',
  assignment.definition || jsonb_build_object(
    'id', assignment.id || '-e7018',
    'name', format(
      'SMAW 7018 %s %s %s%s',
      coalesce(assignment.definition->>'material', 'Carbon Steel'),
      assignment.definition->>'position',
      assignment.definition->>'family',
      case
        when assignment.definition->>'family' = 'Groove'
          then ' — ' || coalesce(assignment.definition->>'backing', 'Backing')
        else ' Weld'
      end
    ),
    'electrode', 'E7018 · 1/8 in.',
    'electrodeCode', '7018',
    'electrodeSize', '1/8 in.',
    'rodGroup', '7018'
  )
from public.tower_assignments as assignment
where assignment.id ~ '^smaw-(fillet-[1-4]F|groove-(backing|no-backing)-[1-4]G)$'
  and assignment.definition->>'processId' = 'smaw'
  and assignment.definition->>'rubricType' = 'weld'
  and assignment.definition->>'type' = 'position'
on conflict (id) do update
set definition = excluded.definition;

-- Keep any already-created course-grade items aligned with the clarified rod.
update public.gradebook_items as item
set title = assignment.definition->>'name'
from public.tower_assignments as assignment
where item.assessment_slug = 'tower:' || assignment.id
  and assignment.id ~ '^smaw-(fillet-[1-4]F|groove-(backing|no-backing)-[1-4]G)(-e7018)?$';

do $$
declare
  assignment_count integer;
begin
  select count(*)
    into assignment_count
  from public.tower_assignments as assignment
  where assignment.id ~ '^smaw-(fillet-[1-4]F|groove-(backing|no-backing)-[1-4]G)(-e7018)?$'
    and assignment.definition->>'processId' = 'smaw'
    and assignment.definition->>'rubricType' = 'weld'
    and assignment.definition->>'type' = 'position';

  if assignment_count <> 24 then
    raise exception 'Expected 24 canonical SMAW rod-position assignments, found %', assignment_count;
  end if;
end;
$$;

commit;
