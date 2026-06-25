-- Track when an admin last sent a profile-completion request to a therapist,
-- so the admin UI can show whether (and when) it was already sent.
-- Run date: 2026-06-25

BEGIN;

ALTER TABLE therapists ADD COLUMN IF NOT EXISTS completion_requested_at timestamptz;

GRANT SELECT, INSERT, UPDATE, DELETE ON therapists TO service_role;

COMMIT;
