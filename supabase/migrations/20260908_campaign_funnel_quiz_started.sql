-- Add "quiz_started" to the campaign funnel: distinct sessions that reached
-- the opening screen of either questionnaire ("disclaimer" for adults,
-- "p-consent" for kids).
--
-- The Taboola native test (8-21/9/2026) is judged on questionnaire STARTS per
-- landing page, not completions - completions are too few to separate two
-- arms in two weeks. The funnel only had quiz_completed, so the deciding
-- number lived in ad-hoc SQL. Distinct sessions, not events: the opening
-- screen re-mounts on every back-navigation and writes a fresh quiz_step row.

create or replace function public.admin_campaign_funnel(p_since timestamptz default null)
returns json
language sql
stable
as $$
  with e as (
    select utm_campaign, count(distinct session_id) as n
    from public.analytics_events
    where utm_campaign is not null and session_id is not null
      and (p_since is null or created_at >= p_since)
    group by utm_campaign
  ),
  s as (
    select utm_campaign, count(distinct session_id) as n
    from public.analytics_events
    where event_type = 'quiz_step' and utm_campaign is not null and session_id is not null
      and metadata->>'step' in ('disclaimer', 'p-consent')
      and (p_since is null or created_at >= p_since)
    group by utm_campaign
  ),
  q as (
    select utm_campaign, count(distinct session_id) as n
    from public.analytics_events
    where event_type = 'quiz_complete' and utm_campaign is not null
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
           -- unique PEOPLE, not clicks: one enthusiastic visitor clicking
           -- whatsapp+phone 5 times is 1 lead, not 5. Null-session rows each
           -- count as their own person (can't be joined to anyone).
           count(distinct coalesce(session_id, id::text)) as people,
           count(*) filter (where click_type = 'whatsapp')      as whatsapp,
           count(*) filter (where click_type = 'phone')         as phone,
           count(*) filter (where click_type = 'email')         as email,
           count(*) filter (where click_type = 'site_message')  as site_message,
           count(*) filter (where source = 'match')             as from_match,
           count(*) filter (where source = 'directory')         as from_directory,
           count(*) filter (where source = 'profile')           as from_profile
    from public.therapist_contact_clicks
    where utm_campaign is not null
      and (p_since is null or clicked_at >= p_since)
    group by utm_campaign
  ),
  keys as (
    select utm_campaign from e
    union select utm_campaign from s
    union select utm_campaign from q
    union select utm_campaign from v
    union select utm_campaign from c
  ),
  r as (
    select k.utm_campaign as campaign,
           coalesce(e.n, 0)              as sessions,
           coalesce(s.n, 0)              as quiz_started,
           coalesce(q.n, 0)              as quiz_completed,
           coalesce(v.n, 0)              as viewed_profile,
           coalesce(c.total, 0)          as contacts,
           coalesce(c.people, 0)         as contacting_people,
           coalesce(c.whatsapp, 0)       as whatsapp,
           coalesce(c.phone, 0)          as phone,
           coalesce(c.email, 0)          as email,
           coalesce(c.site_message, 0)   as site_message,
           coalesce(c.from_match, 0)     as from_match,
           coalesce(c.from_directory, 0) as from_directory,
           coalesce(c.from_profile, 0)   as from_profile
    from keys k
    left join e on e.utm_campaign = k.utm_campaign
    left join s on s.utm_campaign = k.utm_campaign
    left join q on q.utm_campaign = k.utm_campaign
    left join v on v.utm_campaign = k.utm_campaign
    left join c on c.utm_campaign = k.utm_campaign
    order by coalesce(c.total, 0) desc, coalesce(e.n, 0) desc
  )
  select coalesce((select json_agg(row_to_json(r)) from r), '[]'::json);
$$;

revoke all on function public.admin_campaign_funnel(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_campaign_funnel(timestamptz) to service_role;
