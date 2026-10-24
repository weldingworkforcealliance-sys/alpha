-- Fail closed for kiosk employees without a linked profile. Preserve existing grants.
begin;

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
  if (v_employee.profile_id = v_uid or private.timeclock_is_manager(v_employee.school_id)) is not true then
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

commit;
