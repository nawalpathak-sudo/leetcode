-- ============================================================
-- Midnight Cron: Refresh all coding profiles
-- ============================================================
-- Prerequisites:
--   1. Enable pg_cron and pg_net extensions in Supabase Dashboard:
--      Dashboard → Database → Extensions → search "pg_cron" → Enable
--      Dashboard → Database → Extensions → search "pg_net" → Enable
--
--   2. Deploy the refresh-profiles edge function:
--      supabase functions deploy refresh-profiles
--
--   3. Run this SQL in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Step 1: Enable extensions (if not already)
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Step 2: Schedule the cron job (runs every day at midnight UTC)
select cron.schedule(
  'refresh-coding-profiles',          -- job name
  '0 0 * * *',                        -- cron expression: midnight UTC daily
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/refresh-profiles',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- ============================================================
-- ALTERNATIVE: If the above doesn't work because app.settings
-- aren't configured, use your actual project values:
-- ============================================================
--
-- select cron.schedule(
--   'refresh-coding-profiles',
--   '0 0 * * *',
--   $$
--   select net.http_post(
--     url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/refresh-profiles',
--     headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--     body := '{}'::jsonb
--   ) as request_id;
--   $$
-- );

-- ============================================================
-- Useful commands:
-- ============================================================

-- View all scheduled jobs:
-- select * from cron.job;

-- View job run history:
-- select * from cron.job_run_details order by start_time desc limit 20;

-- Unschedule the job:
-- select cron.unschedule('refresh-coding-profiles');

-- Test: Run immediately (manually trigger):
-- select net.http_post(
--   url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/refresh-profiles',
--   headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--   body := '{}'::jsonb
-- );
