-- Keep expired Live Classroom sessions from remaining visually active until an
-- instructor revisits the classroom page. The anonymous submission RPC already
-- rejects expired sessions; this job keeps persisted session state equally clean.

update public.classroom_sessions
set status = 'ended',
    ended_at = coalesce(ended_at, expires_at)
where status = 'active'
  and expires_at <= now();

do $do$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'expire-live-classroom-sessions'
  ) then
    perform cron.schedule(
      'expire-live-classroom-sessions',
      '*/5 * * * *',
      $cron$
        update public.classroom_sessions
        set status = 'ended',
            ended_at = coalesce(ended_at, expires_at)
        where status = 'active'
          and expires_at <= now();
      $cron$
    );
  end if;
end
$do$;
