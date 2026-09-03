-- Preserve original punch source/actor when a manager corrects a time entry.

alter table public.timeclock_adjustments
  add column if not exists old_clock_in_method text null,
  add column if not exists old_clock_out_method text null,
  add column if not exists old_clock_in_actor uuid null references public.profiles(id) on delete set null,
  add column if not exists old_clock_out_actor uuid null references public.profiles(id) on delete set null;

create index if not exists timeclock_adjustments_old_in_actor_idx
  on public.timeclock_adjustments(old_clock_in_actor)
  where old_clock_in_actor is not null;

create index if not exists timeclock_adjustments_old_out_actor_idx
  on public.timeclock_adjustments(old_clock_out_actor)
  where old_clock_out_actor is not null;

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
  v_in_changed boolean;
  v_out_changed boolean;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_entry
  from public.timeclock_entries
  where id = p_entry_id
  for update;

  if not found then raise exception 'Time entry not found'; end if;
  if not private.timeclock_is_manager(v_entry.school_id) then raise exception 'Manager permission required'; end if;
  if p_new_clock_in_at is null then raise exception 'Clock-in time is required'; end if;
  if p_new_clock_out_at is not null and p_new_clock_out_at <= p_new_clock_in_at then
    raise exception 'Clock-out must be later than clock-in';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'A correction reason is required';
  end if;

  v_in_changed := p_new_clock_in_at is distinct from v_entry.clock_in_at;
  v_out_changed := p_new_clock_out_at is distinct from v_entry.clock_out_at;

  if not v_in_changed and not v_out_changed then
    raise exception 'No time changes were provided';
  end if;

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
    old_clock_in_at, new_clock_in_at, old_clock_out_at, new_clock_out_at,
    old_clock_in_method, old_clock_out_method, old_clock_in_actor, old_clock_out_actor,
    reason
  ) values (
    v_entry.school_id, v_entry.id, v_entry.employee_id, v_uid,
    v_entry.clock_in_at, p_new_clock_in_at, v_entry.clock_out_at, p_new_clock_out_at,
    v_entry.clock_in_method, v_entry.clock_out_method, v_entry.clock_in_actor, v_entry.clock_out_actor,
    btrim(p_reason)
  );

  update public.timeclock_entries
  set clock_in_at = p_new_clock_in_at,
      clock_out_at = p_new_clock_out_at,
      clock_in_method = case when v_in_changed then 'manager' else v_entry.clock_in_method end,
      clock_out_method = case
        when p_new_clock_out_at is null then null
        when v_out_changed then 'manager'
        else v_entry.clock_out_method
      end,
      clock_in_actor = case when v_in_changed then v_uid else v_entry.clock_in_actor end,
      clock_out_actor = case
        when p_new_clock_out_at is null then null
        when v_out_changed then v_uid
        else v_entry.clock_out_actor
      end,
      updated_at = clock_timestamp()
  where id = p_entry_id;

  insert into public.audit_log(school_id, user_id, action, entity_type, entity_id, details)
  values (
    v_entry.school_id, v_uid, 'timeclock_entry_adjusted', 'timeclock_entry', p_entry_id,
    jsonb_build_object(
      'employee_id', v_entry.employee_id,
      'reason', btrim(p_reason),
      'clock_in_changed', v_in_changed,
      'clock_out_changed', v_out_changed,
      'old_clock_in_at', v_entry.clock_in_at,
      'new_clock_in_at', p_new_clock_in_at,
      'old_clock_out_at', v_entry.clock_out_at,
      'new_clock_out_at', p_new_clock_out_at,
      'old_clock_in_method', v_entry.clock_in_method,
      'old_clock_out_method', v_entry.clock_out_method,
      'old_clock_in_actor', v_entry.clock_in_actor,
      'old_clock_out_actor', v_entry.clock_out_actor
    )
  );

  return p_entry_id;
end;
$$;
