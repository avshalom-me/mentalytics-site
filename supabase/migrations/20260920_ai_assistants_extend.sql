-- עוזרי AI נוספים בזיהוי מקור התנועה (20/9/2026).
--
-- למה: הרשימה נכתבה לפי מה שכבר הופיע בנתונים. עוזר שאינו ברשימה נספר כ"אתר
-- מפנה" או, כשאין מפנה כלל, כ"ישיר" - ואי אפשר לתקן זאת בדיעבד מעבר למה
-- שנשמר. לכן הרשימה מקדימה את השימוש. הבדיקה כאן זהה ל-AI_HOSTS ב-
-- app/lib/attribution.ts, ושתיהן צריכות להתעדכן יחד.
--
-- לא נכנסו לכאן: תשובות ה-AI של גוגל עצמה (AI Overviews ו-AI Mode). קליק מהן
-- מגיע עם מפנה google.com ובלי שום סימון, ולכן הוא נספר - ובצדק, לפי מה
-- שאפשר לדעת - כחיפוש אורגני. הדוח "תכונות מבוססות-AI גנרטיבי" ב-Search
-- Console סופר את ההופעות שלהן בלבד, בלי קליקים, ואינו בר-השוואה למספר כאן.

create or replace function public.traffic_source_key(p_channel text, p_utm_source text, p_referrer_host text)
returns text
language sql
immutable
as $fn$
  select case
    when coalesce(p_channel, '') not in ('google_paid', 'taboola_paid', 'meta_paid', 'tiktok_paid')
     and coalesce(
           p_channel = 'ai'
           or p_utm_source ~* '(chatgpt|openai|perplexity|gemini|claude|copilot|deepseek|mistral)'
           or p_referrer_host ~* '(^|\.)(chatgpt\.com|openai\.com|gemini\.google\.com|bard\.google\.com|claude\.ai|perplexity\.ai|copilot\.microsoft\.com|copilot\.cloud\.microsoft|edgeservices\.bing\.com|meta\.ai|deepseek\.com|mistral\.ai|you\.com|poe\.com|grok\.com|x\.ai)$',
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
    when coalesce(p_utm_source ~* 'copilot' or p_referrer_host ~* '(^|\.)(copilot\.microsoft\.com|copilot\.cloud\.microsoft|edgeservices\.bing\.com)$', false) then 'copilot'
    when coalesce(p_utm_source ~* 'deepseek' or p_referrer_host ~* '(^|\.)deepseek\.com$', false) then 'deepseek'
    when coalesce(p_utm_source ~* 'mistral' or p_referrer_host ~* '(^|\.)mistral\.ai$', false) then 'mistral'
    when coalesce(p_referrer_host ~* '(^|\.)meta\.ai$', false) then 'meta'
    else 'other'
  end
$fn$;

revoke all on function public.traffic_source_key(text, text, text) from public, anon, authenticated;
revoke all on function public.ai_assistant_key(text, text) from public, anon, authenticated;
grant execute on function public.traffic_source_key(text, text, text) to service_role;
grant execute on function public.ai_assistant_key(text, text) to service_role;
