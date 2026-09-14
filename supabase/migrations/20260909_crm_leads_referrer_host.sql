-- החצי החסר של המיגרציה מ-6/8/2026.
--
-- 20260806_referrer_host.sql הוסיפה referrer_host ל-analytics_events,
-- therapist_profile_views ו-therapist_contact_clicks. crm_leads נשכחה.
-- ביום 8/8 (810de5d) sanitizeAttribution התחיל להחזיר את השדה, והוא נפרש
-- (spread) לתוך שלוש הכתיבות ל-crm_leads. מאותו רגע **כל** insert ל-crm_leads
-- נכשל עם "Could not find the 'referrer_host' column".
--
-- שניים מהשלושה נכשלים בתוך try/catch שנועד למנוע מכישלון CRM להגיע לשולח,
-- ולכן איש לא ידע: ההודעה למטפל יצאה, השורה ב-therapist_contact_clicks נרשמה
-- (שם העמודה כן קיימת), והליד פשוט נעלם. הליד האחרון מסוג site_message הוא
-- מ-4/8, בעוד חמש הודעות נשלחו אחריו.
--
-- התיקון כאן ולא בשלושת אתרי הקריאה בכוונה: כך sanitizeAttribution נשאר
-- ניתן לפרישה לכל טבלת ייחוס, ולא נשארת מלכודת לקריאה הרביעית.

BEGIN;

ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS referrer_host text;

COMMIT;
