-- The documents Sumit actually issued: tax invoice-receipts for every charge and
-- credit notes for every refund. `payments` mirrors the charge flow only, so a
-- refund never reached it: on 29/9/2026 Sumit held nine credit notes since 19/8
-- (-₪2,030 before VAT) and `payments` had none of them, which put the income on
-- /admin/finance about 19% above the real figure (September: 35%).
--
-- Filled once a day by the sumit-status-sync cron from /accounting/documents/list/
-- (app/lib/sumit-documents.ts): one API call re-reads a trailing 60-day window,
-- and the first run on an empty table reads the whole year. Rows are upserted by
-- Sumit's DocumentID, so a re-read never duplicates. Values are stored as Sumit
-- reports them: gross includes VAT and is negative on a credit.

create table if not exists public.sumit_documents (
  document_id bigint primary key,
  document_number bigint,
  -- Sumit's Accounting_Typed_DocumentType: 1 = invoice-receipt, 6 = credit invoice-receipt.
  doc_type smallint not null,
  -- What the finance screen counts: 'charge' = a sale (types 0, 1), 'credit' = a
  -- refund (types 5, 6), 'other' = everything else (receipts, quotes, ...).
  kind text not null check (kind in ('charge', 'credit', 'other')),
  -- The document date as Sumit prints it (Israel calendar day).
  doc_date date not null,
  currency smallint,
  value_gross numeric(12, 2) not null,
  value_net numeric(12, 2) not null,
  -- Sumit's CustomerID. Kept for a later link to the therapist; the site does
  -- not store Sumit customer ids anywhere else.
  customer_id bigint,
  first_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create index if not exists sumit_documents_doc_date_idx on public.sumit_documents (doc_date);

alter table public.sumit_documents enable row level security;
revoke all on table public.sumit_documents from public, anon, authenticated;
grant select, insert, update, delete on table public.sumit_documents to service_role;
