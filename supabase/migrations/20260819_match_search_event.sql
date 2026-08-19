-- אירוע match_search: החיפוש עצמו נשלח, עם האזור שנבחר.
--
-- למה זה נחוץ: matching_click נורה כשנפתח טופס החיפוש (שני השאלונים, מאז
-- 17/8/2026), ולכן אין שום אירוע שמסמן *שליחה*. את ההשלמה הסקנו עד כה
-- מקיומן של חשיפות כרטיס - הסקה עקיפה שנשענת על כך שהתוצאות רונדרו ושה-
-- IntersectionObserver הספיק לירות. בנוסף, האזור שהמשתמש בוחר לא נרשם
-- בשום אירוע: הוא מגיע רק כ-viewer_region על שורות הצפייה, כלומר קיים אך
-- ורק אצל מי שהתוצאות שלו כבר רונדרו.
--
-- מה זה כן פותר: הפער בין "פתח טופס" ל"שלח חיפוש", והאזור של מי שחיפש.
-- מה זה לא פותר, ובמכוון: את האזור של מי שסיים שאלון ומעולם לא פתח את
-- הטופס (28% מהמבוגרים, המדידה מ-17/8). את אלה אי אפשר לדעת - הם עזבו
-- לפני שנשאלו. פילוח אזורי של *מסיימי שאלון* ימשיך להישען על הקמפיין
-- (utm_campaign) כפרוקסי, וזו מגבלה מבנית ולא חסר במימוש.
--
-- לקח מיושם: הרחבת ה-CHECK קודמת לפריסת הקוד. event_type שאינו ברשימה
-- נדחה ב-insert, ה-API מחזיר 500 וה-catch בצד הלקוח בולע - כלומר האירוע
-- נעלם בשקט. זה קרה בעבר עם matching_click ו-therapist_explain_click,
-- ששכבו שבועיים בלי שאיש ידע.
alter table public.analytics_events drop constraint if exists valid_event_type;

alter table public.analytics_events add constraint valid_event_type check (
  event_type = any (array[
    'page_view',
    'profile_impression',
    'filter_used',
    'quiz_step',
    'quiz_complete',
    'quiz_treatments',
    'recommendation_explain_click',
    'match_free_fallback',
    'recruit_page_view',
    'therapist_explain_click',
    'matching_click',
    'match_search',
    'match_saved'
  ])
);
