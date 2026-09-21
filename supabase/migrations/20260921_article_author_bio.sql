-- Author bio for the attribution box at the bottom of an article.
-- The box showed the same generic line for every author ("מאמר זה נכתב על ידי
-- X, <role>, מטפל באתר טיפול חכם."), so an author's actual credentials - the
-- thing a reader weighs on a professional article - had nowhere to go but the
-- article body. author_bio, when set, replaces that line. Per article, like
-- author_name: the admin writes it per piece and a therapist can add one when
-- submitting. Null author_bio == old behavior.
-- Run date: 2026-09-21

BEGIN;

ALTER TABLE therapist_articles
  ADD COLUMN IF NOT EXISTS author_bio text;

-- Re-affirm service_role access (all access goes through supabaseAdmin).
GRANT SELECT, INSERT, UPDATE, DELETE ON therapist_articles TO service_role;

COMMIT;
