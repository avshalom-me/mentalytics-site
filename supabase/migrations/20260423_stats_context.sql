-- Stats context for therapist profile views + monthly insights cache
-- Adds viewer categorization (anonymized) to profile views, plus a cache table for AI narratives.
-- Run date: 2026-04-23

BEGIN;

-- ===== 1. Extend therapist_profile_views =====

ALTER TABLE therapist_profile_views
  ADD COLUMN IF NOT EXISTS viewer_region   text,
  ADD COLUMN IF NOT EXISTS viewer_issue    text,
  ADD COLUMN IF NOT EXISTS viewer_age_band text,
  ADD COLUMN IF NOT EXISTS viewer_gender   text,
  ADD COLUMN IF NOT EXISTS match_score     int,
  ADD COLUMN IF NOT EXISTS session_id      text;

COMMENT ON COLUMN therapist_profile_views.viewer_region   IS 'Enum: center|sharon|jerusalem|haifa|north|south|online|other';
COMMENT ON COLUMN therapist_profile_views.viewer_issue    IS 'Enum: emotional|relationship|addiction|functional|personal|sexual|parenting|child|other';
COMMENT ON COLUMN therapist_profile_views.viewer_age_band IS 'Enum: child|18-30|31-45|46-60|60+';
COMMENT ON COLUMN therapist_profile_views.viewer_gender   IS 'Enum: m|f|other';
COMMENT ON COLUMN therapist_profile_views.match_score     IS '0-100, null for directory views';
COMMENT ON COLUMN therapist_profile_views.session_id      IS 'Client-side generated hash — used only for dedup, not for identification';

CREATE INDEX IF NOT EXISTS idx_profile_views_therapist_date
  ON therapist_profile_views (therapist_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_profile_views_therapist_region
  ON therapist_profile_views (therapist_id, viewer_region);

CREATE INDEX IF NOT EXISTS idx_profile_views_therapist_issue
  ON therapist_profile_views (therapist_id, viewer_issue);

CREATE INDEX IF NOT EXISTS idx_profile_views_dedup
  ON therapist_profile_views (therapist_id, session_id, viewed_at);

-- ===== 2. Monthly insights cache =====

CREATE TABLE IF NOT EXISTS therapist_insights (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id   uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  month_start    date NOT NULL,
  stats_json     jsonb NOT NULL,
  ai_narrative   text,
  generated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (therapist_id, month_start)
);

CREATE INDEX IF NOT EXISTS idx_therapist_insights_lookup
  ON therapist_insights (therapist_id, month_start DESC);

-- RLS
ALTER TABLE therapist_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Therapists see own insights" ON therapist_insights;
CREATE POLICY "Therapists see own insights"
  ON therapist_insights FOR SELECT
  USING (
    therapist_id IN (
      SELECT id FROM therapists WHERE user_id = auth.uid()
    )
  );

COMMIT;
