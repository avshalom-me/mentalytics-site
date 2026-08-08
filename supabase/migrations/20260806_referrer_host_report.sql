-- Per-referring-site funnel. Aggregated in SQL for the same reason
-- admin_attribution_report is: fetching rows and counting them in JS silently
-- caps at PostgREST's 1000 rows and freezes any metric above it.
CREATE OR REPLACE FUNCTION admin_referrer_report(p_since timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visits AS (
    SELECT referrer_host AS host,
           count(*) FILTER (WHERE event_type = 'page_view')          AS page_views,
           count(DISTINCT session_id) FILTER (WHERE event_type = 'page_view') AS sessions
    FROM analytics_events
    WHERE referrer_host IS NOT NULL
      AND (p_since IS NULL OR created_at >= p_since)
    GROUP BY 1
  ),
  views AS (
    SELECT referrer_host AS host, count(*) AS profile_views
    FROM therapist_profile_views
    WHERE referrer_host IS NOT NULL
      AND (p_since IS NULL OR viewed_at >= p_since)
    GROUP BY 1
  ),
  clicks AS (
    SELECT referrer_host AS host, count(*) AS contact_clicks
    FROM therapist_contact_clicks
    WHERE referrer_host IS NOT NULL
      AND (p_since IS NULL OR clicked_at >= p_since)
    GROUP BY 1
  )
  SELECT COALESCE(jsonb_agg(x ORDER BY x.contact_clicks DESC, x.sessions DESC), '[]'::jsonb)
  FROM (
    SELECT COALESCE(v.host, w.host, c.host)      AS host,
           COALESCE(v.page_views, 0)             AS page_views,
           COALESCE(v.sessions, 0)               AS sessions,
           COALESCE(w.profile_views, 0)          AS profile_views,
           COALESCE(c.contact_clicks, 0)         AS contact_clicks
    FROM visits v
    FULL OUTER JOIN views  w ON w.host = v.host
    FULL OUTER JOIN clicks c ON c.host = COALESCE(v.host, w.host)
  ) x;
$$;

REVOKE ALL ON FUNCTION admin_referrer_report(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_referrer_report(timestamptz) TO service_role;
