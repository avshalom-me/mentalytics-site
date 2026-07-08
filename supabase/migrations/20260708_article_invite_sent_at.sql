-- Mark when an admin last sent a therapist the "write an article for two months
-- of promotion" invite, so the admin UI can badge who was already invited.
-- Backfilled from the existing therapist_audit_log 'article_invite' entries so
-- invites already sent (incl. today's) are marked retroactively.
-- Run date: 2026-07-08

BEGIN;

ALTER TABLE therapists ADD COLUMN IF NOT EXISTS article_invite_sent_at timestamptz;

UPDATE therapists t
SET article_invite_sent_at = a.last_sent
FROM (
  SELECT therapist_id, max(created_at) AS last_sent
  FROM therapist_audit_log
  WHERE action = 'article_invite'
  GROUP BY therapist_id
) a
WHERE a.therapist_id = t.id
  AND t.article_invite_sent_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON therapists TO service_role;

COMMIT;
