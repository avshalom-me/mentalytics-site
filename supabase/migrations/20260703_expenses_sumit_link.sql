-- Link CRM expense rows to the Sumit draft documents they create
-- (2026-07-03). The CRM pushes each entered expense to Sumit as a DRAFT
-- expense document (IsDraft=true) — a human approves it inside Sumit before
-- it reaches the books. These columns track that handoff per row.

ALTER TABLE public.expenses
  ADD COLUMN sumit_doc_id bigint,
  ADD COLUMN sumit_status text, -- null=not sent / draft_created / failed
  ADD COLUMN sumit_error text;

CREATE UNIQUE INDEX expenses_sumit_doc_idx ON public.expenses(sumit_doc_id)
  WHERE sumit_doc_id IS NOT NULL;
