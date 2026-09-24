-- /admin/seo computed admin_seo_overview on every page load: 2.5 s on average,
-- 10 s on a cold run - past the 8 s statement timeout PostgREST imposes, which
-- is the "ERROR, works on retry" the owner saw (five times on 23/9/2026). The
-- report's numbers move once a day at most, so it is now computed at night and
-- read from here. The stored value is the functions' output as-is; /api/admin-seo
-- falls back to computing live when the stored copy is missing or stale.
--
-- Filled by refresh_admin_seo_cache(), scheduled with pg_cron (next migration):
-- a job inside the database is not subject to PostgREST's 8 s limit, which a
-- web cron calling the same function would have hit exactly like the page did.

create table if not exists public.admin_report_cache (
  key text primary key,
  data jsonb not null,
  computed_at timestamptz not null default now(),
  duration_ms integer
);

alter table public.admin_report_cache enable row level security;
revoke all on table public.admin_report_cache from public, anon, authenticated;
grant select, insert, update, delete on table public.admin_report_cache to service_role;

create or replace function public.refresh_admin_seo_cache()
returns void
language plpgsql
set search_path = public
as $fn$
declare
  d int;
  t0 timestamptz;
  j jsonb;
begin
  -- The three windows the page offers (30/60/90 days).
  foreach d in array array[30, 60, 90] loop
    t0 := clock_timestamp();
    j := public.admin_seo_overview(d);
    insert into public.admin_report_cache (key, data, computed_at, duration_ms)
    values ('seo_overview:' || d, j, now(), (extract(epoch from clock_timestamp() - t0) * 1000)::int)
    on conflict (key) do update
      set data = excluded.data, computed_at = excluded.computed_at, duration_ms = excluded.duration_ms;

    t0 := clock_timestamp();
    j := public.admin_ai_weekly(d);
    insert into public.admin_report_cache (key, data, computed_at, duration_ms)
    values ('ai_weekly:' || d, j, now(), (extract(epoch from clock_timestamp() - t0) * 1000)::int)
    on conflict (key) do update
      set data = excluded.data, computed_at = excluded.computed_at, duration_ms = excluded.duration_ms;
  end loop;
end
$fn$;

revoke all on function public.refresh_admin_seo_cache() from public, anon, authenticated;
grant execute on function public.refresh_admin_seo_cache() to service_role;
