-- The profile form, the step between an account and a profile (11/10/2026).
--
-- A registrant who opens an account is sent straight to the profile form, and a
-- share of them never type a name there. The signups say how many stopped; nothing
-- said whether they saw the form and left it, or never got to it. One event, sent
-- when the form is shown to an account that has no profile yet:
--
--   recruit_profile_form_view   the profile form shown to a registrant with no name
--
-- One CHECK on the table, named valid_event_type (the one the nightly guard reads);
-- the list is app/lib/analytics-event-types.ts. Order matters: this runs BEFORE the
-- code that sends the event is deployed, because a row with a type the CHECK does
-- not know is rejected and /api/track answers 500.
alter table public.analytics_events drop constraint if exists analytics_events_event_type_check;
alter table public.analytics_events drop constraint if exists valid_event_type;
alter table public.analytics_events add constraint valid_event_type check (
  event_type in (
    'page_view','profile_impression','filter_used','quiz_step','quiz_complete',
    'quiz_treatments','recommendation_explain_click','match_free_fallback',
    'recruit_page_view','recruit_cta_click','recruit_register_view',
    'recruit_profile_form_view',
    'therapist_explain_click','matching_click',
    'match_search','match_results','match_saved',
    'center_page_view','center_website_click','center_contact_click'
  )
);

-- One more column on the campaign funnel: distinct sessions that were shown the
-- profile form (recruit_profile_form_view). Sessions, not events, like every other
-- step here. Everything else in this function is exactly as in
-- 20261008_campaign_funnel_recruit_steps.sql; the result is JSON, so a consumer
-- that does not know the new key simply ignores it.
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
  rc as (
    select utm_campaign, count(distinct session_id) as n
    from public.analytics_events
    where event_type = 'recruit_cta_click' and utm_campaign is not null and session_id is not null
      and (p_since is null or created_at >= p_since)
    group by utm_campaign
  ),
  rv as (
    select utm_campaign, count(distinct session_id) as n
    from public.analytics_events
    where event_type = 'recruit_register_view' and utm_campaign is not null and session_id is not null
      and (p_since is null or created_at >= p_since)
    group by utm_campaign
  ),
  rf as (
    select utm_campaign, count(distinct session_id) as n
    from public.analytics_events
    where event_type = 'recruit_profile_form_view' and utm_campaign is not null and session_id is not null
      and (p_since is null or created_at >= p_since)
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
           coalesce(c.from_profile, 0)   as from_profile,
           coalesce(rc.n, 0)             as recruit_cta_clicks,
           coalesce(rv.n, 0)             as recruit_register_views,
           coalesce(rf.n, 0)             as recruit_profile_form_views
    from keys k
    left join e on e.utm_campaign = k.utm_campaign
    left join s on s.utm_campaign = k.utm_campaign
    left join q on q.utm_campaign = k.utm_campaign
    left join v on v.utm_campaign = k.utm_campaign
    left join c on c.utm_campaign = k.utm_campaign
    left join rc on rc.utm_campaign = k.utm_campaign
    left join rv on rv.utm_campaign = k.utm_campaign
    left join rf on rf.utm_campaign = k.utm_campaign
    order by coalesce(c.total, 0) desc, coalesce(e.n, 0) desc
  )
  select coalesce((select json_agg(row_to_json(r)) from r), '[]'::json);
$$;

revoke all on function public.admin_campaign_funnel(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_campaign_funnel(timestamptz) to service_role;
