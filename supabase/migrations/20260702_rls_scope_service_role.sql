-- SECURITY FIX (2026-07-02): six tables had an RLS policy named
-- "Service role full access" written as `FOR ALL USING(true) WITH CHECK(true)`
-- but WITHOUT a `TO service_role` clause, so Postgres defaulted it to PUBLIC.
-- Combined with the platform-default table GRANTs held by anon/authenticated,
-- the browser-shipped anon key had full CRUD on all six tables
-- (verified live: anon could read analytics_events, insert/delete
-- therapist_articles, read/wipe consent_events, etc.).
--
-- Fix: scope each policy to service_role AND revoke the anon/authenticated
-- grants. All application access to these tables goes through the service-role
-- client (supabaseAdmin); no anon client or browser component queries them
-- directly, so this does not affect the app. Verified after apply:
-- anon_grant_count = 0 and has_table_privilege(anon, ...) = false for all.

BEGIN;

-- 1) Scope the permissive policy to service_role only (defense-in-depth).
ALTER POLICY "Service role full access" ON public.analytics_events         TO service_role;
ALTER POLICY "Service role full access" ON public.consent_events           TO service_role;
ALTER POLICY "Service role full access" ON public.marketing_recommendations TO service_role;
ALTER POLICY "Service role full access" ON public.monthly_admin_reports    TO service_role;
ALTER POLICY "Service role full access" ON public.therapist_articles       TO service_role;
ALTER POLICY "Service role full access" ON public.weekly_reports           TO service_role;

-- 2) Remove the SQL-level grants that let anon/authenticated touch these at all.
--    (This is the actual close of the hole; RLS + grant must both pass.)
REVOKE ALL ON public.analytics_events          FROM anon, authenticated;
REVOKE ALL ON public.consent_events            FROM anon, authenticated;
REVOKE ALL ON public.marketing_recommendations FROM anon, authenticated;
REVOKE ALL ON public.monthly_admin_reports     FROM anon, authenticated;
REVOKE ALL ON public.therapist_articles        FROM anon, authenticated;
REVOKE ALL ON public.weekly_reports            FROM anon, authenticated;

COMMIT;
