-- Guards the daily Sumit sync against a transient empty/partial recurring-list
-- read demoting (and then cancelling) a genuinely paying therapist. We only
-- demote on an AMBIGUOUS "item not found" after this many consecutive misses;
-- an authoritative Sumit cancel (item present, Status != 0) still demotes at
-- once. service_role already holds full grants on public.subscriptions.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS sync_miss_count int NOT NULL DEFAULT 0;
