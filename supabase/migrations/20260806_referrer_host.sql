-- Referring HOST for inbound traffic ("betipulnet.co.il"), never a path or
-- query string. The channel already answers "how many came from referrals";
-- this answers "from which site", which the backlink campaign needs and which
-- was unanswerable before. Null for direct traffic and same-site navigation.
ALTER TABLE analytics_events         ADD COLUMN IF NOT EXISTS referrer_host text;
ALTER TABLE therapist_profile_views  ADD COLUMN IF NOT EXISTS referrer_host text;
ALTER TABLE therapist_contact_clicks ADD COLUMN IF NOT EXISTS referrer_host text;

CREATE INDEX IF NOT EXISTS analytics_events_referrer_host_idx
  ON analytics_events (referrer_host, created_at DESC)
  WHERE referrer_host IS NOT NULL;
CREATE INDEX IF NOT EXISTS profile_views_referrer_host_idx
  ON therapist_profile_views (referrer_host, viewed_at DESC)
  WHERE referrer_host IS NOT NULL;
CREATE INDEX IF NOT EXISTS contact_clicks_referrer_host_idx
  ON therapist_contact_clicks (referrer_host, clicked_at DESC)
  WHERE referrer_host IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON analytics_events         TO service_role;
GRANT SELECT, INSERT, UPDATE ON therapist_profile_views  TO service_role;
GRANT SELECT, INSERT, UPDATE ON therapist_contact_clicks TO service_role;
