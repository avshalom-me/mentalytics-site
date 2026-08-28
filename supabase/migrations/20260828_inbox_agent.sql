-- סוכן שירות הלקוחות: מיילים נכנסים ל-admin@getmentalytics.com, הסווג והטיוטה.
-- שום מייל לא נשלח אוטומטית: הקרון רק קולט ומנסח, והשליחה היא לחיצת אדמין.
create table if not exists public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  gmail_thread_id text not null,
  header_message_id text,            -- Message-ID לצורך תשובה באותו שרשור
  from_email text not null,
  from_name text,
  subject text,
  body_text text,
  received_at timestamptz not null,
  -- מי הפונה, אם זוהה: מאפשר לטיוטה להיות מדויקת (מסלול, חיוב)
  sender_therapist_id uuid references public.therapists(id) on delete set null,
  category text check (category in (
    'therapist_billing','therapist_profile','therapist_cancel',
    'patient','center','system','spam','other'
  )),
  status text not null default 'new' check (status in (
    'new',           -- נקלט, טרם סווג
    'drafted',       -- יש טיוטה שממתינה לאישור
    'sent',          -- נענה מהמערכת בלחיצת אדמין
    'sent_external', -- נענה ישירות בג׳ימייל, מחוץ למערכת
    'ignored'        -- ספאם או לא דורש מענה
  )),
  draft_subject text,
  draft_body text,
  draft_generated_at timestamptz,
  draft_model text,
  final_body text,                   -- מה שנשלח בפועל, אחרי עריכת האדמין
  replied_at timestamptz,
  replied_gmail_id text,
  edit_ratio numeric,                -- 0 = נשלח כמו שהוא, 1 = שוכתב כולו
  is_exemplar boolean not null default false, -- תשובה סופית שמשמשת דוגמה לטיוטות הבאות
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inbox_messages_open_idx on public.inbox_messages (status, received_at desc);
create index if not exists inbox_messages_exemplar_idx on public.inbox_messages (category, replied_at desc) where is_exemplar;
alter table public.inbox_messages enable row level security;
grant select, insert, update, delete on public.inbox_messages to service_role;
