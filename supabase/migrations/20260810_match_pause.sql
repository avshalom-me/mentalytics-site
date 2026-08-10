-- הקפאה זמנית ממערכת ההתאמות בלבד.
--
-- למה לא accepting_new_patients: זה דגל *ציבורי* - הוא מציג במאגר "לא זמין/ה
-- לקבלת מטופלים חדשים", חוסם הודעות מהאתר, והמטפל/ת רואה אותו בדשבורד. כאן
-- רוצים בדיוק ההפך: המטפל/ת נשאר/ת מוצג/ת ומדורג/ת רגיל במאגר הציבורי ואינו
-- מקבל שום התראה - רק מפסיק להופיע בתוצאות השאלון, לתקופה קצובה.
--
-- שדה תאריך ולא בוליאני: ההקפאה פגה מעצמה, בלי cron ובלי לזכור לבטל.
alter table public.therapists
  add column if not exists match_paused_until timestamptz,
  add column if not exists match_paused_reason text;

comment on column public.therapists.match_paused_until is
  'הקפאה זמנית מתוצאות /api/match בלבד. המאגר הציבורי, ההודעות והדשבורד לא מושפעים. פג אוטומטית.';

-- אינדקס חלקי: רק שורות מוקפאות בפועל (בדרך כלל בודדות).
create index if not exists therapists_match_paused_idx
  on public.therapists (match_paused_until)
  where match_paused_until is not null;

grant select, insert, update, delete on public.therapists to service_role;
