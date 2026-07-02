-- Normalize therapist emails to lowercase so the claim-by-email match (.eq
-- against the always-lowercased auth email) is reliable. A mixed-case stored
-- email (e.g. an admin-added SUPERHEIMAN@GMAIL.COM) otherwise fails to match
-- its owner's login and would spawn a duplicate row. A BEFORE trigger keeps
-- every future insert/update lowercase regardless of code path.
-- Run date: 2026-07-02

BEGIN;

UPDATE therapists
SET email = lower(email)
WHERE email IS NOT NULL AND email <> lower(email);

CREATE OR REPLACE FUNCTION therapists_lowercase_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email = lower(NEW.email);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_therapists_lowercase_email ON therapists;
CREATE TRIGGER trg_therapists_lowercase_email
  BEFORE INSERT OR UPDATE OF email ON therapists
  FOR EACH ROW
  EXECUTE FUNCTION therapists_lowercase_email();

GRANT SELECT, INSERT, UPDATE, DELETE ON therapists TO service_role;

COMMIT;
