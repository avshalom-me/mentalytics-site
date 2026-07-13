-- admin_campaign_funnel counted a campaign's "sessions" from page_view events
-- only — and page_view is emitted just on the therapist-directory pages. A
-- campaign landing anywhere else (homepage, quiz, an article) showed sessions
-- lower than its own profile-view count (e.g. g-howto: 1 "entry" but 4 profile
-- views). Count distinct session_id across ALL tracked patient activity with
-- that utm instead: analytics_events (minus recruit_page_view, which is
-- therapist-recruitment traffic), profile views (incl. match_card — the
-- session was active), and contact clicks (carry session_id since 20260713).
-- Same output shape as before.

create or replace function public.admin_campaign_funnel(p_since timestamptz default null)
returns json
language sql
stable
as $$
  with e as (
    select utm_campaign, count(distinct session_id) as n
    from (
      select utm_campaign, session_id
      from public.analytics_events
      where utm_campaign is not null and session_id is not null
        and event_type <> 'recruit_page_view'
        and (p_since is null or created_at >= p_since)
      union
      select utm_campaign, session_id
      from public.therapist_profile_views
      where utm_campaign is not null and session_id is not null
        and (p_since is null or viewed_at >= p_since)
      union
      select utm_campaign, session_id
      from public.therapist_contact_clicks
      where utm_campaign is not null and session_id is not null
        and (p_since is null or clicked_at >= p_since)
    ) s
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
           count(*) filter (where click_type = 'site_message')  as site_message,
           count(*) filter (where source = 'match')             as from_match,
           count(*) filter (where source = 'directory')         as from_directory
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
           coalesce(e.n, 0)              as sessions,
           coalesce(v.n, 0)              as viewed_profile,
           coalesce(c.total, 0)          as contacts,
           coalesce(c.whatsapp, 0)       as whatsapp,
           coalesce(c.phone, 0)          as phone,
           coalesce(c.email, 0)          as email,
           coalesce(c.site_message, 0)   as site_message,
           coalesce(c.from_match, 0)     as from_match,
           coalesce(c.from_directory, 0) as from_directory
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
