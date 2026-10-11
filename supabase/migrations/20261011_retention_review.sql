-- The weekly therapist-retention review (docs/agents/retention-agent-plan.md).
--
-- Two tables hold the snapshot the Sunday run produces - one row per review
-- week, one row per promoted therapist in it - so the admin page, the Sunday
-- pop-up and "what changed since last week" read a stored picture instead of
-- each recomputing their own. Rows carry the funnel numbers, the flags and
-- the suggested actions as jsonb; the actions that need a click also live in
-- agent_actions, where the click handlers find them.
--
-- Two read-only functions feed the engine:
--
--   retention_therapist_funnel   one row per therapist with any activity in
--                                the last 2*p_days: quiz-result cards, list
--                                impressions, profile opens and contacts, the
--                                last p_days against the p_days before them.
--                                Contacts are PEOPLE (one per session), not
--                                clicks, and automated clicks are left out.
--
--   retention_region_demand      quiz searches per region, how many of them
--                                asked for online, and which treatments the
--                                quiz recommended to the same sessions - the
--                                demand a therapist's profile is measured
--                                against.

create table if not exists public.retention_reviews (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  created_at timestamptz not null default now(),
  run_id uuid,
  summary jsonb not null default '{}'::jsonb,
  narrative text,
  acknowledged_at timestamptz,
  acknowledged_by text
);

create table if not exists public.retention_review_rows (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.retention_reviews(id) on delete cascade,
  therapist_id uuid not null,
  name text,
  tier text not null,
  risk text not null,
  promotion_source text,
  metrics jsonb not null default '{}'::jsonb,
  flags jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  primary_action text,
  risk_reason text,
  created_at timestamptz not null default now()
);

create index if not exists retention_review_rows_review_idx on public.retention_review_rows(review_id);
create index if not exists retention_review_rows_therapist_idx on public.retention_review_rows(therapist_id, created_at desc);

alter table public.retention_reviews enable row level security;
alter table public.retention_review_rows enable row level security;
grant select, insert, update, delete on public.retention_reviews to service_role;
grant select, insert, update, delete on public.retention_review_rows to service_role;

create or replace function retention_therapist_funnel(p_days int)
returns table (
  therapist_id uuid,
  cards_cur int,
  cards_prev int,
  list_cur int,
  list_prev int,
  opens_cur int,
  opens_prev int,
  people_cur int,
  people_prev int,
  people_21 int,
  people_14 int,
  certain_cur int,
  clicks_cur int,
  paid_people_cur int,
  paid_cards_cur int,
  avg_score_cur numeric,
  last_contact_at timestamptz,
  first_card_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with v as (
    select pv.therapist_id,
           count(*) filter (where pv.source = 'match_card' and pv.viewed_at >= now() - make_interval(days => p_days)) as cards_cur,
           count(*) filter (where pv.source = 'match_card' and pv.viewed_at < now() - make_interval(days => p_days)) as cards_prev,
           count(*) filter (where pv.source in ('match', 'directory', 'profile') and pv.viewed_at >= now() - make_interval(days => p_days)) as opens_cur,
           count(*) filter (where pv.source in ('match', 'directory', 'profile') and pv.viewed_at < now() - make_interval(days => p_days)) as opens_prev,
           count(*) filter (where pv.source = 'match_card' and pv.channel like '%\_paid' and pv.viewed_at >= now() - make_interval(days => p_days)) as paid_cards_cur,
           avg(pv.match_score) filter (where pv.source = 'match_card' and pv.viewed_at >= now() - make_interval(days => p_days)) as avg_score_cur
    from therapist_profile_views pv
    where pv.viewed_at >= now() - make_interval(days => 2 * p_days)
    group by pv.therapist_id
  ),
  fc as (
    select pv.therapist_id, min(pv.viewed_at) as first_card_at
    from therapist_profile_views pv
    where pv.source = 'match_card'
    group by pv.therapist_id
  ),
  l as (
    select ae.therapist_id,
           count(*) filter (where ae.created_at >= now() - make_interval(days => p_days)) as list_cur,
           count(*) filter (where ae.created_at < now() - make_interval(days => p_days)) as list_prev
    from analytics_events ae
    where ae.event_type = 'profile_impression'
      and ae.therapist_id is not null
      and ae.created_at >= now() - make_interval(days => 2 * p_days)
    group by ae.therapist_id
  ),
  -- One row per person who pressed a contact button: a session is a person;
  -- rows written before session ids existed each count as their own person.
  c as (
    select cc.therapist_id,
           coalesce(cc.session_id, cc.id::text) as sid,
           min(cc.clicked_at) as first_at,
           bool_or(cc.click_type = 'site_message') as certain,
           bool_or(cc.channel like '%\_paid') as paid,
           count(*) as clicks
    from therapist_contact_clicks cc
    where cc.clicked_at >= now() - make_interval(days => 2 * p_days)
      and coalesce(cc.automated, false) = false
    group by 1, 2
  ),
  p as (
    select c.therapist_id,
           count(*) filter (where c.first_at >= now() - make_interval(days => p_days)) as people_cur,
           count(*) filter (where c.first_at < now() - make_interval(days => p_days)) as people_prev,
           count(*) filter (where c.first_at >= now() - interval '21 days') as people_21,
           count(*) filter (where c.first_at >= now() - interval '14 days') as people_14,
           count(*) filter (where c.certain and c.first_at >= now() - make_interval(days => p_days)) as certain_cur,
           coalesce(sum(c.clicks) filter (where c.first_at >= now() - make_interval(days => p_days)), 0) as clicks_cur,
           count(*) filter (where c.paid and c.first_at >= now() - make_interval(days => p_days)) as paid_people_cur
    from c
    group by c.therapist_id
  ),
  lc as (
    select cc.therapist_id, max(cc.clicked_at) as last_contact_at
    from therapist_contact_clicks cc
    where coalesce(cc.automated, false) = false
    group by cc.therapist_id
  ),
  ids as (
    select v.therapist_id from v
    union select l.therapist_id from l
    union select p.therapist_id from p
    union select lc.therapist_id from lc
    union select fc.therapist_id from fc
  )
  select ids.therapist_id,
         coalesce(v.cards_cur, 0)::int,
         coalesce(v.cards_prev, 0)::int,
         coalesce(l.list_cur, 0)::int,
         coalesce(l.list_prev, 0)::int,
         coalesce(v.opens_cur, 0)::int,
         coalesce(v.opens_prev, 0)::int,
         coalesce(p.people_cur, 0)::int,
         coalesce(p.people_prev, 0)::int,
         coalesce(p.people_21, 0)::int,
         coalesce(p.people_14, 0)::int,
         coalesce(p.certain_cur, 0)::int,
         coalesce(p.clicks_cur, 0)::int,
         coalesce(p.paid_people_cur, 0)::int,
         coalesce(v.paid_cards_cur, 0)::int,
         v.avg_score_cur,
         lc.last_contact_at,
         fc.first_card_at
  from ids
  left join v on v.therapist_id = ids.therapist_id
  left join l on l.therapist_id = ids.therapist_id
  left join p on p.therapist_id = ids.therapist_id
  left join lc on lc.therapist_id = ids.therapist_id
  left join fc on fc.therapist_id = ids.therapist_id;
$$;

create or replace function retention_region_demand(p_days int)
returns table (
  region text,
  searches bigint,
  online_searches bigint,
  treatment_sessions bigint,
  treatments jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with ms as (
    select ae.id, ae.session_id, ae.created_at,
           nullif(ae.metadata->>'region', '') as region,
           coalesce(ae.metadata->>'online', '') in ('true', '1') as online
    from analytics_events ae
    where ae.event_type = 'match_search'
      and ae.created_at >= now() - make_interval(days => p_days)
  ),
  sr as (
    select coalesce(ms.region, '(ללא אזור)') as region,
           count(distinct coalesce(ms.session_id, ms.id::text)) as searches,
           count(distinct coalesce(ms.session_id, ms.id::text)) filter (where ms.online) as online_searches
    from ms
    group by 1
  ),
  -- The region a session asked for last, for joining the quiz's treatments to it.
  sess_region as (
    select distinct on (ms.session_id) ms.session_id, ms.region
    from ms
    where ms.session_id is not null
    order by ms.session_id, ms.created_at desc
  ),
  qt as (
    select ae.session_id, ae.metadata->'treatments' as treatments
    from analytics_events ae
    where ae.event_type = 'quiz_treatments'
      and ae.session_id is not null
      and ae.created_at >= now() - make_interval(days => p_days)
      and jsonb_typeof(ae.metadata->'treatments') = 'array'
  ),
  ts as (
    select coalesce(s.region, '(ללא אזור)') as region, count(distinct qt.session_id) as n
    from qt
    join sess_region s on s.session_id = qt.session_id
    group by 1
  ),
  tr as (
    select coalesce(s.region, '(ללא אזור)') as region, t.value as treatment, count(distinct qt.session_id) as n
    from qt
    join sess_region s on s.session_id = qt.session_id
    cross join lateral jsonb_array_elements_text(qt.treatments) as t(value)
    group by 1, 2
  )
  select sr.region,
         sr.searches,
         sr.online_searches,
         coalesce(ts.n, 0),
         (select jsonb_agg(jsonb_build_object('t', x.treatment, 'n', x.n) order by x.n desc)
            from (select tr.treatment, tr.n from tr where tr.region = sr.region order by tr.n desc limit 10) x)
  from sr
  left join ts on ts.region = sr.region;
$$;

revoke execute on function retention_therapist_funnel(int) from public, anon, authenticated;
revoke execute on function retention_region_demand(int) from public, anon, authenticated;
grant execute on function retention_therapist_funnel(int) to service_role;
grant execute on function retention_region_demand(int) to service_role;
