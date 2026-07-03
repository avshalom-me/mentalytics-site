-- CRM finance (2026-07-03): manual expense/refund ledger + yearly EBITDA
-- targets. Income is NOT stored here — it is read live from `payments`
-- (already mirrored from Sumit), so there is exactly one source of truth
-- per side: Sumit→payments for money in, this table for money out.
-- Same security posture as 20260703_crm_core: service_role only.

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL,
  category text NOT NULL, -- see EXPENSE_CATEGORIES in app/lib/crm.ts
  vendor text,
  description text,
  amount numeric NOT NULL,      -- ₪ before VAT (matches payments.amount semantics)
  vat_amount numeric,           -- ₪, nullable when not applicable
  is_rnd boolean NOT NULL DEFAULT false, -- R&D tagging for the 150% recognition / tech-enterprise track
  channel text,                 -- ad spend attribution: google_paid / meta_paid / ...
  receipt_ref text,             -- supplier invoice number / document reference
  note text,
  created_by text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expenses_date_idx ON public.expenses(expense_date DESC);
CREATE INDEX expenses_category_idx ON public.expenses(category);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.expenses FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.expenses FROM anon, authenticated;
GRANT ALL ON public.expenses TO service_role;

-- Yearly EBITDA targets from the business plan's three scenarios, so the
-- finance screen can show cumulative progress.
INSERT INTO public.plan_targets (metric, month, scenario, target) VALUES
  ('ebitda_year', '2027-06-01', 'pessimistic', 341961),
  ('ebitda_year', '2027-06-01', 'optimistic', 826521),
  ('ebitda_year', '2027-06-01', 'success', 1459177);
