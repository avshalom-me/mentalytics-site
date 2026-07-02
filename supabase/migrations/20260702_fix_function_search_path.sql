-- Security-advisor fix (function_search_path_mutable): pin search_path on the
-- three admin RPC functions so a malicious schema earlier in a caller's
-- search_path can't shadow the tables/functions they reference.
-- No new objects — existing GRANTs (service_role) are unaffected.

BEGIN;

ALTER FUNCTION public.admin_attribution_report(timestamptz)        SET search_path = public;
ALTER FUNCTION public.admin_engagement_counts(uuid[], timestamptz) SET search_path = public;
ALTER FUNCTION public.admin_recruitment_visits(timestamptz)        SET search_path = public;

COMMIT;
