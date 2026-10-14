-- צפיות פרופיל שנרשמו על ידי סורק אוטומטי עוברות לכאן, ולא נמחקות.
--
-- מ-7/10/2026 בשעה 19:00 משהו נכנס לדפי מטפלים כ-45 פעמים בשעה, מסביב לשעון:
-- כל כניסה סשן חדש, בלי מפנה, בלי אף פעולה אחרת באתר. ה-User-Agent שלו לא
-- נתפס ב-bot-detect.ts, ובשבוע הראשון הוא רשם כ-4,400 "צפיות" - פי 8 מהצפיות
-- של מבקרים אמיתיים. הן הגיעו למסך השיווק (שיעור ההמרה צנח לכ-1%), לאזור
-- האישי של המטפלים, לדוח החודשי ולסוכן השימור.
--
-- למה טבלה נפרדת ולא עמודת סימון: כ-20 מקומות בקוד קוראים את
-- therapist_profile_views ישירות, וכל אחד היה צריך ללמוד לסנן. כאן אף קורא לא
-- משתנה, והחזרה היא פקודה אחת:
--   insert into therapist_profile_views
--     select id, therapist_id, source, viewed_at, viewer_region, viewer_issue,
--            viewer_age_band, viewer_gender, match_score, session_id, channel,
--            utm_source, utm_medium, utm_campaign, viewer_treatment,
--            viewer_symptom, referrer_host
--     from therapist_profile_views_quarantine where quarantine_reason = '...';
--
-- LIKE בלי INCLUDING CONSTRAINTS: בלי מפתח זר למטפל, כך שמחיקת מטפל לא נחסמת
-- בגלל שורה בהסגר.

create table if not exists public.therapist_profile_views_quarantine
  (like public.therapist_profile_views including defaults);

alter table public.therapist_profile_views_quarantine
  add column if not exists quarantined_at timestamptz not null default now(),
  add column if not exists quarantine_reason text not null default '';

create index if not exists therapist_profile_views_quarantine_viewed_at_idx
  on public.therapist_profile_views_quarantine (viewed_at);

alter table public.therapist_profile_views_quarantine enable row level security;
revoke all on public.therapist_profile_views_quarantine from anon, authenticated;
grant select, insert, delete on public.therapist_profile_views_quarantine to service_role;
