-- Loans the business is paying back, for the runway in the monthly budget
-- report (/admin/budget/report, chapter 11).
--
-- Paying back principal is not an expense, so loans stay out of
-- recurring_expenses and out of the finance page's profit and loss. The
-- payments still leave the bank account, so the runway counts them until each
-- loan is paid off. Entered by hand from the owner's figures, like the cash
-- balance (plan_targets, metric cash_balance). The repo is public: amounts
-- live only in the database.

create table if not exists public.finance_loans (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  -- What is left to pay back, as of as_of.
  remaining numeric(12, 2) not null check (remaining >= 0),
  -- What leaves the account each month; the last payment is what remains.
  monthly_payment numeric(12, 2) not null check (monthly_payment > 0),
  as_of date not null,
  active boolean not null default true,
  note text,
  created_by text not null default 'admin',
  created_at timestamptz not null default now()
);

alter table public.finance_loans enable row level security;
revoke all on table public.finance_loans from public, anon, authenticated;
grant select, insert, update, delete on table public.finance_loans to service_role;
