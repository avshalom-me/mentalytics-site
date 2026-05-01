-- Weekly business reports — snapshots of the cross-cut between
-- patient demand (clicks, profile views, filter usage) and therapist supply.
-- Generated automatically every Sunday by /api/cron/weekly-report.
-- Run date: 2026-05-01

BEGIN;

CREATE TABLE IF NOT EXISTS weekly_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start      date NOT NULL,
  week_end        date NOT NULL,
  patient_data    jsonb NOT NULL DEFAULT '{}',
  therapist_data  jsonb NOT NULL DEFAULT '{}',
  ai_summary      text,
  ai_recommendations text,
  email_sent_to   text,
  email_status    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_week_start
  ON weekly_reports (week_start DESC);

ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON weekly_reports
  FOR ALL USING (true) WITH CHECK (true);

COMMIT;
