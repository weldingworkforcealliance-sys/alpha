-- Allow the attendance report Edge Function enough time to load finalized attendance,
-- send through Resend, and mark the queue row sent. The previous 5-second
-- pg_net timeout was producing worker timeouts while the function was still
-- processing.

do $do$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'attendance-report-worker'
  limit 1;

  if v_job_id is null then
    raise exception 'attendance-report-worker cron job not found';
  end if;

  perform cron.alter_job(
    v_job_id,
    command := $cmd$
      select net.http_post(
        url := 'https://qsmvgyyaemjmklceyikr.supabase.co/functions/v1/send-attendance-reports',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-attendance-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='attendance_cron_secret' limit 1)
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
    $cmd$
  );
end
$do$;
