-- Newsletter / marketing consent audit log (append-only).
--
-- Legal basis: Amendment 40 to the Communications Law (חוק התקשורת — "חוק הספאם")
-- places the BURDEN OF PROOF of consent on the sender. A bare boolean is not
-- enough — for every opt-in / opt-out we record an immutable row capturing
-- WHO, WHEN, WHAT exact wording was shown, and FROM WHERE (IP + user-agent).
--
-- The therapists.newsletter_consent boolean stays as the denormalized
-- "current status" used to build the send segment. This table is the legal
-- source of truth. Never UPDATE or DELETE rows — a withdrawal is a NEW
-- 'withdrawn' row, so the full history is preserved.
--
-- Run date: 2026-06-16

BEGIN;

CREATE TABLE IF NOT EXISTS consent_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id    uuid REFERENCES therapists (id) ON DELETE SET NULL,
  email           text NOT NULL,
  consent_type    text NOT NULL DEFAULT 'newsletter',
  action          text NOT NULL CHECK (action IN ('granted', 'withdrawn')),
  consent_text    text,            -- snapshot of the exact wording the user agreed to
  consent_version text,            -- short tag of that wording, e.g. 'v1-2026-06'
  source          text,            -- 'therapist_signup_form' | 'email_unsubscribe_link' | ...
  ip              text,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consent_email     ON consent_events (email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_therapist ON consent_events (therapist_id, created_at DESC);

-- RLS: service-role only (all access goes through supabaseAdmin in the API).
ALTER TABLE consent_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON consent_events
  FOR ALL USING (true) WITH CHECK (true);

-- Append-only log: grant INSERT + SELECT only (no UPDATE / DELETE) so the audit
-- trail stays immutable even from the service role.
GRANT SELECT, INSERT ON consent_events TO service_role;

COMMIT;
