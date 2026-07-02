-- FREE_REGION_FALLBACK (פיצ'ר זמני — app/lib/match-fallback.ts):
-- /api/match רושם אירוע 'match_free_fallback' בכל פעם שמטפלים חינמיים נכנסים
-- להתאמות כגיבוי לאזור ללא מטפלים משלמים. המיגרציה רק מרחיבה את רשימת
-- הערכים המותרים ב-CHECK — אין אובייקטים חדשים, ולכן אין צורך ב-GRANT חדש
-- (analytics_events כבר עם GRANT ל-service_role מ-20260606_attribution).
-- בהסרת הפיצ'ר אפשר להשאיר את הערך ב-CHECK — אירועים היסטוריים נשמרים.

BEGIN;

ALTER TABLE analytics_events
  DROP CONSTRAINT IF EXISTS valid_event_type;

ALTER TABLE analytics_events
  ADD CONSTRAINT valid_event_type CHECK (event_type IN (
    'page_view',
    'profile_impression',
    'filter_used',
    'quiz_step',
    'quiz_complete',
    'recommendation_explain_click',
    'match_free_fallback'
  ));

COMMIT;
