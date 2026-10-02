-- ענף המורים, שלב ב' (2/10/2026): המודל שהבעלים אישר, וההקשחות מהמעבר השני.
--
-- המודל: ניסיון של 90 יום בלי תשלום ובלי כרטיס. ביום ה-85 מייל להרשמה,
-- ביום האחרון מייל נוסף, ולמחרת הפרופיל עובר לארכיון ויוצא מהמאגר. לכן
-- 'expired' הופך ל-'archived', ונוספות חותמות לשני המיילים.
--
-- אידמפוטנטי: אפשר להריץ שוב, גם אחרי 20261002_teachers.sql וגם לבד אחריו.

-- ── מצבי הרישום ─────────────────────────────────────────────────────────────
-- 'paused' מעולם לא נכתב (ההקפאה היא paused_until), ו-'expired' נקרא מעכשיו
-- 'archived' - המילה שהבעלים משתמש בה, ושמופיעה באדמין.
alter table public.teachers drop constraint if exists teachers_listing_state_check;
update public.teachers set listing_state = 'archived' where listing_state = 'expired';
update public.teachers set listing_state = 'trial' where listing_state = 'paused';
alter table public.teachers add constraint teachers_listing_state_check
  check (listing_state in ('pending', 'trial', 'paying', 'archived', 'rejected'));

alter table public.teachers add column if not exists archived_at timestamptz;
-- המייל של היום האחרון (המייל של יום 85 נשאר ב-trial_ending_notified_at).
alter table public.teachers add column if not exists trial_last_day_notified_at timestamptz;
alter table public.teachers drop column if exists trial_expired_notified_at;
-- מתי אומתה הוראת הקבע מול Sumit לאחרונה (פעם בחודש לכל מורה, לא כל יום).
alter table public.teachers add column if not exists sumit_verified_at timestamptz;
-- מתי נשלח לאחרונה הקישור האישי לבקשת המורה (פעם ביממה לכל היותר).
alter table public.teachers add column if not exists link_sent_at timestamptz;
-- האם ומתי נפתח עמוד התשלום - "מי פתח ומי נרשם", כמו בהצעות המתנה.
alter table public.teachers add column if not exists pay_viewed_at timestamptz;
alter table public.teachers add column if not exists pay_view_count integer not null default 0;
-- מנעול קצר על ההרשמה לתשלום: שתי לחיצות על "הרשמה" לא יפתחו שתי הוראות קבע.
alter table public.teachers add column if not exists subscribe_lock_at timestamptz;

-- מייל אחד = מורה אחד. בלי זה שתי הרשמות במקביל יוצרות שתי שורות.
drop index if exists public.teachers_email_idx;
create unique index if not exists teachers_email_uniq on public.teachers (lower(email));

-- ── ביקוש: חיפושי מורים ─────────────────────────────────────────────────────
-- כל חיפוש מורה מתוך שאלון הילדים, עם מה שהתבקש וכמה חזרו. נפרד מ-
-- analytics_events בכוונה: match_search / match_results מזינים את מדדי
-- ההיצע של המטפלים (חיפושים "דלים", ביקוש לפי אזור), וחיפוש מורה שחוזר
-- ריק היה נספר שם כמחסור במטפלים.
create table if not exists public.teacher_searches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  referral_key text,
  subject text,
  remedial boolean not null default false,
  grade_group text,
  region text,
  city text,
  online boolean not null default false,
  returned integer not null default 0,
  local_count integer,
  quiz_type text,
  session_id text
);
create index if not exists teacher_searches_created_idx on public.teacher_searches (created_at desc);

alter table public.teacher_searches enable row level security;
revoke all on public.teacher_searches from anon, authenticated;
grant select, insert, update, delete on public.teacher_searches to service_role;

-- ── ספירות ב-SQL (תקרת 1000 השורות של PostgREST) ────────────────────────────
-- הופעות ופניות לכל מורה. קריאה ישירה של teacher_events הייתה נחתכת ב-1000
-- שורות בשקט, והמספרים שהמורה והאדמין רואים היו קופאים.
create or replace function public.teacher_event_stats(p_ids uuid[])
returns table (
  teacher_id uuid,
  impressions_30d bigint,
  contacts_30d bigint,
  profile_views_30d bigint,
  impressions_total bigint,
  contacts_total bigint,
  last_contact_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select e.teacher_id,
         count(*) filter (where e.event_type = 'impression' and e.created_at >= now() - interval '30 days'),
         count(*) filter (where e.event_type in ('whatsapp', 'phone') and e.created_at >= now() - interval '30 days'),
         count(*) filter (where e.event_type = 'profile_view' and e.created_at >= now() - interval '30 days'),
         count(*) filter (where e.event_type = 'impression'),
         count(*) filter (where e.event_type in ('whatsapp', 'phone')),
         max(e.created_at) filter (where e.event_type in ('whatsapp', 'phone'))
  from public.teacher_events e
  where e.teacher_id = any (p_ids)
  group by e.teacher_id;
$$;

revoke all on function public.teacher_event_stats(uuid[]) from public, anon, authenticated;
grant execute on function public.teacher_event_stats(uuid[]) to service_role;

-- הביקוש לפי תחום ואזור: כמה חיפשו, וכמה מהחיפושים חזרו ריקים. זו הטבלה
-- שלפיה מגייסים - איפה הורים מחפשים מורה ולא מוצאים.
create or replace function public.teacher_search_demand(p_days integer default 30)
returns table (
  subject text,
  remedial boolean,
  region text,
  searches bigint,
  empty_searches bigint,
  avg_returned numeric
)
language sql
stable
set search_path = public
as $$
  select coalesce(s.subject, '-'),
         s.remedial,
         coalesce(s.region, case when s.online then 'אונליין' else 'ללא אזור' end),
         count(*),
         count(*) filter (where s.returned = 0),
         round(avg(s.returned), 1)
  from public.teacher_searches s
  where s.created_at >= now() - make_interval(days => greatest(1, least(p_days, 365)))
  group by 1, 2, 3
  order by 4 desc
  limit 200;
$$;

revoke all on function public.teacher_search_demand(integer) from public, anon, authenticated;
grant execute on function public.teacher_search_demand(integer) to service_role;
