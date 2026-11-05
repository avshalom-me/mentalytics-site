-- מצב "גפ״ן": יכולות של שאלון היועצות שאפשר לכבות לרישיון מסוים.
--
-- שתי היכולות: ai_explain (כפתורי "למה הוצע?", מודל שפה) ו-therapist_search
-- (חיפוש מטפלים לפי אזור). העמודה היא רשימת מה שכבוי. ריקה = הכול דלוק, וזו
-- ברירת המחדל לכל רישיון קיים וחדש, כך שההרצה לא משנה התנהגות של אף בית ספר.
-- שום רישיון לא מכובה כאן; את זה עושה הבעלים, לרישיון מסוים, מהאדמין.
--
-- הקוד לא תלוי בסדר ההרצה: כל עוד העמודה חסרה, הנתיבים רואים הכול דלוק
-- (app/lib/school-features.server.ts).
--
-- אין צורך ב-GRANT: ההרשאות של school_licenses הן ברמת הטבלה (service_role, RLS
-- פעיל) וחלות גם על עמודה חדשה.
alter table public.school_licenses
  add column if not exists disabled_features text[] not null default '{}'
  check (disabled_features <@ array['ai_explain', 'therapist_search']::text[]);

comment on column public.school_licenses.disabled_features is
  'יכולות שכבויות לרישיון (מצב גפ״ן): ai_explain, therapist_search. ריק = הכול דלוק.';
