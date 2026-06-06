-- Phase 2: marketing recommendation approval queue.
-- The agent (generator) writes pending recommendations; the admin accepts or
-- dismisses them. v1 covers organic actions only (recruit therapists, fix
-- low-converting profiles, grow demand in over-supplied regions).
-- Run date: 2026-06-06

BEGIN;

CREATE TABLE IF NOT EXISTS marketing_recommendations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  type             text NOT NULL,        -- recruit_therapists | promote_region_organic | low_conversion_therapist
  target_key       text NOT NULL,        -- region:<bucket> | therapist:<id> (dedup key with type)
  title            text NOT NULL,
  rationale        text NOT NULL,
  suggested_action text NOT NULL,
  priority         integer NOT NULL DEFAULT 0,
  metadata         jsonb NOT NULL DEFAULT '{}',
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'dismissed', 'done')),
  resolved_at      timestamptz,
  resolved_note    text
);

CREATE INDEX IF NOT EXISTS idx_mr_status   ON marketing_recommendations (status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_mr_dedup    ON marketing_recommendations (type, target_key, status);

-- RLS: service-role only (API uses supabaseAdmin)
ALTER TABLE marketing_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON marketing_recommendations
  FOR ALL USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_recommendations TO service_role;

COMMIT;
