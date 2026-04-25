-- Unified analytics events table for funnel + quiz dropout tracking
-- Covers: page_view, profile_impression, filter_used, quiz_step, quiz_complete
-- Existing tables (therapist_profile_views, therapist_contact_clicks) remain unchanged.
-- Run date: 2026-04-25

BEGIN;

CREATE TABLE IF NOT EXISTS analytics_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    text NOT NULL,
  source        text,
  therapist_id  uuid REFERENCES therapists(id) ON DELETE SET NULL,
  session_id    text,
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_event_type CHECK (event_type IN (
    'page_view', 'profile_impression', 'filter_used',
    'quiz_step', 'quiz_complete'
  ))
);

CREATE INDEX idx_ae_type_created
  ON analytics_events (event_type, created_at);

CREATE INDEX idx_ae_therapist_type
  ON analytics_events (therapist_id, event_type, created_at)
  WHERE therapist_id IS NOT NULL;

CREATE INDEX idx_ae_session
  ON analytics_events (session_id, created_at)
  WHERE session_id IS NOT NULL;

-- RLS: enable but no anon policies — only service role can read/write
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON analytics_events
  FOR ALL USING (true) WITH CHECK (true);

COMMIT;
