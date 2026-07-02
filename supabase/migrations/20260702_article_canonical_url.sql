-- Cross-domain canonical support for community articles.
-- When an article was first published elsewhere (e.g. the therapist's own
-- website/blog), we store the ORIGINAL url here. The public article page then
-- emits <link rel="canonical" href="<canonical_url>"> pointing at the original,
-- so Google attributes the content to the source and does not treat our copy as
-- competing duplicate content. When empty, the page self-canonicalizes.
-- Run date: 2026-07-02

BEGIN;

ALTER TABLE therapist_articles
  ADD COLUMN IF NOT EXISTS canonical_url text;

-- Re-affirm service_role access (all access goes through supabaseAdmin).
GRANT SELECT, INSERT, UPDATE, DELETE ON therapist_articles TO service_role;

COMMIT;
