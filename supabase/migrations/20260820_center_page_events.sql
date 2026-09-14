-- שלושה אירועי עמוד-מרכז: center_page_view, center_website_click,
-- center_contact_click. metadata נושא center_id (+type ללחיצת קשר).
--
-- למה: לעמוד מרכז במסלול 1 (per_therapist) אין שורת ישות ב-therapists,
-- ולכן אין לו לאן לרשום צפיות ולחיצות - ממצא 12 בביקורת המרכזים מ-4/8/26
-- נשאר פתוח מאז: "עמודי מרכז מסלול 1 בלי TrackView בכלל". בנוסף, הקישור
-- "אתר המרכז" לא נמדד מעולם - בשני המסלולים - כלומר אי אפשר היה לומר
-- למרכז כמה תנועה העברנו לאתר שלו.
--
-- ההחלטה: אירועי עמוד אחידים לשני המסלולים ב-analytics_events (הישות של
-- מסלול 2 ממשיכה לקבל גם therapist_profile_views דרך TrackView - שני
-- מדדים שונים: "תנועת העמוד הציבורי" מול "צפיות פרופיל במערכת ההתאמות").
-- center_contact_click נורה רק כשאין שורת ישות (מסלול 1) - במסלול 2
-- הלחיצה נרשמת כרגיל ב-therapist_contact_clicks ואסור לספור אותה פעמיים.
--
-- לקח מיושם: הרחבת ה-CHECK קודמת לפריסת הקוד. event_type שאינו ברשימה
-- נדחה ב-insert, ה-API מחזיר 500 וה-catch בצד הלקוח בולע - האירוע נעלם
-- בשקט (קרה עם matching_click ו-therapist_explain_click).
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
    'match_saved',
    'center_page_view',
    'center_website_click',
    'center_contact_click'
  ])
);

-- השאילתה באדמין מסננת לפי center_id שבתוך ה-metadata - בלי אינדקס זו
-- סריקה מלאה של analytics_events שרק גדלה.
create index if not exists idx_analytics_events_center
  on public.analytics_events ((metadata->>'center_id'))
  where metadata->>'center_id' is not null;
