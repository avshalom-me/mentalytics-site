-- Ads console: a read-only Google Ads cockpit inside the admin.
--
-- Phase 0: ads_campaign_registry - hand-maintained facts Google's UI buries
-- (budget type, end date, CPC cap, the utm_campaign a campaign tags). These
-- power deadline/pace alerts with no integration at all.
--
-- Phase 1: ads_* stat tables fed nightly by a Google Ads Script that POSTs
-- to /api/ads-sync. The trust direction is deliberate: no Google credential
-- ever lives on our side - the script holds one write-only shared secret.
--
-- Registry names vs tags: a campaign's Google name may carry a digit suffix
-- (g-sharon1) while its Final URL suffix tags the undigited form (g-sharon).
-- The name avoids collisions with wrecked creation-wizard drafts; the tag
-- keeps admin history continuous. Never force them to agree.

create table if not exists ads_campaign_registry (
  id uuid primary key default gen_random_uuid(),
  google_name text not null unique,
  utm_campaign text,
  budget_type text not null default 'daily' check (budget_type in ('daily','total')),
  budget_amount numeric,
  end_date date,
  cpc_cap numeric,
  active boolean not null default true,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists ads_campaign_daily (
  date date not null,
  campaign_id bigint not null,
  campaign_name text not null,
  impressions integer not null default 0,
  clicks integer not null default 0,
  cost numeric not null default 0,
  conversions numeric not null default 0,
  primary key (date, campaign_id)
);

-- Config snapshot, replaced on every sync. cpc_ceiling comes from
-- campaign.target_spend (Maximize clicks); null = no cap saved, which is
-- exactly the g-hadera/g-online failure mode the console must surface.
create table if not exists ads_campaign_config (
  campaign_id bigint primary key,
  campaign_name text not null,
  status text,
  end_date date,
  daily_budget numeric,
  total_budget numeric,
  bidding_strategy text,
  cpc_ceiling numeric,
  synced_at timestamptz not null default now()
);

create table if not exists ads_keyword_daily (
  date date not null,
  campaign_name text not null,
  ad_group text not null,
  keyword text not null,
  match_type text,
  impressions integer not null default 0,
  clicks integer not null default 0,
  cost numeric not null default 0,
  primary key (date, campaign_name, ad_group, keyword)
);

create table if not exists ads_keyword_status (
  campaign_name text not null,
  ad_group text not null,
  keyword text not null,
  match_type text,
  status text,
  serving_status text,
  synced_at timestamptz not null default now(),
  primary key (campaign_name, ad_group, keyword)
);

create table if not exists ads_search_term_daily (
  date date not null,
  campaign_name text not null,
  term text not null,
  impressions integer not null default 0,
  clicks integer not null default 0,
  cost numeric not null default 0,
  primary key (date, campaign_name, term)
);

create table if not exists ads_sync_log (
  id bigint generated always as identity primary key,
  synced_at timestamptz not null default now(),
  summary jsonb
);

-- Service-role only: these tables are written by /api/ads-sync and read by
-- /api/admin-ads-console, both via the service key. Nothing client-facing.
alter table ads_campaign_registry enable row level security;
alter table ads_campaign_daily enable row level security;
alter table ads_campaign_config enable row level security;
alter table ads_keyword_daily enable row level security;
alter table ads_keyword_status enable row level security;
alter table ads_search_term_daily enable row level security;
alter table ads_sync_log enable row level security;

revoke all on ads_campaign_registry, ads_campaign_daily, ads_campaign_config,
  ads_keyword_daily, ads_keyword_status, ads_search_term_daily, ads_sync_log
  from anon, authenticated;
grant all on ads_campaign_registry, ads_campaign_daily, ads_campaign_config,
  ads_keyword_daily, ads_keyword_status, ads_search_term_daily, ads_sync_log
  to service_role;

-- Site-side funnel per campaign, aggregated in SQL so the 1000-row PostgREST
-- cap never bites (analytics_events alone is ~22k rows/30d for google_paid).
-- A null utm_campaign is returned as '(ללא תיוג)' - growth in that bucket
-- means a campaign is spending with a swallowed Final URL suffix.
create or replace function ads_console_site_stats(p_days int)
returns table(utm_campaign text, sessions bigint, quiz_completes bigint, profile_views bigint, contacts bigint)
language sql
security definer
set search_path = public
as $$
  with e as (
    select coalesce(utm_campaign, '(ללא תיוג)') as camp, session_id, event_type
    from analytics_events
    where channel = 'google_paid'
      and created_at >= now() - make_interval(days => p_days)
  ),
  s as (
    select camp,
           count(distinct session_id) as sessions,
           count(*) filter (where event_type in ('quiz_complete','quiz_completed')) as quiz
    from e group by 1
  ),
  v as (
    select coalesce(utm_campaign, '(ללא תיוג)') as camp, count(*) as pv
    from therapist_profile_views
    where channel = 'google_paid'
      and viewed_at >= now() - make_interval(days => p_days)
    group by 1
  ),
  c as (
    select coalesce(utm_campaign, '(ללא תיוג)') as camp, count(*) as ct
    from therapist_contact_clicks
    where channel = 'google_paid'
      and clicked_at >= now() - make_interval(days => p_days)
    group by 1
  )
  select coalesce(s.camp, v.camp, c.camp),
         coalesce(s.sessions, 0), coalesce(s.quiz, 0),
         coalesce(v.pv, 0), coalesce(c.ct, 0)
  from s
  full join v on v.camp = s.camp
  full join c on c.camp = coalesce(s.camp, v.camp);
$$;

revoke execute on function ads_console_site_stats(int) from public, anon, authenticated;
grant execute on function ads_console_site_stats(int) to service_role;

-- Seed the registry with what two months of hands-on work established.
-- Unknowns stay null with a note - the console UI edits them in place.
insert into ads_campaign_registry (google_name, utm_campaign, budget_type, budget_amount, end_date, cpc_cap, notes) values
  ('Website traffic-Search-telaviv', 'g-telaviv', 'total', 2000, '2026-08-31', null,
   'בתהליך הארכה: תקרת 90 יום מגבילה ל-7/10/26 עם ₪3,400. לעדכן כאן אחרי הביצוע. לתכנן מעבר לתקציב יומי לפני 7/10.'),
  ('Website traffic-Search-jerusalem', 'g-jerusalem', 'daily', 25, null, null,
   'Limited by bid strategy - התקרה נמוכה מדי ומפסידה חשיפות. לשקול העלאה.'),
  ('g-sharon1', 'g-sharon', 'daily', 27, null, 7, null),
  ('Search-patients', 'g-online', 'daily', 25, null, 7,
   'תקרת ₪7 והורדה ל-₪25 נקבעו 28/8/26. לעקוב אחרי Impr. share שבוע - אם צנח, להעלות תקרה ל-₪10.'),
  ('g-haifa', 'g-haifa', 'daily', null, null, null,
   'להשלים תקציב ותקרה מהממשק. 13 מילות מפתח חסרות כולל כל מונחי ה-CBT.'),
  ('g-kids-center', 'g-kids-center', 'daily', null, null, null,
   'להשלים תקציב. מועמד להרחבה להוד השרון/ראש העין/אריאל (חבצלת לרנר מלין).'),
  ('g-north-sharon1', 'g-north-sharon', 'daily', 15, null, 7,
   'נצפה CPC ‏₪8.17 ב-28/8 - לוודא שתקרת ה-₪7 באמת נשמרה בהגדרות.'),
  ('g-emek1', 'g-emek', 'daily', 20, null, 7,
   'CTR ‏0.91% - לוודא שהמיקוד הוא 4 ערים בלבד ולא נפת יזרעאל כולה. מרכז שדות: חיוב מ-17/10.')
on conflict (google_name) do nothing;
