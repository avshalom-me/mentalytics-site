-- Per-campaign funnel for the marketing dashboard: for each utm_campaign, how
-- many distinct sessions landed, how many viewed a therapist profile, and how
-- many contacted — broken down by contact type (whatsapp/phone/email/form).
-- Aggregated in SQL (GROUP BY) so it's exact regardless of volume (no 1000-row
-- PostgREST cap). p_since null = all time.

create or replace function public.admin_campaign_funnel(p_since timestamptz default null)
returns json
language sql
stable
as $$
  with e as (
    select utm_campaign, count(distinct session_id) as n
    from public.analytics_events
    where event_type = 'page_view' and utm_campaign is not null
      and (p_since is null or created_at >= p_since)
    group by utm_campaign
  ),
  v as (
    -- real profile views only (match_card = impression, excluded)
    select utm_campaign, count(distinct session_id) as n
    from public.therapist_profile_views
    where utm_campaign is not null and source is distinct from 'match_card'
      and (p_since is null or viewed_at >= p_since)
    group by utm_campaign
  ),
  c as (
    select utm_campaign,
           count(*) as total,
           count(*) filter (where click_type = 'whatsapp')      as whatsapp,
           count(*) filter (where click_type = 'phone')         as phone,
           count(*) filter (where click_type = 'email')         as email,
           count(*) filter (where click_type = 'site_message')  as site_message
    from public.therapist_contact_clicks
    where utm_campaign is not null
      and (p_since is null or clicked_at >= p_since)
    group by utm_campaign
  ),
  keys as (
    select utm_campaign from e
    union select utm_campaign from v
    union select utm_campaign from c
  ),
  r as (
    select k.utm_campaign as campaign,
           coalesce(e.n, 0)            as sessions,
           coalesce(v.n, 0)            as viewed_profile,
           coalesce(c.total, 0)        as contacts,
           coalesce(c.whatsapp, 0)     as whatsapp,
           coalesce(c.phone, 0)        as phone,
           coalesce(c.email, 0)        as email,
           coalesce(c.site_message, 0) as site_message
    from keys k
    left join e on e.utm_campaign = k.utm_campaign
    left join v on v.utm_campaign = k.utm_campaign
    left join c on c.utm_campaign = k.utm_campaign
    order by coalesce(c.total, 0) desc, coalesce(e.n, 0) desc
  )
  select coalesce((select json_agg(row_to_json(r)) from r), '[]'::json);
$$;

revoke all on function public.admin_campaign_funnel(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_campaign_funnel(timestamptz) to service_role;
