-- Recurring (fixed) expenses (2026-07-22): templates that materialize into
-- real `expenses` rows month by month — entered once, optionally capped at a
-- number of months (months_total NULL = runs until stopped manually).
-- Materialization is lazy and idempotent: the finance read routes insert any
-- occurrence whose date has arrived, guarded by the unique index below.
-- Same security posture as the rest of the CRM: service_role only.

CREATE TABLE public.recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date date NOT NULL,       -- first occurrence; its day-of-month repeats monthly (clamped in short months)
  months_total int CHECK (months_total > 0), -- NULL = no limit
  category text NOT NULL,         -- see EXPENSE_CATEGORIES in app/lib/crm.ts
  vendor text,
  description text,
  amount numeric NOT NULL,        -- ₪ before VAT, per month
  vat_amount numeric,             -- ₪ per month, nullable when not applicable
  is_rnd boolean NOT NULL DEFAULT false,
  channel text,
  note text,
  active boolean NOT NULL DEFAULT true, -- false = stopped, no further materialization
  created_by text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.recurring_expenses FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.recurring_expenses FROM anon, authenticated;
GRANT ALL ON public.recurring_expenses TO service_role;

-- Materialized rows point back at their template. Deleting a template keeps
-- the historical rows (SET NULL). The unique index is what makes lazy
-- materialization idempotent (upsert ON CONFLICT DO NOTHING).
ALTER TABLE public.expenses
  ADD COLUMN recurring_id uuid REFERENCES public.recurring_expenses(id) ON DELETE SET NULL,
  ADD COLUMN recurring_occurrence int;

CREATE UNIQUE INDEX expenses_recurring_occurrence_idx
  ON public.expenses(recurring_id, recurring_occurrence);
