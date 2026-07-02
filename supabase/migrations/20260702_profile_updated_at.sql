-- When the THERAPIST last changed their own profile (details / photo /
-- certificate). Set explicitly by the therapist-facing API routes — admin
-- edits and status changes do NOT bump it — so the admin UI can tell whether
-- a therapist responded to a completion request.
-- Run date: 2026-07-02

BEGIN;

ALTER TABLE therapists ADD COLUMN IF NOT EXISTS profile_updated_at timestamptz;

GRANT SELECT, INSERT, UPDATE, DELETE ON therapists TO service_role;

COMMIT;
