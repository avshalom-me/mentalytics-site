-- quiz_treatments: which treatments a finished questionnaire actually recommended.
--
-- The kids questionnaire fires quiz_complete when the parent reaches the result
-- screen, before scoring has run, so its completion events have never carried
-- the treatment list - 0 of 96 rows. That left no way to answer "what does this
-- questionnaire recommend, and how often" for children at all.
--
-- Moving quiz_complete to after scoring would fix the data and break the series:
-- "completion" for kids has always meant "reached the result screen", and
-- redefining it mid-stream puts an unexplainable step in the admin's monthly
-- chart. So the treatments ride on their own event instead. quiz_complete keeps
-- counting exactly what it always counted.
--
-- Adults keep sending treatments on quiz_complete (they score before firing);
-- this event is additive there and is not emitted twice.

ALTER TABLE analytics_events DROP CONSTRAINT IF EXISTS valid_event_type;

ALTER TABLE analytics_events ADD CONSTRAINT valid_event_type CHECK (
  event_type = ANY (ARRAY[
    'page_view',
    'profile_impression',
    'filter_used',
    'quiz_step',
    'quiz_complete',
    'quiz_treatments',
    'recommendation_explain_click',
    'match_free_fallback',
    'recruit_page_view',
    'therapist_explain_click',
    'matching_click',
    'match_saved'
  ])
);

-- Reads go through the service role only (see reference_supabase_grants).
GRANT SELECT, INSERT ON analytics_events TO service_role;
