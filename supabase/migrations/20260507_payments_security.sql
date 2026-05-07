-- Payments security hardening:
--   1. UNIQUE on morning_document_id to prevent duplicate completions
--      from a single Morning document.
--   2. Enable RLS on payments + subscriptions. No policies = default deny.
--      All current API code uses the service-role key, which bypasses RLS,
--      so existing flows keep working. This is defense-in-depth against
--      future code that might use the anon key.

-- Idempotency: prevent double-credit if Morning resends a webhook with the
-- same document id and our race-condition guard somehow misses.
CREATE UNIQUE INDEX IF NOT EXISTS payments_morning_document_id_unique
  ON payments(morning_document_id)
  WHERE morning_document_id IS NOT NULL;

-- Default-deny RLS. Service-role bypasses; anon/authenticated have no
-- access without explicit policies.
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
