-- House / editorial byline for articles. Until now every article was attributed
-- to a real listed therapist (therapist_id NOT NULL) and shown as "מאת <name>"
-- linked to their profile. An editorial piece by the site itself ("צוות טיפול
-- חכם") has no single therapist author. author_name, when set, overrides the
-- displayed byline: the public pages show this text WITHOUT a profile link, and
-- the piece is NOT listed under the backing therapist's profile. therapist_id
-- stays NOT NULL (kept for data integrity / the backing owner), just hidden from
-- display when author_name is present. Null author_name == old behavior.
-- Run date: 2026-07-10

BEGIN;

ALTER TABLE therapist_articles
  ADD COLUMN IF NOT EXISTS author_name text;

-- Re-affirm service_role access (all access goes through supabaseAdmin).
GRANT SELECT, INSERT, UPDATE, DELETE ON therapist_articles TO service_role;

COMMIT;
