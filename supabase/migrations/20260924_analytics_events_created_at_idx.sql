-- The admin analytics endpoint (and the marketing dashboard that reuses it) pages
-- through analytics_events with ORDER BY created_at ... LIMIT 1000 OFFSET n. Every
-- existing index on the table leads with another column, so each page was a full
-- scan plus an on-disk sort (1.3 s per page on 24/9/2026, 47 pages for one month).
create index if not exists idx_ae_created_at on public.analytics_events (created_at);
