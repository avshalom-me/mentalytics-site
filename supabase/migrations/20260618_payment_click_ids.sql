-- Persist raw ad-platform click ids on each payment, so a completed conversion
-- can be uploaded back to Google Ads / Meta with exact click attribution.
--
-- Captured client-side at landing (app/lib/attribution.ts -> getClickIds),
-- threaded through the payment create routes, stored here. conversion_uploaded_at
-- is the idempotency marker for the (forthcoming) Ads conversion-upload job.
--
-- Additive + idempotent: nullable columns only. Most rows (organic/direct) carry
-- no click id and stay NULL. Nothing is rewritten.
-- Run date: 2026-06-18

BEGIN;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS gclid                  text,
  ADD COLUMN IF NOT EXISTS gbraid                 text,
  ADD COLUMN IF NOT EXISTS wbraid                 text,
  ADD COLUMN IF NOT EXISTS fbclid                 text,
  ADD COLUMN IF NOT EXISTS conversion_uploaded_at timestamptz;

COMMENT ON COLUMN payments.gclid IS
  'Google Ads click id captured at landing; used to upload this conversion to Google Ads (NULL = no paid-click attribution)';
COMMENT ON COLUMN payments.conversion_uploaded_at IS
  'When this completed conversion was uploaded to the ad platform; NULL = pending upload';

-- The upload job scans completed, not-yet-uploaded conversions that carry a
-- Google click id.
CREATE INDEX IF NOT EXISTS idx_payments_conversion_pending
  ON payments (created_at)
  WHERE status = 'completed'
    AND conversion_uploaded_at IS NULL
    AND (gclid IS NOT NULL OR gbraid IS NOT NULL OR wbraid IS NOT NULL);

-- Explicit grant — the API writes/reads payments via supabaseAdmin (service_role).
GRANT SELECT, INSERT, UPDATE ON payments TO service_role;

COMMIT;
