-- לקחים מתיקוני האדמין בטיוטות של סוכן שירות הלקוחות.
--
-- עד היום הסוכן "למד" רק מ-2 התשובות האחרונות בכל קטגוריה, וכדוגמאות
-- סגנון בלבד - תיקון עובדה (למשל מדיניות ההחזרים) נשכח ברגע שנדחק מהחלון,
-- ובכל מקרה לא גבר על בסיס הידע. כאן כל תיקון נהפך לכלל מנוסח, האדמין
-- מאשר/עורך/דוחה, וכלל מאושר נכנס לכל טיוטה מעכשיו והלאה.
--
-- status: pending (ממתין לאישור) | approved (פעיל בכל טיוטה) |
--         rejected (נדחה) | retired (היה פעיל והוסר).
-- source: correction (חולץ מתיקון טיוטה) | manual (נכתב ידנית באדמין).

create table if not exists public.inbox_lessons (
  id uuid primary key default gen_random_uuid(),
  rule text not null check (length(btrim(rule)) > 0),
  why text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'retired')),
  source text not null default 'correction'
    check (source in ('correction', 'manual')),
  source_message_id uuid references public.inbox_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists inbox_lessons_status_idx
  on public.inbox_lessons (status, created_at);

-- שרת בלבד (supabaseAdmin). אין גישה מהדפדפן.
grant select, insert, update, delete on public.inbox_lessons to service_role;
revoke all on public.inbox_lessons from anon, authenticated;
alter table public.inbox_lessons enable row level security;

-- מתי חולצו לקחים מהתשובה הזו. null = עוד לא (או שהחילוץ נכשל וממתין
-- לניסיון חוזר בריצה הבאה). הסימון נתפס אטומית כדי ששני מסלולים (השליחה
-- והריצה המתוזמנת) לא יחלצו מאותה תשובה פעמיים.
alter table public.inbox_messages
  add column if not exists lessons_extracted_at timestamptz;

-- כלל שסותר את בסיס הידע או מרחיב אותו (למשל מוריד תנאי שכתוב שם). לא
-- נחסם: לפעמים התיקון הוא בדיוק מה שצריך לגבור על בסיס ידע מיושן. אבל
-- האדמין רואה את הסתירה לפני שהוא מאשר, כי כלל מאושר גובר בכל טיוטה.
alter table public.inbox_lessons add column if not exists conflict text;
