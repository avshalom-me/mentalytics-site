-- One therapist row per auth account. The stub-on-first-login flow (GET
-- /api/therapist-profile) inserts when no row exists; without this index two
-- concurrent first requests could both insert. Verified: no duplicates exist.
-- Run date: 2026-07-02

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS therapists_user_id_unique
  ON therapists (user_id) WHERE user_id IS NOT NULL;

COMMIT;
