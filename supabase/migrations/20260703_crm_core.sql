-- CRM core (2026-07-03): foundational tables for the in-admin CRM.
-- All tables are additive — no existing rows are touched. Every table is
-- service_role-only (RLS policy scoped TO service_role + REVOKE from
-- anon/authenticated + explicit GRANT to service_role), matching the
-- convention set by 20260702_rls_scope_service_role.
--
-- crm_leads holds contact details of people seeking mental-health care —
-- the most sensitive data in the system. It must never be readable by the
-- anon key. All access goes through /api/admin-crm/* (Basic Auth) via the
-- service-role client.

-- 1) organizations — therapy centers / schools / kupot / colleges.
--    A solo therapist simply has organization_id NULL.
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  org_type text NOT NULL DEFAULT 'clinic', -- clinic / school / kupah / college / other
  contact_name text,
  phone text,
  email text,
  intake_email text, -- where patient inquiries for this org's therapists go
  status text NOT NULL DEFAULT 'active',   -- active / paused / churned
  partner text,                            -- future white-label / referral partner tag
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.therapists
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
CREATE INDEX therapists_organization_idx ON public.therapists(organization_id)
  WHERE organization_id IS NOT NULL;

-- 2) crm_notes — internal notes on any CRM entity.
CREATE TABLE public.crm_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, -- therapist / organization / lead / deal
  entity_id uuid NOT NULL,
  author text NOT NULL DEFAULT 'admin',
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_notes_entity_idx ON public.crm_notes(entity_type, entity_id, created_at DESC);

-- 3) crm_tasks — follow-ups with due dates; surfaced in the dashboard work queue.
--    entity_label denormalizes the display name so task lists render without
--    joining across four entity tables.
CREATE TABLE public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  details text,
  entity_type text,  -- optional link: therapist / organization / lead / deal
  entity_id uuid,
  entity_label text,
  due_date date,
  priority text NOT NULL DEFAULT 'normal', -- low / normal / high
  status text NOT NULL DEFAULT 'open',     -- open / done
  assignee text,
  snoozed_until date,
  created_by text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX crm_tasks_open_idx ON public.crm_tasks(status, due_date);
CREATE INDEX crm_tasks_entity_idx ON public.crm_tasks(entity_type, entity_id);

-- 4) crm_leads — inbound inquiries that previously evaporated into email.
--    Sources: contact-therapist site messages, the general contact form,
--    manual entry. lead_type keeps the door open for the teachers vertical.
CREATE TABLE public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_type text NOT NULL DEFAULT 'patient', -- patient / therapist / teacher / organization / general
  name text,
  contact text, -- email or phone, as provided
  message text,
  therapist_id uuid REFERENCES public.therapists(id) ON DELETE SET NULL,
  source text,      -- site_message / contact_form / manual
  page_source text, -- match / directory / profile (for site messages)
  channel text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  status text NOT NULL DEFAULT 'new', -- new / in_progress / converted / closed
  status_changed_at timestamptz,
  handled_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_leads_status_idx ON public.crm_leads(status, created_at DESC);
CREATE INDEX crm_leads_therapist_idx ON public.crm_leads(therapist_id);

-- 5) crm_deals — B2B/B2G opportunity pipeline (schools, kupot, colleges,
--    the psychologists integration, education-ministry deal).
CREATE TABLE public.crm_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  deal_type text, -- school / kupah / college / psychologists / other
  stage text NOT NULL DEFAULT 'inquiry', -- inquiry / meeting / pilot / proposal / contract / won / lost
  value_ils numeric,
  owner text,
  contact_name text,
  contact_info text,
  next_step text,
  next_step_due date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX crm_deals_stage_idx ON public.crm_deals(stage, updated_at DESC);

-- 6) crm_email_log — every outbound email the system or the admin sends,
--    so the 360° timeline can show communication history. Best-effort
--    writes: a logging failure must never block the email itself.
CREATE TABLE public.crm_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  recipient_type text, -- therapist / lead / organization / other
  entity_id uuid,
  subject text,
  template text, -- named template/email-kind, or 'custom'
  sent_by text NOT NULL DEFAULT 'system', -- admin / system / cron
  provider text NOT NULL DEFAULT 'resend',
  status text NOT NULL DEFAULT 'sent', -- sent / failed
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_email_log_entity_idx ON public.crm_email_log(entity_id, created_at DESC);
CREATE INDEX crm_email_log_recipient_idx ON public.crm_email_log(recipient, created_at DESC);

-- 7) plan_targets — monthly targets from the 2026 business plan, so the
--    dashboard can show actual-vs-plan. Seeded below from the plan's KPI
--    milestones (month 1 / 3 / 6 / 12 mapped to calendar months); edit
--    freely — the dashboard reads whatever is here.
CREATE TABLE public.plan_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric text NOT NULL, -- therapists_total / teachers_total / questionnaires_month / cpl_max / lead_to_treatment_pct / churn_max_pct / cac_max
  month date NOT NULL,  -- first day of month
  scenario text NOT NULL DEFAULT 'base', -- pessimistic / optimistic / base
  target numeric NOT NULL,
  UNIQUE (metric, month, scenario)
);

-- Lock down all seven tables: service_role only.
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_notes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tasks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_email_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_targets  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.organizations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.crm_notes     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.crm_tasks     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.crm_leads     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.crm_deals     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.crm_email_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.plan_targets  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.organizations FROM anon, authenticated;
REVOKE ALL ON public.crm_notes     FROM anon, authenticated;
REVOKE ALL ON public.crm_tasks     FROM anon, authenticated;
REVOKE ALL ON public.crm_leads     FROM anon, authenticated;
REVOKE ALL ON public.crm_deals     FROM anon, authenticated;
REVOKE ALL ON public.crm_email_log FROM anon, authenticated;
REVOKE ALL ON public.plan_targets  FROM anon, authenticated;

GRANT ALL ON public.organizations TO service_role;
GRANT ALL ON public.crm_notes     TO service_role;
GRANT ALL ON public.crm_tasks     TO service_role;
GRANT ALL ON public.crm_leads     TO service_role;
GRANT ALL ON public.crm_deals     TO service_role;
GRANT ALL ON public.crm_email_log TO service_role;
GRANT ALL ON public.plan_targets  TO service_role;

-- Seed: business-plan KPI milestones (v3, launch 11.6.2026).
-- Month mapping: m1=2026-07, m3=2026-09, m6=2026-12, m12=2027-06.
INSERT INTO public.plan_targets (metric, month, scenario, target) VALUES
  ('therapists_total', '2026-07-01', 'optimistic', 500),
  ('therapists_total', '2026-09-01', 'optimistic', 700),
  ('therapists_total', '2026-12-01', 'optimistic', 800),
  ('therapists_total', '2027-06-01', 'optimistic', 950),
  ('therapists_total', '2026-07-01', 'pessimistic', 250),
  ('therapists_total', '2026-09-01', 'pessimistic', 370),
  ('therapists_total', '2026-12-01', 'pessimistic', 520),
  ('therapists_total', '2027-06-01', 'pessimistic', 775),
  ('teachers_total',   '2026-07-01', 'base', 0),
  ('teachers_total',   '2026-09-01', 'base', 20),
  ('teachers_total',   '2026-12-01', 'base', 80),
  ('teachers_total',   '2027-06-01', 'base', 200),
  ('questionnaires_month', '2026-07-01', 'base', 50),
  ('questionnaires_month', '2026-09-01', 'base', 70),
  ('questionnaires_month', '2026-12-01', 'base', 120),
  ('cpl_max',          '2026-07-01', 'base', 80),
  ('cpl_max',          '2026-09-01', 'base', 65),
  ('cpl_max',          '2026-12-01', 'base', 50),
  ('cpl_max',          '2027-06-01', 'base', 40),
  ('lead_to_treatment_pct', '2026-07-01', 'base', 20),
  ('lead_to_treatment_pct', '2026-09-01', 'base', 25),
  ('lead_to_treatment_pct', '2026-12-01', 'base', 30),
  ('lead_to_treatment_pct', '2027-06-01', 'base', 35),
  ('churn_max_pct',    '2026-07-01', 'base', 20),
  ('churn_max_pct',    '2026-09-01', 'base', 15),
  ('churn_max_pct',    '2026-12-01', 'base', 10),
  ('churn_max_pct',    '2027-06-01', 'base', 10),
  ('cac_max',          '2026-07-01', 'base', 200),
  ('cac_max',          '2027-06-01', 'base', 200);
