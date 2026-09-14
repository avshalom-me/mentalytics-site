-- איתור מכונים: שני סטטוסים חדשים שמפרטים באיזה ערוץ נוצרה הפנייה.
--
-- "contacted" (נוצרה פנייה ראשונה) נשאר כמו שהוא: שש שורות חיות משתמשות בו,
-- ולא ידוע בדיעבד אם הפנייה שם הייתה במייל או בטלפון. שני הסטטוסים החדשים
-- יושבים לצידו, באותה דרגה, ומתייחסים אליהם בדיוק כמו אליו בכל מקום בקוד
-- (דלי "בתהליך", חותמת contacted_at, כפתור הטיוטה).
--
-- זה אילוץ CHECK ולא enum, כך שההרחבה היא drop+add באותה טרנזקציה. בלי
-- ההרחבה כל בחירה בסטטוס חדש הייתה נדחית במסד.

alter table public.center_prospects
  drop constraint if exists center_prospects_status_check;

alter table public.center_prospects
  add constraint center_prospects_status_check
  check (status in (
    'new',
    'contacted',
    'contacted_email',
    'contacted_phone',
    'later',
    'not_interested',
    'moved_to_deal'
  ));
