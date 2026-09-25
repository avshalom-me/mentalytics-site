-- סטטוס חדש לפניות בתיבת שירות הלקוחות: duplicate.
--
-- 22/9/26 מטפלת שלחה את אותה בקשת ביטול משתי כתובות, בהפרש של 90 שניות.
-- הסוכן ראה שתי פניות נפרדות (הקישור בין הודעות היה לפי כתובת השולח בלבד),
-- ענית על אחת, והשנייה נשארה בתור גם אחרי רענון. מעכשיו, כשעונים על פנייה,
-- אותה פנייה שהגיעה מכתובת אחרת נסגרת כ-duplicate.
--
-- הרחבה בלבד. חייבת לרוץ לפני הקוד: הרחבת CHECK שמפגרת אחרי הקוד היא
-- מלכודת ידועה כאן (השורה נדחית בשקט).

alter table public.inbox_messages drop constraint if exists inbox_messages_status_check;
alter table public.inbox_messages add constraint inbox_messages_status_check
  check (status = any (array[
    'new', 'drafted', 'sent', 'sent_external', 'ignored', 'superseded', 'duplicate'
  ]));
