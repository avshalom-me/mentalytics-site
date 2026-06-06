-- Add a marketing/attribution section to the weekly + monthly AI reports.
-- marketing_data: per-channel funnel snapshot (jsonb); ai_marketing: the LLM's
-- channel analysis. Additive + idempotent. Run date: 2026-06-06

BEGIN;

ALTER TABLE weekly_reports
  ADD COLUMN IF NOT EXISTS marketing_data jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_marketing   text;

ALTER TABLE monthly_admin_reports
  ADD COLUMN IF NOT EXISTS marketing_data jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_marketing   text;

GRANT SELECT, INSERT, UPDATE ON weekly_reports         TO service_role;
GRANT SELECT, INSERT, UPDATE ON monthly_admin_reports  TO service_role;

COMMIT;
