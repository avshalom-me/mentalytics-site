-- Per-campaign visitor counts for the /admin/recruitment dashboard, so the
-- admin sees the ad funnel (visitors -> signups) from our own data instead of
-- Meta's confusing UI. "visitors" = distinct sessions that arrived carrying a
-- utm_campaign (real unique people from a tagged ad link — one person browsing
-- many therapist cards is still ONE visitor, not many page loads). Aggregated
-- in SQL (COUNT DISTINCT) so it's exact and never hits the 1000-row cap.

create or replace function public.admin_recruitment_visits(p_since timestamptz default null)
returns json
language sql
stable
as $$
  select coalesce(json_agg(row_to_json(v)), '[]'::json)
  from (
    select utm_campaign as campaign,
           count(distinct session_id) as visitors
    from public.analytics_events
    where utm_campaign is not null
      and (p_since is null or created_at >= p_since)
    group by utm_campaign
  ) v;
$$;

revoke all on function public.admin_recruitment_visits(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_recruitment_visits(timestamptz) to service_role;
