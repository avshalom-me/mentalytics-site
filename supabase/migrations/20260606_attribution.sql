-- Marketing attribution: capture the acquisition channel + UTM campaign data
-- on every tracked funnel event, so the admin can report lead source and
-- per-channel conversion (impression -> profile view -> contact click).
--
-- Additive + idempotent: adds nullable columns only. Existing rows stay NULL
-- (reported as "unknown"); collection starts from deploy. Nothing is rewritten.
--
-- channel enum (validated in the API, stored as plain text for forward-compat):
--   google_paid | google_organic | meta_paid | whatsapp | direct | referral | other
-- Run date: 2026-06-06

BEGIN;

-- profile views (full-profile entry / match-result impression)
ALTER TABLE therapist_profile_views
  ADD COLUMN IF NOT EXISTS channel      text,
  ADD COLUMN IF NOT EXISTS utm_source   text,
  ADD COLUMN IF NOT EXISTS utm_medium   text,
  ADD COLUMN IF NOT EXISTS utm_campaign text;

-- contact clicks (the conversion event)
ALTER TABLE therapist_contact_clicks
  ADD COLUMN IF NOT EXISTS channel      text,
  ADD COLUMN IF NOT EXISTS utm_source   text,
  ADD COLUMN IF NOT EXISTS utm_medium   text,
  ADD COLUMN IF NOT EXISTS utm_campaign text;

-- unified funnel events (page_view, profile_impression, ...)
ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS channel      text,
  ADD COLUMN IF NOT EXISTS utm_source   text,
  ADD COLUMN IF NOT EXISTS utm_medium   text,
  ADD COLUMN IF NOT EXISTS utm_campaign text;

COMMENT ON COLUMN therapist_profile_views.channel IS
  'Acquisition channel: google_paid|google_organic|meta_paid|whatsapp|direct|referral|other (NULL = unknown)';
COMMENT ON COLUMN therapist_contact_clicks.channel IS
  'Acquisition channel: google_paid|google_organic|meta_paid|whatsapp|direct|referral|other (NULL = unknown)';
COMMENT ON COLUMN analytics_events.channel IS
  'Acquisition channel: google_paid|google_organic|meta_paid|whatsapp|direct|referral|other (NULL = unknown)';

-- Lightweight partial indexes to support per-channel reporting over a date range
CREATE INDEX IF NOT EXISTS idx_tpv_channel
  ON therapist_profile_views (channel, viewed_at) WHERE channel IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tcc_channel
  ON therapist_contact_clicks (channel, clicked_at) WHERE channel IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ae_channel
  ON analytics_events (channel, created_at) WHERE channel IS NOT NULL;

-- Explicit grants — the API writes/reads via supabaseAdmin (service_role).
GRANT SELECT, INSERT, UPDATE ON therapist_profile_views  TO service_role;
GRANT SELECT, INSERT, UPDATE ON therapist_contact_clicks TO service_role;
GRANT SELECT, INSERT, UPDATE ON analytics_events         TO service_role;

COMMIT;
