-- LTG Employee Time Clock
-- Server-timestamped employee attendance, kiosk PIN support, RLS, and audit history.

create schema if not exists private;

create table public.timeclock_employees (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  profile_id uuid null references public.profiles(id) on delete set null,
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  employee_code text null,
  active boolean not null default true,
  clocking_enabled boolean not null default true,
  pin_configured boolean not null default false,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index timeclock_employees_school_profile_uidx
  on public.timeclock_employees(school_id, profile_id)
  where profile_id is not null;

create unique index timeclock_employees_school_code_uidx
  on public.timeclock_employees(school_id, lower(employee_code))
  where employee_code is not null and btrim(employee_code) <> '';

create index timeclock_employees_school_active_idx
  on public.timeclock_employees(school_id, active, display_name);

create table private.timeclock_employee_credentials (
  employee_id uuid primary key references public.timeclock_employees(id) on delete cascade,
  pin_hash text null,
  pin_updated_at timestamptz null,
  set_by uuid null references public.profiles(id) on delete set null
);

create table public.timeclock_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  employee_id uuid not null references public.timeclock_employees(id) on delete restrict,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz null,
  clock_in_method text not null check (clock_in_method in ('self','kiosk_pin','manager')),
  clock_out_method text null check (clock_out_method is null or clock_out_method in ('self','kiosk_pin','manager')),
  clock_in_actor uuid null references public.profiles(id) on delete set null,
  clock_out_actor uuid null references public.profiles(id) on delete set null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timeclock_entries_valid_interval check (clock_out_at is null or clock_out_at > clock_in_at)
);

create unique index timeclock_one_open_entry_per_employee_uidx
  on public.timeclock_entries(employee_id)
  where clock_out_at is null;

create index timeclock_entries_school_clockin_idx
  on public.timeclock_entries(school_id, clock_in_at desc);

create index timeclock_entries_employee_clockin_idx
  on public.timeclock_entries(employee_id, clock_in_at desc);

create table public.timeclock_adjustments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  entry_id uuid not null references public.timeclock_entries(id) on delete restrict,
  employee_id uuid not null references public.timeclock_employees(id) on delete restrict,
  adjusted_by uuid not null references public.profiles(id) on delete restrict,
  old_clock_in_at timestamptz not null,
  new_clock_in_at timestamptz not null,
  old_clock_out_at timestamptz null,
  new_clock_out_at timestamptz null,
  reason text not null check (char_length(trim(reason)) >= 3),
  created_at timestamptz not null default now()
);

create index timeclock_adjustments_entry_idx on public.timeclock_adjustments(entry_id, created_at desc);
create index timeclock_adjustments_school_idx on public.timeclock_adjustments(school_id, created_at desc);

create or replace function private.timeclock_is_manager(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1 from public.platform_owners po
      where po.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.school_memberships sm
      where sm.school_id = p_school_id
        and sm.user_id = (select auth.uid())
        and sm.status = 'active'
        and sm.role in (
          'school_admin'::public.app_school_role,
          'program_lead'::public.app_school_role,
          'lead_instructor'::public.app_school_role
        )
    )
  );
$$;

create or replace function private.timeclock_can_view_school(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1 from public.platform_owners po
      where po.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.school_memberships sm
      where sm.school_id = p_school_id
        and sm.user_id = (select auth.uid())
        and sm.status = 'active'
        and sm.role in (
          'school_admin'::public.app_school_role,
          'program_lead'::public.app_school_role,
          'lead_instructor'::public.app_school_role,
          'viewer'::public.app_school_role
        )
    )
  );
$$;

create or replace function private.timeclock_is_school_member(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1 from public.platform_owners po
      where po.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.school_memberships sm
      where sm.school_id = p_school_id
        and sm.user_id = (select auth.uid())
        and sm.status = 'active'
    )
  );
$$;

create or replace function private.timeclock_is_employee(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.timeclock_employees e
    where e.id = p_employee_id
      and e.profile_id = (select auth.uid())
      and e.active
  );
$$;

create or replace function private.timeclock_verify_pin(p_employee_id uuid, p_pin text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hash text;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4,8}$' then
    return false;
  end if;

  select c.pin_hash into v_hash
  from private.timeclock_employee_credentials c
  where c.employee_id = p_employee_id;

  if v_hash is null then
    return false;
  end if;

  return extensions.crypt(p_pin, v_hash) = v_hash;
end;
$$;

create or replace function private.timeclock_create_employee_impl(
  p_school_id uuid,
  p_display_name text,
  p_profile_id uuid default null,
  p_employee_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not private.timeclock_is_manager(p_school_id) then
    raise exception 'You do not have permission to manage this time clock';
  end if;
  if p_display_name is null or char_length(btrim(p_display_name)) = 0 then
    raise exception 'Employee name is required';
  end if;
  if p_profile_id is not null and not exists (
    select 1 from public.school_memberships sm
    where sm.school_id = p_school_id
      and sm.user_id = p_profile_id
      and sm.status = 'active'
  ) then
    raise exception 'Linked LTG account is not an active member of this school';
  end if;

  insert into public.timeclock_employees(school_id, profile_id, display_name, employee_code, created_by)
  values (p_school_id, p_profile_id, btrim(p_display_name), nullif(btrim(p_employee_code), ''), v_uid)
  returning id into v_id;

  insert into public.audit_log(school_id, user_id, action, entity_type, entity_id, details)
  values (
    p_school_id, v_uid, 'timeclock_employee_created', 'timeclock_employee', v_id,
    jsonb_build_object('display_name', btrim(p_display_name), 'profile_id', p_profile_id)
  );
  return v_id;
end;
$$;

create or replace function private.timeclock_set_pin_impl(p_employee_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee public.timeclock_employees%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_employee from public.timeclock_employees where id = p_employee_id;
  if not found then raise exception 'Employee not found'; end if;
  if not (v_employee.profile_id = v_uid or private.timeclock_is_manager(v_employee.school_id)) then
    raise exception 'You do not have permission to set this PIN';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'PIN must contain 4 to 8 digits';
  end if;

  insert into private.timeclock_employee_credentials(employee_id, pin_hash, pin_updated_at, set_by)
  values (p_employee_id, extensions.crypt(p_pin, extensions.gen_salt('bf')), clock_timestamp(), v_uid)
  on conflict (employee_id) do update
    set pin_hash = excluded.pin_hash,
        pin_updated_at = excluded.pin_updated_at,
        set_by = excluded.set_by;

  update public.timeclock_employees
  set pin_configured = true, updated_at = clock_timestamp()
  where id = p_employee_id;

  insert into public.audit_log(school_id, user_id, action, entity_type, entity_id, details)
  values (
    v_employee.school_id, v_uid, 'timeclock_pin_updated', 'timeclock_employee', p_employee_id,
    jsonb_build_object('pin_configured', true)
  );
  return true;
end;
$$;

create or replace function private.timeclock_clock_in_impl(p_employee_id uuid, p_pin text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee public.timeclock_employees%rowtype;
  v_uid uuid := auth.uid();
  v_method text;
  v_entry_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_employee
  from public.timeclock_employees
  where id = p_employee_id and active and clocking_enabled;
  if not found then raise exception 'Employee is not active for clocking'; end if;

  if v_employee.profile_id = v_uid then
    v_method := 'self';
  else
    if not private.timeclock_is_manager(v_employee.school_id) then
      raise exception 'You may only clock yourself in';
    end if;
    if not private.timeclock_verify_pin(p_employee_id, p_pin) then
      raise exception 'A valid employee PIN is required';
    end if;
    v_method := 'kiosk_pin';
  end if;

  if exists (
    select 1 from public.timeclock_entries e
    where e.employee_id = p_employee_id and e.clock_out_at is null
  ) then
    raise exception 'Employee is already clocked in';
  end if;

  insert into public.timeclock_entries(school_id, employee_id, clock_in_at, clock_in_method, clock_in_actor)
  values (v_employee.school_id, p_employee_id, clock_timestamp(), v_method, v_uid)
  returning id into v_entry_id;

  insert into public.audit_log(school_id, user_id, action, entity_type, entity_id, details)
  values (
    v_employee.school_id, v_uid, 'timeclock_clock_in', 'timeclock_entry', v_entry_id,
    jsonb_build_object('employee_id', p_employee_id, 'method', v_method)
  );
  return v_entry_id;
end;
$$;

create or replace function private.timeclock_clock_out_impl(p_employee_id uuid, p_pin text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee public.timeclock_employees%rowtype;
  v_uid uuid := auth.uid();
  v_method text;
  v_entry public.timeclock_entries%rowtype;
  v_out timestamptz := clock_timestamp();
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_employee
  from public.timeclock_employees
  where id = p_employee_id and active and clocking_enabled;
  if not found then raise exception 'Employee is not active for clocking'; end if;

  if v_employee.profile_id = v_uid then
    v_method := 'self';
  else
    if not private.timeclock_is_manager(v_employee.school_id) then
      raise exception 'You may only clock yourself out';
    end if;
    if not private.timeclock_verify_pin(p_employee_id, p_pin) then
      raise exception 'A valid employee PIN is required';
    end if;
    v_method := 'kiosk_pin';
  end if;

  select * into v_entry
  from public.timeclock_entries
  where employee_id = p_employee_id and clock_out_at is null
  for update;
  if not found then raise exception 'Employee is not currently clocked in'; end if;

  update public.timeclock_entries
  set clock_out_at = v_out,
      clock_out_method = v_method,
      clock_out_actor = v_uid,
      updated_at = v_out
  where id = v_entry.id;

  insert into public.audit_log(school_id, user_id, action, entity_type, entity_id, details)
  values (
    v_employee.school_id, v_uid, 'timeclock_clock_out', 'timeclock_entry', v_entry.id,
    jsonb_build_object('employee_id', p_employee_id, 'method', v_method, 'clock_out_at', v_out)
  );
  return v_entry.id;
end;
$$;

create or replace function private.timeclock_add_manual_entry_impl(
  p_employee_id uuid,
  p_clock_in_at timestamptz,
  p_clock_out_at timestamptz,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee public.timeclock_employees%rowtype;
  v_uid uuid := auth.uid();
  v_entry_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_employee from public.timeclock_employees where id = p_employee_id;
  if not found then raise exception 'Employee not found'; end if;
  if not private.timeclock_is_manager(v_employee.school_id) then raise exception 'Manager permission required'; end if;
  if p_clock_in_at is null or p_clock_out_at is null or p_clock_out_at <= p_clock_in_at then
    raise exception 'A valid completed time interval is required';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then raise exception 'A correction reason is required'; end if;

  if exists (
    select 1 from public.timeclock_entries e
    where e.employee_id = p_employee_id
      and tstzrange(e.clock_in_at, coalesce(e.clock_out_at, 'infinity'::timestamptz), '[)')
          && tstzrange(p_clock_in_at, p_clock_out_at, '[)')
  ) then
    raise exception 'Manual entry overlaps an existing shift';
  end if;

  insert into public.timeclock_entries(
    school_id, employee_id, clock_in_at, clock_out_at,
    clock_in_method, clock_out_method, clock_in_actor, clock_out_actor, notes
  ) values (
    v_employee.school_id, p_employee_id, p_clock_in_at, p_clock_out_at,
    'manager', 'manager', v_uid, v_uid, btrim(p_reason)
  ) returning id into v_entry_id;

  insert into public.audit_log(school_id, user_id, action, entity_type, entity_id, details)
  values (
    v_employee.school_id, v_uid, 'timeclock_manual_entry', 'timeclock_entry', v_entry_id,
    jsonb_build_object('employee_id', p_employee_id, 'reason', btrim(p_reason), 'clock_in_at', p_clock_in_at, 'clock_out_at', p_clock_out_at)
  );
  return v_entry_id;
end;
$$;

create or replace function private.timeclock_adjust_entry_impl(
  p_entry_id uuid,
  p_new_clock_in_at timestamptz,
  p_new_clock_out_at timestamptz,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.timeclock_entries%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_entry from public.timeclock_entries where id = p_entry_id for update;
  if not found then raise exception 'Time entry not found'; end if;
  if not private.timeclock_is_manager(v_entry.school_id) then raise exception 'Manager permission required'; end if;
  if p_new_clock_in_at is null then raise exception 'Clock-in time is required'; end if;
  if p_new_clock_out_at is not null and p_new_clock_out_at <= p_new_clock_in_at then
    raise exception 'Clock-out must be later than clock-in';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then raise exception 'A correction reason is required'; end if;

  if exists (
    select 1 from public.timeclock_entries e
    where e.employee_id = v_entry.employee_id
      and e.id <> p_entry_id
      and tstzrange(e.clock_in_at, coalesce(e.clock_out_at, 'infinity'::timestamptz), '[)')
          && tstzrange(p_new_clock_in_at, coalesce(p_new_clock_out_at, 'infinity'::timestamptz), '[)')
  ) then
    raise exception 'Adjusted entry overlaps another shift';
  end if;

  insert into public.timeclock_adjustments(
    school_id, entry_id, employee_id, adjusted_by,
    old_clock_in_at, new_clock_in_at, old_clock_out_at, new_clock_out_at, reason
  ) values (
    v_entry.school_id, v_entry.id, v_entry.employee_id, v_uid,
    v_entry.clock_in_at, p_new_clock_in_at, v_entry.clock_out_at, p_new_clock_out_at, btrim(p_reason)
  );

  update public.timeclock_entries
  set clock_in_at = p_new_clock_in_at,
      clock_out_at = p_new_clock_out_at,
      clock_in_method = 'manager',
      clock_out_method = case when p_new_clock_out_at is null then null else 'manager' end,
      clock_in_actor = v_uid,
      clock_out_actor = case when p_new_clock_out_at is null then null else v_uid end,
      updated_at = clock_timestamp()
  where id = p_entry_id;

  insert into public.audit_log(school_id, user_id, action, entity_type, entity_id, details)
  values (
    v_entry.school_id, v_uid, 'timeclock_entry_adjusted', 'timeclock_entry', p_entry_id,
    jsonb_build_object(
      'employee_id', v_entry.employee_id,
      'reason', btrim(p_reason),
      'old_clock_in_at', v_entry.clock_in_at,
      'new_clock_in_at', p_new_clock_in_at,
      'old_clock_out_at', v_entry.clock_out_at,
      'new_clock_out_at', p_new_clock_out_at
    )
  );
  return p_entry_id;
end;
$$;

create or replace function public.timeclock_create_employee(
  p_school_id uuid,
  p_display_name text,
  p_profile_id uuid default null,
  p_employee_code text default null
)
returns uuid language sql security invoker set search_path = ''
as $$ select private.timeclock_create_employee_impl(p_school_id, p_display_name, p_profile_id, p_employee_code); $$;

create or replace function public.timeclock_set_pin(p_employee_id uuid, p_pin text)
returns boolean language sql security invoker set search_path = ''
as $$ select private.timeclock_set_pin_impl(p_employee_id, p_pin); $$;

create or replace function public.timeclock_clock_in(p_employee_id uuid, p_pin text default null)
returns uuid language sql security invoker set search_path = ''
as $$ select private.timeclock_clock_in_impl(p_employee_id, p_pin); $$;

create or replace function public.timeclock_clock_out(p_employee_id uuid, p_pin text default null)
returns uuid language sql security invoker set search_path = ''
as $$ select private.timeclock_clock_out_impl(p_employee_id, p_pin); $$;

create or replace function public.timeclock_add_manual_entry(
  p_employee_id uuid,
  p_clock_in_at timestamptz,
  p_clock_out_at timestamptz,
  p_reason text
)
returns uuid language sql security invoker set search_path = ''
as $$ select private.timeclock_add_manual_entry_impl(p_employee_id, p_clock_in_at, p_clock_out_at, p_reason); $$;

create or replace function public.timeclock_adjust_entry(
  p_entry_id uuid,
  p_new_clock_in_at timestamptz,
  p_new_clock_out_at timestamptz,
  p_reason text
)
returns uuid language sql security invoker set search_path = ''
as $$ select private.timeclock_adjust_entry_impl(p_entry_id, p_new_clock_in_at, p_new_clock_out_at, p_reason); $$;

alter table public.timeclock_employees enable row level security;
alter table public.timeclock_entries enable row level security;
alter table public.timeclock_adjustments enable row level security;

revoke all on table public.timeclock_employees from anon, authenticated;
revoke all on table public.timeclock_entries from anon, authenticated;
revoke all on table public.timeclock_adjustments from anon, authenticated;
grant select on table public.timeclock_employees to authenticated;
grant select on table public.timeclock_entries to authenticated;
grant select on table public.timeclock_adjustments to authenticated;

create policy timeclock_employees_select
on public.timeclock_employees for select
to authenticated
using (private.timeclock_is_school_member(school_id));

create policy timeclock_entries_select
on public.timeclock_entries for select
to authenticated
using (private.timeclock_can_view_school(school_id) or private.timeclock_is_employee(employee_id));

create policy timeclock_adjustments_select
on public.timeclock_adjustments for select
to authenticated
using (private.timeclock_can_view_school(school_id) or private.timeclock_is_employee(employee_id));

revoke execute on function private.timeclock_is_manager(uuid) from public, anon;
revoke execute on function private.timeclock_can_view_school(uuid) from public, anon;
revoke execute on function private.timeclock_is_school_member(uuid) from public, anon;
revoke execute on function private.timeclock_is_employee(uuid) from public, anon;
revoke execute on function private.timeclock_verify_pin(uuid, text) from public, anon;
revoke execute on function private.timeclock_create_employee_impl(uuid, text, uuid, text) from public, anon;
revoke execute on function private.timeclock_set_pin_impl(uuid, text) from public, anon;
revoke execute on function private.timeclock_clock_in_impl(uuid, text) from public, anon;
revoke execute on function private.timeclock_clock_out_impl(uuid, text) from public, anon;
revoke execute on function private.timeclock_add_manual_entry_impl(uuid, timestamptz, timestamptz, text) from public, anon;
revoke execute on function private.timeclock_adjust_entry_impl(uuid, timestamptz, timestamptz, text) from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.timeclock_is_manager(uuid) to authenticated;
grant execute on function private.timeclock_can_view_school(uuid) to authenticated;
grant execute on function private.timeclock_is_school_member(uuid) to authenticated;
grant execute on function private.timeclock_is_employee(uuid) to authenticated;
grant execute on function private.timeclock_verify_pin(uuid, text) to authenticated;
grant execute on function private.timeclock_create_employee_impl(uuid, text, uuid, text) to authenticated;
grant execute on function private.timeclock_set_pin_impl(uuid, text) to authenticated;
grant execute on function private.timeclock_clock_in_impl(uuid, text) to authenticated;
grant execute on function private.timeclock_clock_out_impl(uuid, text) to authenticated;
grant execute on function private.timeclock_add_manual_entry_impl(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function private.timeclock_adjust_entry_impl(uuid, timestamptz, timestamptz, text) to authenticated;

revoke execute on function public.timeclock_create_employee(uuid, text, uuid, text) from public, anon;
revoke execute on function public.timeclock_set_pin(uuid, text) from public, anon;
revoke execute on function public.timeclock_clock_in(uuid, text) from public, anon;
revoke execute on function public.timeclock_clock_out(uuid, text) from public, anon;
revoke execute on function public.timeclock_add_manual_entry(uuid, timestamptz, timestamptz, text) from public, anon;
revoke execute on function public.timeclock_adjust_entry(uuid, timestamptz, timestamptz, text) from public, anon;

grant execute on function public.timeclock_create_employee(uuid, text, uuid, text) to authenticated;
grant execute on function public.timeclock_set_pin(uuid, text) to authenticated;
grant execute on function public.timeclock_clock_in(uuid, text) to authenticated;
grant execute on function public.timeclock_clock_out(uuid, text) to authenticated;
grant execute on function public.timeclock_add_manual_entry(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.timeclock_adjust_entry(uuid, timestamptz, timestamptz, text) to authenticated;
