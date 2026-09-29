-- The /admin/seo copy is now refreshed every 6 hours instead of once a night
-- (see 20260924_admin_seo_cache_schedule.sql for the original job).
--
-- On the night of 28-29/9/2026 the database stalled for about six hours (disk
-- I/O: checkpoints of a few buffers took 14-23 s, ~370 PostgREST statements
-- were cancelled at the 8 s limit). The one nightly run at 00:30 UTC died with
-- "job startup timeout", and the page kept showing Monday 03:30's copy: a week
-- that had just ended, with no row yet for the new one. A single failed run
-- left the graph "stuck" for a day and a half.
--
-- Every 6 hours (00:30, 06:30, 12:30, 18:30 UTC = 03:30, 09:30, 15:30, 21:30
-- in Israel in summer) bounds the damage of one failed run to ~12 hours, and
-- means the current week appears within hours of Monday instead of on Tuesday.
-- The refresh costs ~10-15 s of database CPU per run. cron.schedule with an
-- existing job name updates that job, so re-running this file is safe.
-- /api/admin-seo treats a copy older than 14 hours (two failed runs) as stale
-- and computes live, falling back to the old copy if the database is down.

select cron.schedule(
  'refresh-admin-seo-cache',
  '30 */6 * * *',
  $$select public.refresh_admin_seo_cache()$$
);
