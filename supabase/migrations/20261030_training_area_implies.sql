-- "טיפול דינאמי בטראומה" implies "טיפול דינאמי" (owner's decision, 30/10/2026).
-- A therapist who ticked only the trauma variant earned 0 of 25 expertise
-- points on every "טיפול דינאמי" search (about a fifth of adult quizzes), so
-- a dynamic therapist was shown at ~40% and never reached online results.
-- The rule lives in TRAINING_AREA_IMPLIES (app/lib/therapist-options.ts) for the
-- forms; this BEFORE trigger keeps it on every write path, like the email one.
-- Run date: 2026-10-30

BEGIN;

CREATE OR REPLACE FUNCTION therapists_implied_training_areas()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.training_areas IS NOT NULL
     AND 'טיפול דינאמי בטראומה' = ANY(NEW.training_areas)
     AND NOT ('טיפול דינאמי' = ANY(NEW.training_areas)) THEN
    NEW.training_areas = array_append(NEW.training_areas, 'טיפול דינאמי');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_therapists_implied_training_areas ON therapists;
CREATE TRIGGER trg_therapists_implied_training_areas
  BEFORE INSERT OR UPDATE OF training_areas ON therapists
  FOR EACH ROW
  EXECUTE FUNCTION therapists_implied_training_areas();

-- Existing rows: the trigger above fills them in on this update.
UPDATE therapists
SET training_areas = training_areas
WHERE 'טיפול דינאמי בטראומה' = ANY(training_areas)
  AND NOT ('טיפול דינאמי' = ANY(training_areas));

COMMIT;
