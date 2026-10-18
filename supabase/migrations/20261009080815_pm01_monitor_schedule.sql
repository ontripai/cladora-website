create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname='pm01-refresh-alerts-v1';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule('pm01-refresh-alerts-v1','*/15 * * * *','select pm_control.refresh_alerts_v1();');
end $$;
