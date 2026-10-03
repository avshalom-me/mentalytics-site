-- ענף המורים: שלוש רובריקות להתאמה מדויקת (אושר ע"י הבעלים, 3/10/2026).
--
-- expertise       - ניסיון ממוקד עם מאפייני למידה (TEACHER_EXPERTISE), עד שלושה.
--                   הצהרה עצמית של המורה: מוצגת להורים, ולא מאומתת מול תעודה.
-- focuses         - מוקדי ההוראה בתוך כל תחום שסומן (TEACHER_FOCUSES).
-- lesson_settings - איפה מתקיים השיעור: student_home / teacher_place / online.
--                   העמודה online נשארת ונגזרת ממנו, כי מנוע ההתאמה קורא אותה.
--
-- אידמפוטנטי. אין מה למלא בדיעבד: בזמן ההוספה אין אף מורה בטבלה.

alter table public.teachers add column if not exists expertise text[] not null default array[]::text[];
alter table public.teachers add column if not exists focuses text[] not null default array[]::text[];
alter table public.teachers add column if not exists lesson_settings text[] not null default array[]::text[];
