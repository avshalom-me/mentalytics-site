-- The retention review row gains its one-sentence "what to do" (the owner's
-- ask after the first run, 11/10/26: one clear sentence per therapist in the
-- closed row, the detail only when opened). The weekly narrative column stays
-- but is no longer written.
alter table public.retention_review_rows add column if not exists todo text;
