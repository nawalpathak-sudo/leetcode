-- ============================================================
-- Scheduled Cron: Refresh coding profiles
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

-- Step 2: Remove old jobs if they exist (safe to ignore errors)
DO $$ BEGIN
  PERFORM cron.unschedule('refresh-coding-profiles');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('refresh-leetcode-profiles');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('refresh-codeforces-profiles');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Step 3: Schedule LeetCode refresh at midnight IST (18:30 UTC) daily
select cron.schedule(
  'refresh-leetcode-profiles',
  '30 18 * * *',                      -- 18:30 UTC = 00:00 IST
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/refresh-profiles',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"platform":"leetcode"}'::jsonb
  ) as request_id;
  $$
);

-- Step 4: Schedule Codeforces refresh at 1 AM IST (19:30 UTC) daily
select cron.schedule(
  'refresh-codeforces-profiles',
  '30 19 * * *',                      -- 19:30 UTC = 01:00 IST
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/refresh-profiles',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"platform":"codeforces"}'::jsonb
  ) as request_id;
  $$
);

-- ============================================================
-- ALTERNATIVE: If app.settings aren't configured, use actual values:
-- ============================================================
--
-- select cron.unschedule('refresh-coding-profiles');
--
-- select cron.schedule(
--   'refresh-leetcode-profiles',
--   '0 0 * * *',
--   $$
--   select net.http_post(
--     url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/refresh-profiles',
--     headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--     body := '{"platform":"leetcode"}'::jsonb
--   ) as request_id;
--   $$
-- );
--
-- select cron.schedule(
--   'refresh-codeforces-profiles',
--   '0 1 * * *',
--   $$
--   select net.http_post(
--     url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/refresh-profiles',
--     headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--     body := '{"platform":"codeforces"}'::jsonb
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

-- Unschedule jobs:
-- select cron.unschedule('refresh-leetcode-profiles');
-- select cron.unschedule('refresh-codeforces-profiles');

-- Test: Run immediately (manually trigger):
-- select net.http_post(
--   url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/refresh-profiles',
--   headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--   body := '{"platform":"leetcode"}'::jsonb
-- );
