-- Bank and card statement lines (step 5 of the budget agent,
-- docs/agents/budget-agent-plan.md).
--
-- A staging area, on purpose: nothing here touches `expenses`, because a row
-- there also creates an expense document in Sumit (the accountant's books).
-- Lines come in from the owner's monthly downloads (scripts/statements), are
-- classified by `statement_rules`, and wait for the owner's review. The repo is
-- public: this file holds the shape only; every amount, payee and rule lives in
-- the database.
--
-- Sign convention: `amount` is the cash effect in shekels, money out negative.
-- A card line is its own cost on the day of the purchase; the bank line that
-- pays the card bill is flow 'settlement', so a month is never counted twice.

create table if not exists public.statement_lines (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('bank', 'card')),
  -- Which account or card, as a plain label (no account numbers).
  source_label text not null,
  -- Bank: the posting day. Card: the day of the purchase.
  line_date date not null,
  -- Bank: the same day. Card: the day the bank is debited for it.
  settle_date date not null,
  -- As printed on the statement (payee or merchant).
  description text not null,
  -- The bank's reference number; null on a card line.
  reference text,
  amount numeric(12, 2) not null,
  orig_amount numeric(12, 2),
  orig_currency text,
  fx_fee numeric(10, 2),
  -- Bank only: the balance after the line, which lets an import prove it
  -- missed nothing (every line's balance follows from the one before).
  balance_after numeric(12, 2),
  -- expense | income | debt_service | debt_drawdown | tax | internal | settlement | unknown
  flow text not null default 'unknown',
  -- For expenses, a value of EXPENSE_CATEGORIES in app/lib/crm.ts, or a free tag
  -- (bank_fees, clearing_deposit, ...) for everything that is not an expense.
  category text,
  counterparty text,
  recurring boolean,
  -- proposed = a rule guessed it; confirmed = a firm rule or the owner said so;
  -- unknown = no rule matched; ignored = left out of every total.
  status text not null default 'unknown' check (status in ('proposed', 'confirmed', 'unknown', 'ignored')),
  note text,
  rule_id uuid,
  -- Makes an import idempotent: the same line from a later file changes nothing.
  dedupe_key text not null unique,
  imported_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists statement_lines_date_idx on public.statement_lines (line_date);
create index if not exists statement_lines_flow_idx on public.statement_lines (flow, category);

-- First match wins, lowest priority number first. A rule can narrow by source,
-- direction, an exact amount or an exact bank reference; every rule needs a
-- description fragment. Rules are data, so a payee's name never reaches the repo.
create table if not exists public.statement_rules (
  id uuid primary key default gen_random_uuid(),
  priority integer not null default 100,
  source text check (source in ('bank', 'card')),
  description_contains text not null,
  direction text check (direction in ('in', 'out')),
  amount_exact numeric(12, 2),
  reference_exact text,
  flow text not null,
  category text,
  counterparty text,
  recurring boolean,
  status text not null default 'confirmed' check (status in ('proposed', 'confirmed')),
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.statement_lines enable row level security;
alter table public.statement_rules enable row level security;
revoke all on table public.statement_lines from public, anon, authenticated;
revoke all on table public.statement_rules from public, anon, authenticated;
grant select, insert, update, delete on table public.statement_lines to service_role;
grant select, insert, update, delete on table public.statement_rules to service_role;
