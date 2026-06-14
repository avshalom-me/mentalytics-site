-- Therapist-submitted articles: a therapist writes a short professional piece,
-- an admin reviews it, and once approved it appears in the /research hub
-- (mixed with the editorial content) attributed to the therapist's profile.
-- Open to any approved/paying therapist.
-- Run date: 2026-06-14

BEGIN;

CREATE TABLE IF NOT EXISTS therapist_articles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id     uuid NOT NULL REFERENCES therapists (id) ON DELETE CASCADE,
  title            text NOT NULL,
  slug             text NOT NULL UNIQUE,
  summary          text NOT NULL DEFAULT '',
  body             text NOT NULL,
  topic            text,
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  approved_at      timestamptz,
  reviewed_by      text
);

CREATE INDEX IF NOT EXISTS idx_ta_status    ON therapist_articles (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ta_therapist ON therapist_articles (therapist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ta_slug      ON therapist_articles (slug);

-- RLS: service-role only (all access goes through supabaseAdmin in the API).
ALTER TABLE therapist_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON therapist_articles
  FOR ALL USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON therapist_articles TO service_role;

COMMIT;
