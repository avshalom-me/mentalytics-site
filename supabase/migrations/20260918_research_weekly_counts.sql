-- Suicidality findings are kept as general information only
-- =========================================================
-- Decision (18/9/2026): a suicidality finding is never stored against a visitor.
-- Per visitor it is pooled into the generic emotional finding; that it occurred
-- at all survives only as a weekly count with nothing attached to it.
--
-- Where it had been landing, per session:
--   1. therapist_profile_views.viewer_symptom - the adults questionnaire put the
--      finding text in the profile URL (?sy=), and from there it was stored next
--      to age band, gender, region and campaign. The same column feeds the
--      therapist dashboard's "what led them to you" breakdown.
--   2. analytics_events (recommendation_explain_click).metadata.urgent - four of
--      the five urgent adult findings are suicidality, so the flag marked it in
--      everything but name.
-- The application stops writing both (app/lib/sensitive-findings.ts); this
-- migration applies the same decision to the rows already there.

-- ── 1. The general-information store ─────────────────────────────────────────
-- No session, no timestamp, no demographics: a row cannot be tied back to a
-- questionnaire, and there is deliberately no updated_at for the same reason -
-- a precise write time could be lined up against quiz_complete events.
create table if not exists public.research_weekly_counts (
  week_start date    not null,              -- Monday of the week, Asia/Jerusalem
  quiz_type  text    not null check (quiz_type in ('adults', 'kids')),
  metric     text    not null,
  n          integer not null default 0 check (n >= 0),
  primary key (week_start, quiz_type, metric)
);

comment on table public.research_weekly_counts is
  'Questionnaire facts kept only in aggregate (e.g. suicidality flags). Counts scorings, not sessions; pair every numerator with the "scored" metric of the same week. Readers must suppress rates where scored < 10.';

alter table public.research_weekly_counts enable row level security;
-- No policies on purpose: only service_role (which bypasses RLS) touches this.
revoke all on public.research_weekly_counts from anon, authenticated;
grant select, insert, update on public.research_weekly_counts to service_role;

create or replace function public.bump_research_count(p_quiz_type text, p_metric text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.research_weekly_counts (week_start, quiz_type, metric, n)
  values (date_trunc('week', now() at time zone 'Asia/Jerusalem')::date, p_quiz_type, p_metric, 1)
  on conflict (week_start, quiz_type, metric)
  do update set n = public.research_weekly_counts.n + 1;
$$;

revoke all on function public.bump_research_count(text, text) from public, anon, authenticated;
grant execute on function public.bump_research_count(text, text) to service_role;

-- ── 2. Keep what the old rows say, in aggregate, before pooling them ─────────
-- These are NOT the same measure as the live "suicidality" metric and must not
-- be added to it: they count visitors who opened a therapist profile (or an
-- explanation) from an urgent recommendation - a self-selected subset - whereas
-- the live metric counts every scored questionnaire. Hence the _legacy names.
-- `set n = excluded.n` (not +) keeps the migration safe to re-run.
insert into public.research_weekly_counts (week_start, quiz_type, metric, n)
select date_trunc('week', viewed_at at time zone 'Asia/Jerusalem')::date,
       'adults',                                   -- only the adults flow ever sent ?sy=
       'suicidality_profile_open_legacy',
       count(distinct session_id)
  from public.therapist_profile_views
 where viewer_symptom like '%אובדנ%'
 group by 1
on conflict (week_start, quiz_type, metric) do update set n = excluded.n;

insert into public.research_weekly_counts (week_start, quiz_type, metric, n)
select date_trunc('week', created_at at time zone 'Asia/Jerusalem')::date,
       case when metadata->>'questionnaire_type' = 'child' then 'kids' else 'adults' end,
       'urgent_explain_click_legacy',
       count(distinct session_id)
  from public.analytics_events
 where event_type = 'recommendation_explain_click'
   and metadata->>'urgent' = 'true'
 group by 1, 2
on conflict (week_start, quiz_type, metric) do update set n = excluded.n;

-- ── 3. Pool the existing per-visitor records ────────────────────────────────
-- The label is an existing finding of the adults scorer, not a new phrase: a
-- label reserved for suicidality would be recoverable by exclusion.
update public.therapist_profile_views
   set viewer_symptom = 'נמצאו סימנים כלליים בתחום הרגשי.'
 where viewer_symptom like '%אובדנ%';

-- The key goes from EVERY explain-click row, not only the true ones: removing
-- it selectively would leave "has no urgent key" meaning exactly "was urgent".
update public.analytics_events
   set metadata = metadata - 'urgent'
 where event_type = 'recommendation_explain_click'
   and metadata ? 'urgent';
