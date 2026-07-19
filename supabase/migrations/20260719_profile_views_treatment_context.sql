-- Therapist-dashboard enrichment: capture WHICH treatment recommendation led a
-- match-flow visitor to the profile (viewer_treatment) and the specific finding
-- behind it (viewer_symptom), so "מה הצורך שלהם" can go deeper than the coarse
-- issue buckets. Populated only by the match flow going forward; old rows stay
-- null (the dashboard notes when collection started).

alter table public.therapist_profile_views
  add column if not exists viewer_treatment text,
  add column if not exists viewer_symptom text;
