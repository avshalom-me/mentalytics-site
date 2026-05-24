-- Add 'recommendation_explain_click' event type for tracking when a user clicks
-- the "✦ למה הוצע לי?" button on a treatment recommendation card.
--
-- Metadata schema (jsonb):
--   {
--     "questionnaire_type": "adult" | "child",
--     "treatment_key": string,        -- e.g. "CBT", "טיפול דינאמי"
--     "treatment_label": string,
--     "domain": string,
--     "urgent": boolean,
--     "viewer_age_band": string|null,
--     "viewer_gender": string|null,
--     "viewer_region": string|null,
--     "viewer_issue": string|null
--   }

ALTER TABLE analytics_events
  DROP CONSTRAINT IF EXISTS valid_event_type;

ALTER TABLE analytics_events
  ADD CONSTRAINT valid_event_type CHECK (event_type IN (
    'page_view',
    'profile_impression',
    'filter_used',
    'quiz_step',
    'quiz_complete',
    'recommendation_explain_click'
  ));
