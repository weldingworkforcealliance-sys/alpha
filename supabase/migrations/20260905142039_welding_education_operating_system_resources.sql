create table if not exists public.resource_sources (
  id uuid primary key default gen_random_uuid(),
  school_id uuid null references public.schools(id) on delete cascade,
  name text not null,
  source_kind text not null,
  website_url text null,
  notes text null,
  system_defined boolean not null default false,
  active boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resource_sources_name_nonblank check (length(btrim(name)) > 0),
  constraint resource_sources_kind_check check (source_kind in (
    'native','standards_body','manufacturer','publisher','school','media','simulator','external','other'
  ))
);

create unique index if not exists resource_sources_scope_name_uq
  on public.resource_sources ((coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid)), (lower(btrim(name))));
create index if not exists resource_sources_school_idx on public.resource_sources(school_id) where school_id is not null;

alter table public.resource_sources enable row level security;
revoke all on table public.resource_sources from anon;
grant select, insert, update, delete on table public.resource_sources to authenticated;

drop policy if exists resource_sources_select on public.resource_sources;
create policy resource_sources_select on public.resource_sources
  for select to authenticated
  using (school_id is null or is_platform_owner() or is_school_member(school_id));

drop policy if exists resource_sources_insert on public.resource_sources;
create policy resource_sources_insert on public.resource_sources
  for insert to authenticated
  with check (
    is_platform_owner()
    or (school_id is not null and can_manage_school(school_id))
  );

drop policy if exists resource_sources_update on public.resource_sources;
create policy resource_sources_update on public.resource_sources
  for update to authenticated
  using (
    is_platform_owner()
    or (school_id is not null and can_manage_school(school_id))
  )
  with check (
    is_platform_owner()
    or (school_id is not null and can_manage_school(school_id))
  );

drop policy if exists resource_sources_delete on public.resource_sources;
create policy resource_sources_delete on public.resource_sources
  for delete to authenticated
  using (
    not system_defined
    and (
      is_platform_owner()
      or (school_id is not null and can_manage_school(school_id))
    )
  );

insert into public.resource_sources (school_id, name, source_kind, website_url, notes, system_defined)
values
  (null, 'LTG Native', 'native', null, 'Content authored or operated directly inside LTG.', true),
  (null, 'AWS', 'standards_body', 'https://www.aws.org/', 'American Welding Society resources and standards references. Access remains subject to AWS licensing and permissions.', true),
  (null, 'Miller', 'manufacturer', 'https://www.millerwelds.com/', 'Miller educational or equipment resources. External ownership is preserved.', true),
  (null, 'Lincoln Electric', 'manufacturer', 'https://www.lincolnelectric.com/', 'Lincoln Electric educational or equipment resources. External ownership is preserved.', true),
  (null, 'Textbook / Publisher', 'publisher', null, 'Book chapters, publisher courseware, and licensed learning resources.', true),
  (null, 'School-Created', 'school', null, 'Resources authored or licensed by the participating school.', true),
  (null, 'Video / Media', 'media', null, 'Authorized video, media, and demonstration links.', true),
  (null, 'Welding Simulator', 'simulator', null, 'Simulator exercises and launch references.', true),
  (null, 'Other External', 'external', null, 'Other external training or reference providers.', true)
on conflict do nothing;

alter table public.course_guide_day_resources
  add column if not exists source_id uuid null references public.resource_sources(id) on delete set null,
  add column if not exists integration_mode text not null default 'native',
  add column if not exists rights_basis text not null default 'school_authorized',
  add column if not exists external_resource_id text null,
  add column if not exists outcome_id uuid null references public.course_outcomes(id) on delete set null,
  add column if not exists student_safe boolean not null default true,
  add column if not exists license_notes text null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.course_guide_day_resources
  drop constraint if exists course_guide_day_resources_integration_mode_check;
alter table public.course_guide_day_resources
  add constraint course_guide_day_resources_integration_mode_check
  check (integration_mode in ('native','url','lti_1_3','scorm','common_cartridge','qti','api','file_reference','simulator_launch'));

alter table public.course_guide_day_resources
  drop constraint if exists course_guide_day_resources_rights_basis_check;
alter table public.course_guide_day_resources
  add constraint course_guide_day_resources_rights_basis_check
  check (rights_basis in ('school_authorized','school_owned','licensed','public','linked_external','permission_required','unknown'));

create index if not exists course_guide_day_resources_source_idx
  on public.course_guide_day_resources(source_id);
create index if not exists course_guide_day_resources_outcome_idx
  on public.course_guide_day_resources(outcome_id);

create or replace function public.validate_course_guide_day_resource_metadata()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  source_school uuid;
  outcome_school uuid;
  outcome_course uuid;
begin
  if new.source_id is not null then
    select rs.school_id into source_school
    from public.resource_sources rs
    where rs.id = new.source_id;

    if not found then
      raise exception 'Resource source does not exist.';
    end if;

    if source_school is not null and source_school <> new.school_id then
      raise exception 'Resource source belongs to a different school.';
    end if;
  end if;

  if new.outcome_id is not null then
    select co.school_id, co.course_id
      into outcome_school, outcome_course
    from public.course_outcomes co
    where co.id = new.outcome_id;

    if not found then
      raise exception 'Linked course outcome does not exist.';
    end if;

    if outcome_school <> new.school_id or outcome_course <> new.course_id then
      raise exception 'Linked outcome must belong to the same school and course as the resource.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists validate_course_guide_day_resource_metadata on public.course_guide_day_resources;
create trigger validate_course_guide_day_resource_metadata
before insert or update on public.course_guide_day_resources
for each row execute function public.validate_course_guide_day_resource_metadata();

update public.course_guide_day_resources r
set source_id = s.id,
    integration_mode = case
      when r.resource_url like '/%' then 'native'
      when r.resource_url is not null then 'url'
      else 'native'
    end,
    rights_basis = case
      when r.resource_type in ('aws_reference','book_reference','video') then 'linked_external'
      when r.resource_url like '/%' or r.resource_url is null then 'school_authorized'
      else 'linked_external'
    end,
    student_safe = case
      when r.resource_type in ('instructor_report','instructor_only','secure_exam') then false
      else true
    end
from public.resource_sources s
where r.source_id is null
  and s.school_id is null
  and s.name = case
    when r.resource_type = 'aws_reference' then 'AWS'
    when r.resource_type = 'book_reference' then 'Textbook / Publisher'
    when r.resource_type = 'video' then 'Video / Media'
    when r.resource_url like '/%' then 'LTG Native'
    else 'Other External'
  end;
