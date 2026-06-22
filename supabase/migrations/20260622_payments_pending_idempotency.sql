-- Atomic double-charge guard.
--
-- The create-quiz-payment / create-subscription routes previously guarded
-- against double-submits with a non-atomic "is there a recent pending row?"
-- SELECT followed by a separate INSERT. Two concurrent requests (double-click,
-- retried fetch) could both read "no pending" and both charge the card.
--
-- This partial unique index makes the guard atomic at the database: at most one
-- pending payment can exist per (reference_id, payment_type) at a time. The
-- second concurrent INSERT fails with 23505 and the route returns 409 instead
-- of opening a parallel charge. Once a payment leaves 'pending' (completed /
-- failed) it no longer participates in the index, so the next legitimate
-- attempt is free to insert.
CREATE UNIQUE INDEX IF NOT EXISTS payments_pending_unique
  ON public.payments (reference_id, payment_type)
  WHERE status = 'pending';
