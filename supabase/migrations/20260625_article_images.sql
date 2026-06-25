-- Add image support to articles, and enable admin-authored editorial articles.
-- An editorial article is written by the admin but ATTRIBUTED to a real
-- therapist in the directory (it links to their profile and shows up on it),
-- so the existing therapist_id / display / SEO paths all keep working — we only
-- add the image columns here. therapist_id stays NOT NULL on purpose.
-- Run date: 2026-06-25

BEGIN;

ALTER TABLE therapist_articles
  ADD COLUMN IF NOT EXISTS image_url    text,
  ADD COLUMN IF NOT EXISTS image_alt    text,
  ADD COLUMN IF NOT EXISTS image_credit text;

-- Re-affirm service_role access (all access goes through supabaseAdmin).
GRANT SELECT, INSERT, UPDATE, DELETE ON therapist_articles TO service_role;

COMMIT;
