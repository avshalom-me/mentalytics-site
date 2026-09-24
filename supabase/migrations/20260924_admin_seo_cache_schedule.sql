-- Nightly refresh of the /admin/seo cache (see 20260924_admin_report_cache.sql).
-- pg_cron runs the job inside the database, as postgres, so the 90-day report
-- is not cut off by PostgREST's 8 s statement timeout. 00:30 UTC = 03:30 in
-- Israel: the quietest hour, and the refresh costs ~10-15 s of database CPU.
-- /api/admin-seo serves the stored copy while it is under 36 hours old.

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'refresh-admin-seo-cache',
  '30 0 * * *',
  $$select public.refresh_admin_seo_cache()$$
);

-- First fill now, so the page has a copy before the first night.
select public.refresh_admin_seo_cache();
