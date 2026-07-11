-- Fix: admin_attribution_report counted EVERY therapist_profile_views row as a
-- "profile view", including source='match_card' rows. But match_card rows are
-- card impressions in the matching results — not profile-page views. The rest
-- of admin (admin-analytics funnelBySource, admin-marketing KPIs) already treats
-- match_card as an impression. Counting it as a profile view here inflated
-- profile_views and understated viewToClick on /admin/attribution and in the
-- weekly/monthly report marketing section (worst on the null/"unknown" channel,
-- where all match_card rows land).
--
-- This re-defines the function so match_card views count as IMPRESSIONS and only
-- real (directory / match / legacy-null) views count as profile_views. All other
-- logic is unchanged.

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
    -- match_card = a card impression in the matching results, not a profile view.
    select coalesce(channel, 'unknown'),
           0::bigint,
           count(*) filter (where source = 'match_card')               as impressions,
           count(*) filter (where source is distinct from 'match_card') as profile_views,
           0::bigint
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
