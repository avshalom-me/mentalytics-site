-- הערת סיום למשימה שנסגרה ונשמרה.
--
-- עמודה נפרדת ולא כתיבה לתוך details: details הוא תיאור המשימה כפי שנוצרה,
-- וכתיבת מסקנה לתוכו הייתה מוחקת את מה שהתבקש במקור. השניים עונים על שתי
-- שאלות שונות - "מה היה צריך לעשות" מול "מה יצא מזה".

BEGIN;

ALTER TABLE public.crm_tasks
  ADD COLUMN IF NOT EXISTS completion_note text;

COMMIT;
