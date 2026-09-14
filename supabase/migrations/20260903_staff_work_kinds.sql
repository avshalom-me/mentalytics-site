-- אופי העבודה לכל רישום שעות (בחירה מרובה, חובה).
--
-- העמודה **nullable בכוונה**, למרות שהשדה חובה בטופס: 22 הרישומים הקיימים של
-- עומר נוצרו לפני שהשדה היה קיים, ואין דרך לדעת בדיעבד מה נעשה בהם. עמודה
-- NOT NULL הייתה מחייבת להמציא ערך להיסטוריה. החובה נאכפת בשכבת הכתיבה
-- (app/api/admin-staff) על כל רישום חדש או נערך, כך שההיסטוריה נשארת כנה
-- והחדש נשמר מלא.
--
-- ה-CHECK חייב להישאר זהה ל-WORK_KINDS ב-app/lib/staff-work-kinds.ts.

BEGIN;

ALTER TABLE public.staff_work_sessions
  ADD COLUMN IF NOT EXISTS work_kinds text[];

ALTER TABLE public.staff_work_sessions
  DROP CONSTRAINT IF EXISTS staff_work_sessions_work_kinds_valid;

ALTER TABLE public.staff_work_sessions
  ADD CONSTRAINT staff_work_sessions_work_kinds_valid CHECK (
    work_kinds IS NULL
    OR (
      array_length(work_kinds, 1) >= 1
      AND work_kinds <@ ARRAY[
        'שיווק מרכזים',
        'שירות לקוחות במייל/בסוכן',
        'פגישות',
        'QA',
        'שירות לקוחות מרכזים',
        'אחר'
      ]::text[]
    )
  );

COMMIT;
