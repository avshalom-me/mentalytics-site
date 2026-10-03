-- הדלת הציבורית "לימוד חכם" (3/10/2026): חיפוש מורה ישיר, בלי השאלון.
--
-- שתי עמודות על שורת הביקוש, שתיהן בלי שום פרט מזהה:
--   needs     - הקשיים שברקע שצוינו בחיפוש (מפתחות TEACHER_EXPERTISE). מה
--               שההורה סימן בדלת, או מה ששאלון הילדים כבר זיהה. זה הנתון
--               שלפיו יודעים איזה ניסיון חסר במאגר.
--   used_text - האם ההורה נעזר בשדה הכתיבה החופשית. הטקסט עצמו מפוענח
--               בדפדפן ואינו מגיע לשרת; נשמרת רק העובדה שנעשה בו שימוש.
--
-- quiz_type מקבל ערך שלישי, 'direct' (לצד kids ו-school). העמודה היא text
-- בלי אילוץ, ולכן אין מה לשנות בה.
--
-- אידמפוטנטי: אפשר להריץ שוב.

alter table public.teacher_searches add column if not exists needs text[] not null default array[]::text[];
alter table public.teacher_searches add column if not exists used_text boolean not null default false;
