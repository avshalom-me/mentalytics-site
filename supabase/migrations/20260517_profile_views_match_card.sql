-- Allow a new 'match_card' source on therapist_profile_views.
-- This lets us count a card impression in the match-results list
-- separately from a full-profile entry coming from match.

ALTER TABLE therapist_profile_views
  DROP CONSTRAINT IF EXISTS therapist_profile_views_source_check;

ALTER TABLE therapist_profile_views
  ADD CONSTRAINT therapist_profile_views_source_check
  CHECK (source IN ('match', 'match_card', 'directory'));

COMMENT ON COLUMN therapist_profile_views.source IS
  'Enum: match|match_card|directory — match_card is a card impression in results list, match is a profile entry from match results, directory is a profile entry from the directory';
