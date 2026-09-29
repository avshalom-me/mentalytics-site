-- Advertising spend on platforms other than Google (step 3 of the budget agent,
-- docs/agents/budget-agent-plan.md), entered from their invoices and receipts.
--
-- On purpose there is no API connection. The owner decided on 30/9/2026 that
-- Meta, when the account is back, is read only from its invoices: nothing here
-- logs into Facebook or holds a token for it, and Taboola is treated the same way.
--
-- A row is spend over a period, as an invoice states it: a single day, a
-- month, or a billing period. Totals for any window are prorated by day.

create table if not exists public.ads_platform_spend (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('taboola', 'meta', 'tiktok', 'other')),
  -- utm_campaign of the ads the money paid for, when the invoice says which;
  -- null = the platform as a whole.
  campaign_key text,
  period_start date not null,
  period_end date not null,
  -- Spend before VAT, in the invoice's currency.
  amount_orig numeric(12, 2) not null check (amount_orig >= 0),
  currency text not null default 'ILS' check (currency in ('ILS', 'USD', 'EUR')),
  -- Bank of Israel representative rate on period_end (the last one published
  -- by then); 1 for shekels. Kept on the row, so a total never moves later.
  fx_rate numeric(10, 5) not null check (fx_rate > 0),
  amount_ils numeric(12, 2) not null,
  vat_orig numeric(12, 2),
  source text not null default 'manual' check (source in ('manual', 'invoice', 'csv')),
  -- Invoice or receipt number, or where the figure was read.
  source_ref text,
  note text,
  created_by text not null default 'admin',
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists ads_platform_spend_period_idx on public.ads_platform_spend (period_start, period_end);

alter table public.ads_platform_spend enable row level security;
revoke all on table public.ads_platform_spend from public, anon, authenticated;
grant select, insert, update, delete on table public.ads_platform_spend to service_role;

-- Seekers from the other paid channels between two instants: distinct sessions
-- that clicked to contact a therapist, the same unit budget_campaign_stats uses
-- for Google.
create or replace function public.platform_seekers(p_from timestamptz, p_to timestamptz)
returns table(channel text, utm_campaign text, seekers bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.channel, c.utm_campaign, count(distinct c.session_id)
  from therapist_contact_clicks c
  where c.channel in ('taboola_paid', 'meta_paid', 'tiktok_paid')
    and c.clicked_at >= p_from
    and c.clicked_at < p_to
  group by 1, 2;
$$;

revoke all on function public.platform_seekers(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.platform_seekers(timestamptz, timestamptz) to service_role;
