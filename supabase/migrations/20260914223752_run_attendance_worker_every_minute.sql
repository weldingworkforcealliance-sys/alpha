select cron.alter_job(
  job_id := (select jobid from cron.job where jobname='attendance-report-worker' limit 1),
  schedule := '* * * * *'
);
