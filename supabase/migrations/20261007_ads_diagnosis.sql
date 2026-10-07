-- The ads agent learns to say WHY a campaign went cold, not only that it did.
--
-- Until now the engine (app/lib/ads-insights.ts) read two fixed windows from
-- ads_console_site_stats - 7 and 30 days - and that function counted contact
-- CLICKS, not people: a visitor who pressed WhatsApp three times was three
-- "contacts". On 7/10/2026 that made g-online read ₪16 per contact against ₪42
-- per person, and g-sharon ₪19 against ₪70.
--
-- Two read-only functions replace it:
--
--   ads_campaign_funnel_daily  one row per campaign, its site funnel by day.
--                              Every stage counts SESSIONS (people), so the
--                              engine can sum any window it needs: the last 7
--                              or 30 days, the dry spell since the last
--                              seeker, the baseline before it.
--
--   ads_campaign_profile       who the campaign's visitors are: where they
--                              land, which region they ask for in the quiz,
--                              adults or children, which treatments the quiz
--                              recommended to them. This is what the
--                              diagnosis compares against the promoted supply.
--
-- ads_console_site_stats is left in place on purpose: the deployed code calls
-- it until the new build is live, and dropping it would break the console in
-- between. Nothing reads it after that.
--
-- A session is attributed to the day of its first event, in Israel time - the
-- account's own clock, so a day here is the same day as in ads_campaign_daily.
-- Results come back as jsonb per campaign, not as one row per campaign-day:
-- 75 days x 12 campaigns is already 900 rows, and PostgREST caps a response
-- at 1000.

create or replace function ads_campaign_funnel_daily(p_days int)
returns table (utm_campaign text, days jsonb)
language sql
stable
security definer
set search_path = public
as $$
  with ev as (
    select session_id,
           max(utm_campaign) as utm,
           min(created_at) as first_at,
           bool_or(event_type = 'profile_impression') as cards,
           bool_or(event_type = 'quiz_step') as quiz_started,
           bool_or(event_type in ('quiz_complete', 'quiz_completed')) as quiz_done,
           bool_or(event_type = 'match_results') as results
    from analytics_events
    where channel = 'google_paid'
      and session_id is not null
      and created_at >= now() - make_interval(days => p_days)
    group by session_id
  ),
  s as (
    select coalesce(utm, '(ללא תיוג)') as camp,
           (first_at at time zone 'Asia/Jerusalem')::date as day,
           count(*) as sessions,
           count(*) filter (where cards) as saw_cards,
           count(*) filter (where quiz_started) as quiz_started,
           count(*) filter (where quiz_done) as quiz_done,
           count(*) filter (where results) as saw_results
    from ev
    group by 1, 2
  ),
  -- One row per person who pressed a contact button. Rows written before
  -- session ids existed have none; each of those counts as its own person.
  cs as (
    select coalesce(session_id, id::text) as sid,
           max(utm_campaign) as utm,
           min(clicked_at) as first_at,
           count(*) as clicks
    from therapist_contact_clicks
    where channel = 'google_paid'
      and clicked_at >= now() - make_interval(days => p_days)
    group by 1
  ),
  c as (
    select coalesce(utm, '(ללא תיוג)') as camp,
           (first_at at time zone 'Asia/Jerusalem')::date as day,
           count(*) as seekers,
           sum(clicks) as contact_clicks
    from cs
    group by 1, 2
  ),
  v as (
    select coalesce(utm_campaign, '(ללא תיוג)') as camp,
           (viewed_at at time zone 'Asia/Jerusalem')::date as day,
           count(*) as profile_views
    from therapist_profile_views
    where channel = 'google_paid'
      and viewed_at >= now() - make_interval(days => p_days)
    group by 1, 2
  ),
  keys as (
    select camp, day from s
    union
    select camp, day from c
    union
    select camp, day from v
  )
  select k.camp,
         jsonb_agg(
           jsonb_build_object(
             'd', k.day,
             's', coalesce(s.sessions, 0),
             'c', coalesce(s.saw_cards, 0),
             'qs', coalesce(s.quiz_started, 0),
             'qd', coalesce(s.quiz_done, 0),
             'r', coalesce(s.saw_results, 0),
             'pv', coalesce(v.profile_views, 0),
             'k', coalesce(c.seekers, 0),
             'cl', coalesce(c.contact_clicks, 0)
           )
           order by k.day
         )
  from keys k
  left join s on s.camp = k.camp and s.day = k.day
  left join c on c.camp = k.camp and c.day = k.day
  left join v on v.camp = k.camp and v.day = k.day
  group by k.camp;
$$;

create or replace function ads_campaign_profile(p_days int)
returns table (
  utm_campaign text,
  landing jsonb,
  regions jsonb,
  searches jsonb,
  quiz_types jsonb,
  treatment_sessions bigint,
  treatments jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select session_id, utm_campaign, event_type, metadata, created_at
    from analytics_events
    where channel = 'google_paid'
      and session_id is not null
      and utm_campaign is not null
      and created_at >= now() - make_interval(days => p_days)
      and event_type in ('page_view', 'match_search', 'quiz_complete', 'quiz_completed', 'quiz_treatments')
  ),
  -- The page a visit started on: the first page_view of the session.
  landing_first as (
    select distinct on (session_id) session_id, utm_campaign, metadata->>'page' as page
    from base
    where event_type = 'page_view'
    order by session_id, created_at
  ),
  landing_counts as (
    select utm_campaign, page, count(*) as n
    from landing_first
    where page is not null
    group by 1, 2
  ),
  region_counts as (
    select utm_campaign, metadata->>'region' as region, count(distinct session_id) as n
    from base
    where event_type = 'match_search' and coalesce(metadata->>'region', '') <> ''
    group by 1, 2
  ),
  search_counts as (
    select utm_campaign,
           count(distinct session_id) as n,
           count(distinct session_id) filter (
             where coalesce(metadata->>'region', '') = '' and coalesce(metadata->>'city', '') = ''
           ) as no_place
    from base
    where event_type = 'match_search'
    group by 1
  ),
  quiz_counts as (
    select utm_campaign, coalesce(metadata->>'quiz_type', '?') as quiz_type, count(distinct session_id) as n
    from base
    where event_type in ('quiz_complete', 'quiz_completed')
    group by 1, 2
  ),
  treatment_session_counts as (
    select utm_campaign, count(distinct session_id) as n
    from base
    where event_type = 'quiz_treatments'
    group by 1
  ),
  treatment_counts as (
    select b.utm_campaign, t.value as treatment, count(distinct b.session_id) as n
    from base b
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(b.metadata->'treatments') = 'array' then b.metadata->'treatments' else '[]'::jsonb end
    ) as t(value)
    where b.event_type = 'quiz_treatments'
    group by 1, 2
  ),
  camps as (
    select distinct utm_campaign from base
  )
  select c.utm_campaign,
         (select jsonb_agg(jsonb_build_object('page', x.page, 'n', x.n) order by x.n desc)
            from (select page, n from landing_counts l where l.utm_campaign = c.utm_campaign order by n desc limit 6) x),
         (select jsonb_agg(jsonb_build_object('region', x.region, 'n', x.n) order by x.n desc)
            from (select region, n from region_counts r where r.utm_campaign = c.utm_campaign order by n desc limit 6) x),
         (select jsonb_build_object('n', s.n, 'no_place', s.no_place) from search_counts s where s.utm_campaign = c.utm_campaign),
         (select jsonb_object_agg(q.quiz_type, q.n) from quiz_counts q where q.utm_campaign = c.utm_campaign),
         coalesce((select ts.n from treatment_session_counts ts where ts.utm_campaign = c.utm_campaign), 0),
         (select jsonb_agg(jsonb_build_object('t', x.treatment, 'n', x.n) order by x.n desc)
            from (select treatment, n from treatment_counts t2 where t2.utm_campaign = c.utm_campaign order by n desc limit 8) x)
  from camps c;
$$;

revoke execute on function ads_campaign_funnel_daily(int) from public, anon, authenticated;
revoke execute on function ads_campaign_profile(int) from public, anon, authenticated;
grant execute on function ads_campaign_funnel_daily(int) to service_role;
grant execute on function ads_campaign_profile(int) to service_role;
