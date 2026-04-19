-- Performance indexes for common queries
CREATE INDEX IF NOT EXISTS idx_therapists_status ON therapists(status);
CREATE INDEX IF NOT EXISTS idx_clicks_therapist_date ON therapist_contact_clicks(therapist_id, clicked_at);
CREATE INDEX IF NOT EXISTS idx_views_therapist_date ON therapist_profile_views(therapist_id, viewed_at);
