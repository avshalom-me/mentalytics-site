-- Store the reason an admin rejected a therapist (e.g. unreadable license
-- certificate) so it can be shown to the therapist and emailed to them. The
-- therapist fixes the issue, re-saves, and the profile returns to review.
-- Run date: 2026-06-14

BEGIN;

ALTER TABLE therapists ADD COLUMN IF NOT EXISTS rejection_reason text;

COMMIT;
