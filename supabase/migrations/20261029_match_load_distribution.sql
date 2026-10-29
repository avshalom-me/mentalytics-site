-- Spreading the quiz contacts among promoted therapists (owner, 29/10/2026):
-- a few promoted therapists received most of the contacts (top 10 of 91 took
-- 48% in 30 days, 35% got none). Two mechanisms read these functions:
--
-- 1. match_contact_load: how many distinct people contacted each therapist in
--    the trailing window. /api/match reads it on every request and hides a
--    loaded paying therapist from the quiz results (app/lib/match-load-shedding.ts).
--    One aggregate query instead of fetching the click rows: the 14-day table
--    is small today, but a count belongs in the database (REVIEW.md, section 5).
--
-- 2. admin_match_distribution + admin_match_distribution_regions: the
--    "חלוקת הפניות" rubric in the admin (app/lib/match-distribution.ts), per
--    promoted therapist and per search region, for the window and the one
--    before it, so the effect of the shedding can be read before/after.
--
-- All three are read-only. service_role only, like the other admin RPCs.

create or replace function public.match_contact_load(p_days integer)
returns table(therapist_id uuid, people bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.therapist_id, count(distinct c.session_id)
  from therapist_contact_clicks c
  where c.clicked_at >= now() - make_interval(days => p_days)
    and coalesce(c.automated, false) = false
    and c.session_id is not null
  group by c.therapist_id;
$$;

create or replace function public.admin_match_distribution(p_days integer)
returns table(
  therapist_id uuid,
  people bigint,
  people_prev bigint,
  match_people bigint,
  appearances bigint,
  appearances_prev bigint,
  opens bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with w as (
    select now() - make_interval(days => p_days) as s,
           now() - make_interval(days => 2 * p_days) as s2
  ),
  c as (
    select k.therapist_id,
      count(distinct k.session_id) filter (where k.clicked_at >= w.s) as people,
      count(distinct k.session_id) filter (where k.clicked_at < w.s) as people_prev,
      count(distinct k.session_id) filter (where k.clicked_at >= w.s and k.source = 'match') as match_people
    from therapist_contact_clicks k, w
    where k.clicked_at >= w.s2
      and coalesce(k.automated, false) = false
      and k.session_id is not null
    group by k.therapist_id
  ),
  v as (
    select p.therapist_id,
      count(*) filter (where p.viewed_at >= w.s and p.source = 'match_card') as appearances,
      count(*) filter (where p.viewed_at < w.s and p.source = 'match_card') as appearances_prev,
      count(*) filter (where p.viewed_at >= w.s and p.source = 'match') as opens
    from therapist_profile_views p, w
    where p.viewed_at >= w.s2 and p.source in ('match_card', 'match')
    group by p.therapist_id
  )
  select coalesce(c.therapist_id, v.therapist_id),
    coalesce(c.people, 0), coalesce(c.people_prev, 0), coalesce(c.match_people, 0),
    coalesce(v.appearances, 0), coalesce(v.appearances_prev, 0), coalesce(v.opens, 0)
  from c
  full outer join v on v.therapist_id = c.therapist_id;
$$;

-- Per search region (the region the patient asked for, as match_search stored
-- it): how many searched, how many then contacted a promoted therapist from
-- the results, and how concentrated those contacts were.
create or replace function public.admin_match_distribution_regions(p_days integer)
returns table(
  region text,
  searches bigint,
  people bigint,
  therapists_with_contacts bigint,
  top1 bigint,
  top3 bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with w as (select now() - make_interval(days => p_days) as s),
  srch as (
    select distinct on (e.session_id) e.session_id,
      coalesce(
        e.metadata->>'region',
        case when (e.metadata->>'online')::boolean then 'אונליין' end,
        '(ללא אזור)'
      ) as region
    from analytics_events e, w
    where e.event_type = 'match_search' and e.created_at >= w.s and e.session_id is not null
    order by e.session_id, e.created_at desc
  ),
  mc as (
    select k.therapist_id, k.session_id
    from therapist_contact_clicks k, w
    where k.clicked_at >= w.s
      and coalesce(k.automated, false) = false
      and k.source = 'match'
      and k.session_id is not null
    group by 1, 2
  ),
  per as (
    select s.region, m.therapist_id, count(*) as people
    from mc m join srch s on s.session_id = m.session_id
    group by 1, 2
  ),
  ranked as (
    select per.region, per.people, row_number() over (partition by per.region order by per.people desc) as rn
    from per
  ),
  sc as (select srch.region, count(*) as searches from srch group by 1)
  select sc.region, sc.searches,
    coalesce((select sum(per.people) from per where per.region = sc.region), 0)::bigint,
    coalesce((select count(*) from per where per.region = sc.region), 0)::bigint,
    coalesce((select ranked.people from ranked where ranked.region = sc.region and ranked.rn = 1), 0)::bigint,
    coalesce((select sum(ranked.people) from ranked where ranked.region = sc.region and ranked.rn <= 3), 0)::bigint
  from sc
  order by sc.searches desc;
$$;

revoke all on function public.match_contact_load(integer) from public, anon, authenticated;
revoke all on function public.admin_match_distribution(integer) from public, anon, authenticated;
revoke all on function public.admin_match_distribution_regions(integer) from public, anon, authenticated;
grant execute on function public.match_contact_load(integer) to service_role;
grant execute on function public.admin_match_distribution(integer) to service_role;
grant execute on function public.admin_match_distribution_regions(integer) to service_role;

-- match_load_shed: a search in which a loaded paying therapist was hidden
-- (written by /api/match only). The list is written in full on purpose, like
-- every earlier extension: DROP removes the previous list. Source of truth:
-- app/lib/analytics-event-types.ts. The constraint is named valid_event_type
-- (the only one left since 20260830).
alter table public.analytics_events drop constraint if exists valid_event_type;

alter table public.analytics_events add constraint valid_event_type check (
  event_type in (
    'page_view',
    'profile_impression',
    'filter_used',
    'quiz_step',
    'quiz_complete',
    'quiz_treatments',
    'recommendation_explain_click',
    'match_free_fallback',
    'recruit_page_view',
    'recruit_cta_click',
    'recruit_register_view',
    'recruit_profile_form_view',
    'therapist_explain_click',
    'matching_click',
    'match_search',
    'match_results',
    'match_load_shed',
    'match_saved',
    'center_page_view',
    'center_website_click',
    'center_contact_click'
  )
);
