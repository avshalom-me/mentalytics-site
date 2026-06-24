-- Early-bird promo pricing for the promoted plan.
-- Tracks when a discounted standing order should auto-revert to the regular
-- price. NULL = no pending revert (regular-price or already-reverted sub).
-- The daily sumit-status-sync cron reads this and calls /billing/recurring/update.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS promo_reverts_at TIMESTAMPTZ;

-- Lets the cron's revert sweep find due subscriptions efficiently.
CREATE INDEX IF NOT EXISTS idx_subscriptions_promo_reverts_at
  ON subscriptions (promo_reverts_at)
  WHERE promo_reverts_at IS NOT NULL;
