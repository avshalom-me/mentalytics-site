-- Profile view tracking for paying therapists
CREATE TABLE IF NOT EXISTS therapist_profile_views (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  therapist_id uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  source     text NOT NULL DEFAULT 'directory' CHECK (source IN ('match', 'directory')),
  viewed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_views_therapist_week
  ON therapist_profile_views (therapist_id, viewed_at);

ALTER TABLE therapist_profile_views ENABLE ROW LEVEL SECURITY;
