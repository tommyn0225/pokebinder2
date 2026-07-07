-- Daily price-snapshot job.
--
-- This is the scheduled job referenced in "Key design decisions": once a day it
-- triggers a snapshot of the current price of every held card into
-- price_snapshots, building our own free price history over time.
--
-- The job runs via pg_cron and calls the `trigger-snapshot` Edge Function with
-- pg_net. Capturing it here makes the schedule part of the versioned schema
-- instead of living only in the Supabase dashboard.
--
-- SECRET HANDLING: the Authorization header below is a PLACEHOLDER. The real
-- SNAPSHOT_SECRET is set directly in the database and is never committed to the
-- repo. After applying this migration to a fresh project, edit the scheduled
-- job's command to replace <YOUR_SNAPSHOT_SECRET> with the real value.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: drop any existing job of this name before (re)creating it so the
-- migration can be re-applied cleanly.
select cron.unschedule('daily-price-snapshot')
where exists (select 1 from cron.job where jobname = 'daily-price-snapshot');

-- Daily at 03:00 UTC.
select cron.schedule(
  'daily-price-snapshot',
  '0 3 * * *',
  $job$
    select net.http_post(
      url    := 'https://zuexairhiucwfvfuxoho.supabase.co/functions/v1/trigger-snapshot',
      body   := '{}',
      headers := '{"Authorization": "Bearer <YOUR_SNAPSHOT_SECRET>"}'::jsonb
    );
  $job$
);
