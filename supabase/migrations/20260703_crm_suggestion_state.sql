-- Task-suggestion state (2026-07-03). Suggestions themselves are computed
-- live by rules over CRM data + business-plan milestones; this table only
-- remembers which suggestion keys were accepted (became a task) or dismissed,
-- so they stop reappearing. Keys are stable per suggestion instance.

CREATE TABLE public.crm_suggestion_state (
  key text PRIMARY KEY,
  status text NOT NULL, -- accepted / dismissed
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_suggestion_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.crm_suggestion_state FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.crm_suggestion_state FROM anon, authenticated;
GRANT ALL ON public.crm_suggestion_state TO service_role;
