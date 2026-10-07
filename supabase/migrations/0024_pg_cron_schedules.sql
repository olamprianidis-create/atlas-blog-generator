-- Reliable scheduling (2026-10-07). GitHub Actions' "*/10" schedule was
-- actually firing every 3-8 hours, so a campaign due at 2:32 PM sat unsent.
-- Supabase's pg_cron now calls the cron endpoints from inside the database,
-- on time to the minute; pg_net makes the HTTP request.
--
-- The bearer token is read from Supabase Vault (secret name
-- 'stat_atlas_cron_secret', = the CRON_SECRET env var). It's stored by a
-- one-off script, never in this file — update it with vault.update_secret
-- if CRON_SECRET is ever rotated.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: drop these jobs first if they already exist.
select cron.unschedule(jobname) from cron.job
where jobname in ('stat-atlas-publish-scheduled', 'stat-atlas-weekly-reminder', 'stat-atlas-welcome-new-members');

-- Articles, videos, email campaigns — every minute.
select cron.schedule(
  'stat-atlas-publish-scheduled',
  '* * * * *',
  $$ select net.http_post(
       url := 'https://atlas-blog-generator.vercel.app/api/cron/publish-scheduled',
       headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
         'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'stat_atlas_cron_secret')),
       body := '{}'::jsonb,
       timeout_milliseconds := 60000) $$
);

-- Monday 5:30 / 6:00 PM PT Discord reminders. Must stay exactly every 10
-- minutes on the :00 mark: each reminder's window is 10 minutes wide and has
-- no "already sent" flag, so this cadence fires each one exactly once.
select cron.schedule(
  'stat-atlas-weekly-reminder',
  '*/10 * * * *',
  $$ select net.http_post(
       url := 'https://atlas-blog-generator.vercel.app/api/cron/weekly-reminder',
       headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
         'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'stat_atlas_cron_secret')),
       body := '{}'::jsonb,
       timeout_milliseconds := 30000) $$
);

-- Discord welcomes (tracked per member, so cadence only affects delay).
select cron.schedule(
  'stat-atlas-welcome-new-members',
  '*/10 * * * *',
  $$ select net.http_post(
       url := 'https://atlas-blog-generator.vercel.app/api/cron/welcome-new-members',
       headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
         'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'stat_atlas_cron_secret')),
       body := '{}'::jsonb,
       timeout_milliseconds := 30000) $$
);
