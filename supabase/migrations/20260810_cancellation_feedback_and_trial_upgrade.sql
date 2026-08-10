-- 1) משוב ביטול נשמר, לא רק נשלח במייל.
-- עד כה המשוב הגיע כמייל לאדמין ונעלם. אחרי 10 ביטולים אי אפשר היה לענות
-- על "מה הסיבה הכי נפוצה לעזיבה" - בדיוק השאלה ששווה כסף.
create table if not exists public.therapist_cancellation_feedback (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid references public.therapists(id) on delete set null,
  name text,
  email text,
  reasons text[] not null default '{}',
  message text,
  created_at timestamptz not null default now()
);

alter table public.therapist_cancellation_feedback enable row level security;
revoke all on public.therapist_cancellation_feedback from anon, authenticated;
grant select, insert, delete on public.therapist_cancellation_feedback to service_role;

create index if not exists tcf_created_idx on public.therapist_cancellation_feedback (created_at desc);

-- 2) מעקב אחרי מייל סיום תקופת המתנה + זכאות למבצע השדרוג.
--   trial_ending_notified_at  - נשלח הדוח (3 ימים לפני) - מונע שליחה כפולה
--   trial_ending_reminded_at  - נשלחה התזכורת (יום לפני)
--   upgrade_offer_until       - עד מתי המבצע האישי בתוקף; ה-checkout מכבד אותו
alter table public.therapists
  add column if not exists trial_ending_notified_at timestamptz,
  add column if not exists trial_ending_reminded_at timestamptz,
  add column if not exists upgrade_offer_until timestamptz;

comment on column public.therapists.upgrade_offer_until is
  'זכאות אישית למבצע שדרוג מסיום תקופת מתנה (מחיר מוזל לחודשיים). ה-checkout בודק אותו.';

grant select, insert, update, delete on public.therapists to service_role;
