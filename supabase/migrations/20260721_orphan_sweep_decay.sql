-- Orphan-sweep decay (API-quota control for the daily Sumit sync).
--
-- The sweep in /api/cron/sumit-status-sync used to probe Sumit for EVERY
-- locally-cancelled subscription that still carries a recurring id — every
-- day, forever. The cancelled list only ever grows, so this was an unbounded
-- consumer of Sumit API-call quota.
--
-- sumit_confirmed_inactive_at records the FIRST time the sweep got an
-- AUTHORITATIVE confirmation from Sumit that the standing order is inactive
-- (the item was returned with a non-zero status — not merely missing from a
-- possibly-partial list read). The cron derives a decay schedule from it:
--   NULL (unconfirmed)      -> swept daily
--   confirmed < 90 days ago -> re-verified weekly (Sunday runs)
--   confirmed >= 90 days    -> re-verified monthly (1st-of-month runs)
-- Nothing is ever permanently excluded; a resurrected order is still caught
-- within a week/month, and the sweep clears the stamp (back to daily) the
-- moment it finds a confirmed item active again.
alter table public.subscriptions
  add column if not exists sumit_confirmed_inactive_at timestamptz;

comment on column public.subscriptions.sumit_confirmed_inactive_at is
  'First authoritative Sumit confirmation that the standing order is inactive; drives the orphan-sweep decay schedule (daily -> weekly -> monthly re-checks). NULL = unconfirmed, swept daily.';
