-- Grade every canonical SMAW position separately with the two approved rod
-- groups. Existing SMAW assignment IDs remain the 6010/11 records so any
-- saved evidence and gradebook links keep their identity. The display
-- position includes the rod group so the currently deployed Tower lists both
-- rods without requiring a frontend release.
begin;

update public.tower_assignments as assignment
set definition = assignment.definition || jsonb_build_object(
  'name', format(
    'SMAW 6010/11 %s %s %s%s',
    coalesce(assignment.definition->>'material', 'Carbon Steel'),
    coalesce(
      assignment.definition->>'weldPosition',
      regexp_replace(assignment.definition->>'position', '\s+·\s+(6010/11|7018)$', '')
    ),
    assignment.definition->>'family',
    case
      when assignment.definition->>'family' = 'Groove'
        then ' — ' || coalesce(assignment.definition->>'backing', 'Backing')
      else ' Weld'
    end
  ),
  'weldPosition', coalesce(
    assignment.definition->>'weldPosition',
    regexp_replace(assignment.definition->>'position', '\s+·\s+(6010/11|7018)$', '')
  ),
  'position', coalesce(
    assignment.definition->>'weldPosition',
    regexp_replace(assignment.definition->>'position', '\s+·\s+(6010/11|7018)$', '')
  ) || ' · 6010/11',
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
      assignment.definition->>'weldPosition',
      assignment.definition->>'family',
      case
        when assignment.definition->>'family' = 'Groove'
          then ' — ' || coalesce(assignment.definition->>'backing', 'Backing')
        else ' Weld'
      end
    ),
    'weldPosition', assignment.definition->>'weldPosition',
    'position', (assignment.definition->>'weldPosition') || ' · 7018',
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

-- Keep any existing academic gradebook item aligned with the clarified rod.
update public.gradebook_items as item
set title = assignment.definition->>'name'
from public.tower_assignments as assignment
where item.assessment_slug = 'tower:' || assignment.id
  and assignment.id ~ '^smaw-(fillet-[1-4]F|groove-(backing|no-backing)-[1-4]G)(-e7018)?$';

do $$
declare
  assignment_count integer;
  position_count integer;
  incomplete_positions integer;
begin
  select count(*)
    into assignment_count
  from public.tower_assignments as assignment
  where assignment.id ~ '^smaw-(fillet-[1-4]F|groove-(backing|no-backing)-[1-4]G)(-e7018)?$'
    and assignment.definition->>'processId' = 'smaw'
    and assignment.definition->>'rubricType' = 'weld'
    and assignment.definition->>'type' = 'position';

  select count(*), count(*) filter (where rod_count <> 2)
    into position_count, incomplete_positions
  from (
    select
      assignment.definition->>'family' as family,
      assignment.definition->>'backing' as backing,
      assignment.definition->>'weldPosition' as weld_position,
      count(distinct assignment.definition->>'electrodeCode') as rod_count
    from public.tower_assignments as assignment
    where assignment.id ~ '^smaw-(fillet-[1-4]F|groove-(backing|no-backing)-[1-4]G)(-e7018)?$'
      and assignment.definition->>'processId' = 'smaw'
      and assignment.definition->>'rubricType' = 'weld'
      and assignment.definition->>'type' = 'position'
    group by
      assignment.definition->>'family',
      assignment.definition->>'backing',
      assignment.definition->>'weldPosition'
  ) as grouped_positions;

  if assignment_count <> 24 or position_count <> 12 or incomplete_positions <> 0 then
    raise exception
      'Expected 12 SMAW positions with two rods each; found % assignments, % positions, % incomplete positions',
      assignment_count, position_count, incomplete_positions;
  end if;
end;
$$;

commit;
