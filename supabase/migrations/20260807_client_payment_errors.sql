-- תקלות תשלום בצד הלקוח. פעמיים ראינו "יש תקלה" אצל לקוח אמיתי בלי שום
-- עקבות בשרת (הבקשה נכשלת בדפדפן - חוסם פרסומות על api.sumit.co.il, דפדפן
-- ישן, שדה שנדחה) - הטבלה הזו הופכת את זה מנחוש-מרחוק לנתון.
create table if not exists public.client_payment_errors (
  id uuid primary key default gen_random_uuid(),
  source text not null,          -- 'center_join' / 'quiz' / ...
  stage text not null,           -- 'config' / 'tokenize' / 'subscribe' / 'exception'
  message text,                  -- הודעת השגיאה כפי שנראתה (קצוצה)
  ref_prefix text,               -- 8 תווים ראשונים של הטוקן - זיהוי המרכז בלי לחשוף סוד
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.client_payment_errors enable row level security;
revoke all on public.client_payment_errors from anon, authenticated;
grant select, insert, delete on public.client_payment_errors to service_role;
