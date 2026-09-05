-- Atomic queue claim used by the custom-secret attendance report worker.

create or replace function public.claim_due_attendance_reports(p_limit integer default 25)
returns table(
  queue_id uuid,
  session_id uuid,
  recipient_email text,
  attempts integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required';
  end if;

  return query
  with due as (
    select q.id
    from public.attendance_report_queue q
    where q.status in ('pending','failed')
      and q.run_after <= now()
      and q.attempts < 5
    order by q.run_after, q.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  ), claimed as (
    update public.attendance_report_queue q
    set status = 'processing',
        attempts = q.attempts + 1,
        last_error = null,
        updated_at = now()
    from due
    where q.id = due.id
    returning q.id, q.session_id, q.recipient_email, q.attempts
  )
  select c.id, c.session_id, c.recipient_email, c.attempts
  from claimed c;
end;
$$;

revoke all on function public.claim_due_attendance_reports(integer) from public, anon, authenticated;
grant execute on function public.claim_due_attendance_reports(integer) to service_role;
