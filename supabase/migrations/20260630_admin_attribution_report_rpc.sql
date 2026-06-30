-- Fix the "מקורות לידים" / attribution funnel undercount.
--
-- The /api/admin-attribution route (and the weekly report) fetched raw rows
-- from analytics_events / therapist_profile_views / therapist_contact_clicks
-- and counted them in JS. PostgREST caps a single response at 1000 rows
-- (db-max-rows), so any metric above 1000 silently froze at exactly 1000
-- (e.g. profile_views 1231 -> 1000, impressions 7846 -> 1000).
--
-- This function does the per-channel + per-campaign aggregation server-side
-- (COUNT + GROUP BY), so the result is exact and cheap regardless of volume.
-- p_since null = all time. Returns:
--   { channels:  [{channel, page_views, impressions, profile_views, contact_clicks}],
--     campaigns: [{campaign, contact_clicks}] }

create or replace function public.admin_attribution_report(p_since timestamptz default null)
returns json
language sql
stable
as $$
  with chan_parts as (
    select coalesce(channel, 'unknown') as channel,
           count(*) filter (where event_type = 'page_view')         as page_views,
           count(*) filter (where event_type = 'profile_impression') as impressions,
           0::bigint as profile_views,
           0::bigint as contact_clicks
    from public.analytics_events
    where event_type in ('page_view', 'profile_impression')
      and (p_since is null or created_at >= p_since)
    group by coalesce(channel, 'unknown')

    union all
    select coalesce(channel, 'unknown'), 0, 0, count(*), 0
    from public.therapist_profile_views
    where (p_since is null or viewed_at >= p_since)
    group by coalesce(channel, 'unknown')

    union all
    select coalesce(channel, 'unknown'), 0, 0, 0, count(*)
    from public.therapist_contact_clicks
    where (p_since is null or clicked_at >= p_since)
    group by coalesce(channel, 'unknown')
  ),
  channels as (
    select channel,
           sum(page_views)     as page_views,
           sum(impressions)    as impressions,
           sum(profile_views)  as profile_views,
           sum(contact_clicks) as contact_clicks
    from chan_parts
    group by channel
  ),
  campaigns as (
    select utm_campaign as campaign, count(*) as contact_clicks
    from public.therapist_contact_clicks
    where utm_campaign is not null
      and (p_since is null or clicked_at >= p_since)
    group by utm_campaign
    order by count(*) desc
    limit 15
  )
  select json_build_object(
    'channels',  coalesce((select json_agg(row_to_json(channels))  from channels),  '[]'::json),
    'campaigns', coalesce((select json_agg(row_to_json(campaigns)) from campaigns), '[]'::json)
  );
$$;

-- Server-side only (called with the service role behind the admin middleware).
revoke all on function public.admin_attribution_report(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_attribution_report(timestamptz) to service_role;
