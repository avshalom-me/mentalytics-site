-- תנועה מעוזרי AI כמקור תנועה בשני מסכי אדמין (19/9/2026):
--   1. /admin/seo - קו שבועי של מבקרים שהגיעו דרך עוזר AI (כולם יחד).
--   2. /admin/marketing - טבלת מקורות תנועה מצומצמת, עם פירוק של AI לפי עוזר.
--
-- למה לא להסתמך על channel = 'ai' בלבד: הערוץ נוסף ב-3/9/2026 (083f5f7). עד אז
-- ChatGPT נרשם כ-"other" ו-Gemini כ-"google_organic". השורות ההיסטוריות לא
-- תוקנו, ולכן הזיהוי כאן נשען גם על utm_source ועל referrer_host הגולמיים.
-- המשמעות: עד שחלון 30 הימים יעבור את 4/9, המספר כאן גבוה במעט מזה שבטבלת
-- הערוצים של /admin/attribution (שסופרת לפי channel בלבד).

-- מפתח מקור אפקטיבי לשורה אחת. ערוץ ממומן לעולם לא נדרס: קליק על מודעה הוא
-- קליק על מודעה, גם אם הדפדפן הגיע פעם מ-ChatGPT.
create or replace function public.traffic_source_key(p_channel text, p_utm_source text, p_referrer_host text)
returns text
language sql
immutable
as $fn$
  select case
    when coalesce(p_channel, '') not in ('google_paid', 'taboola_paid', 'meta_paid', 'tiktok_paid')
     and coalesce(
           p_channel = 'ai'
           or p_utm_source ~* '(chatgpt|openai|perplexity|gemini|claude|copilot)'
           or p_referrer_host ~* '(^|\.)(chatgpt\.com|openai\.com|gemini\.google\.com|bard\.google\.com|claude\.ai|perplexity\.ai|copilot\.microsoft\.com|you\.com|poe\.com|grok\.com|x\.ai)$',
           false)
      then 'ai'
    -- שני תיקונים רטרואקטיביים נוספים, מאותה סיבה: עד 9/9/2026 מנועי חיפוש
    -- שאינם גוגל נרשמו כ-"referral", ואפליקציית Gmail כ-"google_organic".
    -- attribution.ts כבר מסווג אותם נכון; כאן זה חל גם על השורות הישנות, כדי
    -- ש-bing.com לא יופיע ברשימת "האתרים המפנים".
    when p_channel = 'referral'
     and coalesce(p_referrer_host ~* '((^|\.)(bing\.com|duckduckgo\.com|ecosia\.org|search\.brave\.com|baidu\.com|search\.walla\.co\.il)$|(^|\.)search\.yahoo\.|(^|\.)yandex\.)', false)
      then 'search_other'
    when p_channel in ('google_organic', 'referral')
     and coalesce(p_referrer_host ~* '(^com\.google\.android\.gm$|(^|\.)mail\.google\.|(^|\.)outlook\.|(^|\.)mail\.yahoo\.)', false)
      then 'email'
    else coalesce(p_channel, 'unknown')
  end
$fn$;

-- איזה עוזר. ChatGPT מתייג את הקישורים שלו (utm_source=chatgpt.com) ולכן מזוהה
-- גם בלי referrer; האחרים מזוהים לפי המפנה בלבד.
create or replace function public.ai_assistant_key(p_utm_source text, p_referrer_host text)
returns text
language sql
immutable
as $fn$
  select case
    when coalesce(p_utm_source ~* '(chatgpt|openai)' or p_referrer_host ~* '(^|\.)(chatgpt\.com|openai\.com)$', false) then 'chatgpt'
    when coalesce(p_utm_source ~* 'gemini' or p_referrer_host ~* '(^|\.)(gemini|bard)\.google\.com$', false) then 'gemini'
    when coalesce(p_utm_source ~* 'claude' or p_referrer_host ~* '(^|\.)claude\.ai$', false) then 'claude'
    when coalesce(p_utm_source ~* 'perplexity' or p_referrer_host ~* '(^|\.)perplexity\.ai$', false) then 'perplexity'
    when coalesce(p_utm_source ~* 'copilot' or p_referrer_host ~* '(^|\.)copilot\.microsoft\.com$', false) then 'copilot'
    else 'other'
  end
$fn$;

-- הקו השבועי ל-/admin/seo. אותה מתודולוגיה כמו admin_seo_overview: מבקר =
-- דפדפן, ונספר פעם אחת - בשבוע של המגע הראשון שלו דרך עוזר AI. השבועות
-- מחושבים באותו date_trunc('week') כדי שהמפתחות יתיישרו עם הסדרה האורגנית.
create or replace function public.admin_ai_weekly(p_days int default 90)
returns jsonb
language sql
stable
as $fn$
with touches as (
  select e.session_id, e.created_at as ts, e.utm_source, e.referrer_host
  from public.analytics_events e
  where e.session_id is not null
    and public.traffic_source_key(e.channel, e.utm_source, e.referrer_host) = 'ai'
  union all
  select v.session_id, v.viewed_at, v.utm_source, v.referrer_host
  from public.therapist_profile_views v
  where v.session_id is not null
    and public.traffic_source_key(v.channel, v.utm_source, v.referrer_host) = 'ai'
),
per_session as (
  select t.session_id, min(t.ts) as ts,
         coalesce(
           min(public.ai_assistant_key(t.utm_source, t.referrer_host))
             filter (where public.ai_assistant_key(t.utm_source, t.referrer_host) <> 'other'),
           'other') as assistant
  from touches t group by t.session_id
),
win as (select * from per_session where ts >= now() - make_interval(days => p_days))
select jsonb_build_object(
  'weekly', (
    select coalesce(jsonb_agg(jsonb_build_object('week', w.week, 'ai', w.n) order by w.week), '[]'::jsonb)
    from (select date_trunc('week', ts)::date as week, count(*) as n from per_session group by 1) w
  ),
  'window_sessions', (select count(*) from win),
  'by_assistant', (
    select coalesce(jsonb_agg(jsonb_build_object('assistant', a.assistant, 'sessions', a.n) order by a.n desc, a.assistant), '[]'::jsonb)
    from (select assistant, count(*) as n from win group by 1) a
  )
);
$fn$;

-- טבלת מקורות התנועה ל-/admin/marketing. לכל מקור: מבקרים (דפדפנים) בחלון,
-- מבקרים בחלון הקודם באותו אורך, מתוכם סיימו שאלון, מבקרים שלחצו ליצירת קשר,
-- ומספר הלחיצות. דפדפן שנראה בחלון בשני מקורות נספר בשניהם (נדיר) - כך כל
-- שורה נכונה בפני עצמה, ואחוזי החלוקה מחושבים מסכום השורות.
create or replace function public.admin_traffic_sources(p_days int default 30)
returns jsonb
language sql
stable
as $fn$
with b as (
  select now() - make_interval(days => p_days)     as cur_from,
         now() - make_interval(days => 2 * p_days) as prev_from
),
ev as (
  select e.session_id, e.created_at as ts, (e.event_type = 'quiz_complete') as is_quiz,
         public.traffic_source_key(e.channel, e.utm_source, e.referrer_host) as src,
         e.utm_source, e.referrer_host
  from public.analytics_events e, b
  where e.session_id is not null and e.created_at >= b.prev_from
  union all
  select v.session_id, v.viewed_at, false,
         public.traffic_source_key(v.channel, v.utm_source, v.referrer_host),
         v.utm_source, v.referrer_host
  from public.therapist_profile_views v, b
  where v.session_id is not null and v.viewed_at >= b.prev_from
),
ss as (
  select ev.session_id, ev.src,
         bool_or(ev.ts >= b.cur_from) as cur,
         bool_or(ev.ts <  b.cur_from) as prev,
         bool_or(ev.is_quiz and ev.ts >= b.cur_from) as quiz,
         coalesce(
           min(public.ai_assistant_key(ev.utm_source, ev.referrer_host))
             filter (where ev.src = 'ai' and public.ai_assistant_key(ev.utm_source, ev.referrer_host) <> 'other'),
           'other') as assistant,
         min(ev.referrer_host) filter (where ev.src = 'referral' and ev.ts >= b.cur_from) as host
  from ev, b
  group by ev.session_id, ev.src
),
cl as (
  select public.traffic_source_key(c.channel, c.utm_source, c.referrer_host) as src,
         public.ai_assistant_key(c.utm_source, c.referrer_host) as assistant,
         coalesce(c.session_id, c.id::text) as sid
  from public.therapist_contact_clicks c, b
  where c.clicked_at >= b.cur_from
),
src_rows as (
  select src,
         count(*) filter (where cur)  as sessions,
         count(*) filter (where prev) as prev_sessions,
         count(*) filter (where quiz) as quiz
  from ss group by src
),
src_clicks as (
  select src, count(*) as contact_clicks, count(distinct sid) as contact_sessions from cl group by src
),
ai_rows as (
  select assistant,
         count(*) filter (where cur)  as sessions,
         count(*) filter (where prev) as prev_sessions,
         count(*) filter (where quiz) as quiz
  from ss where src = 'ai' group by assistant
),
ai_clicks as (
  select assistant, count(*) as contact_clicks, count(distinct sid) as contact_sessions
  from cl where src = 'ai' group by assistant
),
ref_rows as (
  select host, count(*) as sessions
  from ss where src = 'referral' and cur and host is not null
  group by host order by count(*) desc, host limit 4
)
select jsonb_build_object(
  'days', p_days,
  'sources', coalesce((
    select jsonb_agg(jsonb_build_object(
      'key', coalesce(r.src, k.src),
      'sessions', coalesce(r.sessions, 0),
      'prev_sessions', coalesce(r.prev_sessions, 0),
      'quiz', coalesce(r.quiz, 0),
      'contact_sessions', coalesce(k.contact_sessions, 0),
      'contact_clicks', coalesce(k.contact_clicks, 0)))
    from src_rows r full outer join src_clicks k on k.src = r.src), '[]'::jsonb),
  'ai', coalesce((
    select jsonb_agg(jsonb_build_object(
      'assistant', coalesce(r.assistant, k.assistant),
      'sessions', coalesce(r.sessions, 0),
      'prev_sessions', coalesce(r.prev_sessions, 0),
      'quiz', coalesce(r.quiz, 0),
      'contact_sessions', coalesce(k.contact_sessions, 0),
      'contact_clicks', coalesce(k.contact_clicks, 0)))
    from ai_rows r full outer join ai_clicks k on k.assistant = r.assistant), '[]'::jsonb),
  'referrers', coalesce((
    select jsonb_agg(jsonb_build_object('host', host, 'sessions', sessions) order by sessions desc, host)
    from ref_rows), '[]'::jsonb)
);
$fn$;

revoke all on function public.traffic_source_key(text, text, text) from public, anon, authenticated;
revoke all on function public.ai_assistant_key(text, text) from public, anon, authenticated;
revoke all on function public.admin_ai_weekly(int) from public, anon, authenticated;
revoke all on function public.admin_traffic_sources(int) from public, anon, authenticated;
grant execute on function public.traffic_source_key(text, text, text) to service_role;
grant execute on function public.ai_assistant_key(text, text) to service_role;
grant execute on function public.admin_ai_weekly(int) to service_role;
grant execute on function public.admin_traffic_sources(int) to service_role;
