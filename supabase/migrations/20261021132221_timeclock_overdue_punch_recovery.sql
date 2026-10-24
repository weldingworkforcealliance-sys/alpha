alter table public.timeclock_entries add column if not exists requires_correction boolean not null default false;
drop index if exists public.timeclock_one_open_entry_per_employee_uidx;
create unique index timeclock_one_open_entry_per_employee_uidx on public.timeclock_entries(employee_id) where clock_out_at is null and requires_correction = false;
create or replace function private.timeclock_clock_in_impl(p_employee_id uuid, p_pin text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
 v_employee public.timeclock_employees%rowtype;
 v_uid uuid := auth.uid();
 v_method text;
 v_entry_id uuid;
 v_now timestamptz := clock_timestamp();
 v_stale uuid;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 select * into v_employee from public.timeclock_employees where id=p_employee_id and active and clocking_enabled for update;
 if not found then raise exception 'Employee is not active for clocking'; end if;
 if v_employee.profile_id = v_uid then v_method := 'self';
 else
  if not private.timeclock_is_manager(v_employee.school_id) then raise exception 'You may only clock yourself in'; end if;
  if not private.timeclock_verify_pin(p_employee_id,p_pin) then raise exception 'A valid employee PIN is required'; end if;
  v_method := 'kiosk_pin';
 end if;
 select id into v_stale from public.timeclock_entries
 where employee_id=p_employee_id and clock_out_at is null and not requires_correction and clock_in_at < (v_now at time zone 'America/New_York')::date::timestamp at time zone 'America/New_York'
 for update;
 if v_stale is not null then
  update public.timeclock_entries set requires_correction=true, updated_at=v_now,
   notes=concat_ws(E'\n',nullif(notes,''),'Unresolved prior-day clock-out; manager correction required')
  where id=v_stale;
  insert into public.audit_log(school_id,user_id,action,entity_type,entity_id,details)
  values(v_employee.school_id,v_uid,'timeclock_overdue_flagged','timeclock_entry',v_stale,jsonb_build_object('employee_id',p_employee_id,'requires_correction',true));
 end if;
 if exists(select 1 from public.timeclock_entries where employee_id=p_employee_id and clock_out_at is null and not requires_correction) then
  raise exception 'Employee is already clocked in today';
 end if;
 insert into public.timeclock_entries(school_id,employee_id,clock_in_at,clock_in_method,clock_in_actor)
 values(v_employee.school_id,p_employee_id,v_now,v_method,v_uid) returning id into v_entry_id;
 insert into public.audit_log(school_id,user_id,action,entity_type,entity_id,details)
 values(v_employee.school_id,v_uid,'timeclock_clock_in','timeclock_entry',v_entry_id,jsonb_build_object('employee_id',p_employee_id,'method',v_method,'prior_shift_flagged',v_stale is not null));
 return v_entry_id;
end; $$;
create or replace function private.timeclock_clock_out_impl(p_employee_id uuid,p_pin text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
 v_employee public.timeclock_employees%rowtype;
 v_uid uuid := auth.uid();
 v_method text;
 v_entry public.timeclock_entries%rowtype;
 v_out timestamptz := clock_timestamp();
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 select * into v_employee from public.timeclock_employees where id=p_employee_id and active and clocking_enabled;
 if not found then raise exception 'Employee is not active for clocking'; end if;
 if v_employee.profile_id=v_uid then v_method:='self';
 else
  if not private.timeclock_is_manager(v_employee.school_id) then raise exception 'You may only clock yourself out'; end if;
  if not private.timeclock_verify_pin(p_employee_id,p_pin) then raise exception 'A valid employee PIN is required'; end if;
  v_method:='kiosk_pin';
 end if;
 select * into v_entry from public.timeclock_entries
 where employee_id=p_employee_id and clock_out_at is null and not requires_correction for update;
 if not found then raise exception 'No current shift to clock out. An earlier shift may require manager correction'; end if;
 if v_entry.clock_in_at < ((v_out at time zone 'America/New_York')::date::timestamp at time zone 'America/New_York') then
  raise exception 'Prior-day shift requires manager correction. Clock in again to start a new shift';
 end if;
 update public.timeclock_entries set clock_out_at=v_out,clock_out_method=v_method,clock_out_actor=v_uid,updated_at=v_out where id=v_entry.id;
 insert into public.audit_log(school_id,user_id,action,entity_type,entity_id,details)
 values(v_employee.school_id,v_uid,'timeclock_clock_out','timeclock_entry',v_entry.id,jsonb_build_object('employee_id',p_employee_id,'method',v_method,'clock_out_at',v_out));
 return v_entry.id;
end; $$;
