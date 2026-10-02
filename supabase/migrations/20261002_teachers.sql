-- ענף המורים המקצועיים ("מענה לימודי"), 2/10/2026.
--
-- טבלה נפרדת מ-therapists בכוונה: כל משטח ציבורי באתר (המאגר, ה-sitemap,
-- עמודי הערים, /en, מנוע ההתאמה של המבוגרים, דוחות האזור) קורא את therapists
-- ישירות, ושורת מורה בטבלה ההיא הייתה מודלפת לכולם. מורה מופיע/ה רק במקום
-- שקורא teachers במפורש: תוצאות שאלון הילדים ועמודי /learning.
--
-- אידמפוטנטי: כל פקודה עם IF NOT EXISTS / DROP IF EXISTS, כי המיגרציות
-- מורצות ביד ולפעמים פעמיים.

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- זהות
  full_name text not null,
  email text not null,
  phone text,
  gender text,                                   -- 'זכר' | 'נקבה' | null
  slug text,                                     -- /learning/t/<slug>
  edit_token text not null,                      -- הקישור האישי לעריכה/תשלום (בלי חשבון)

  -- מה מלמד/ת
  subjects text[] not null default '{}',         -- מפתחות TEACHER_SUBJECTS
  remedial boolean not null default false,       -- הוראה מתקנת/מותאמת (ולא רק תגבור)
  grade_groups text[] not null default '{}',     -- ag / dv / zh / tyb - כמו acadGg בשאלון הילדים
  regions text[] not null default '{}',          -- שמות ערים, כמו אצל המטפלים
  online boolean not null default false,
  languages text[] not null default '{עברית}',
  price_text text,                               -- טקסט חופשי, למשל "150-180 ש"ח לשעה"
  bio text,

  -- הכשרה מוצהרת (האדמין מאמת מול התעודה)
  qualification text,                            -- מפתחות TEACHER_QUALIFICATIONS
  institution text,
  qualification_year integer,
  teaching_certificate boolean not null default false,
  experience_years integer,
  certificate_path text,                         -- בבאקט therapist-certificates, תחת teachers/
  photo_path text,

  -- הצהרות
  declared_no_record boolean not null default false,  -- היעדר הרשעה/מניעה לעבודה עם קטינים
  accepted_terms_at timestamptz,

  -- מחזור חיים (ראו TEACHER_LISTING_STATES)
  listing_state text not null default 'pending',
  approved_at timestamptz,
  trial_ends_at timestamptz,
  paying_since timestamptz,
  paused_until timestamptz,
  reject_reason text,
  admin_note text,

  -- חיוב (Sumit). המחיר כאן ברוטו - שונה מ-payments/subscriptions, ראו teacher-options.ts.
  sumit_recurring_id text,
  sumit_first_charge_on date,
  sumit_cancelled_at timestamptz,
  price_gross numeric(8,2),

  -- תזכורות הקרון (כל אחת פעם אחת)
  trial_ending_notified_at timestamptz,
  trial_expired_notified_at timestamptz,

  -- ייחוס בהרשמה
  signup_channel text,
  signup_utm_source text,
  signup_utm_medium text,
  signup_utm_campaign text,
  signup_referrer text,
  signup_source text not null default 'self'     -- 'self' | 'admin'
);

alter table public.teachers drop constraint if exists teachers_listing_state_check;
alter table public.teachers add constraint teachers_listing_state_check
  check (listing_state in ('pending', 'trial', 'paying', 'expired', 'paused', 'rejected'));

create unique index if not exists teachers_edit_token_uniq on public.teachers (edit_token);
create unique index if not exists teachers_slug_uniq on public.teachers (slug) where slug is not null;
create index if not exists teachers_state_idx on public.teachers (listing_state);
create index if not exists teachers_email_idx on public.teachers (lower(email));

-- אירועים על מורים: הופעה בכרטיס, לחיצת קשר, צפייה בפרופיל. טבלה אחת ולא
-- שתיים כמו אצל המטפלים (views + clicks), כי הסטטיסטיקה שהמורה רואה היא
-- "כמה פעמים הופעת, כמה פנו" - ושתיהן נספרות מכאן.
create table if not exists public.teacher_events (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  created_at timestamptz not null default now(),
  event_type text not null,                      -- impression | whatsapp | phone | profile_view
  source text,                                   -- match | profile
  session_id text,
  quiz_type text,                                -- kids | school
  subject text,                                  -- התחום שחופש
  channel text,
  utm_source text,
  utm_medium text,
  utm_campaign text
);

alter table public.teacher_events drop constraint if exists teacher_events_type_check;
alter table public.teacher_events add constraint teacher_events_type_check
  check (event_type in ('impression', 'whatsapp', 'phone', 'profile_view'));

create index if not exists teacher_events_teacher_idx on public.teacher_events (teacher_id, created_at desc);
create index if not exists teacher_events_type_idx on public.teacher_events (event_type, created_at desc);

-- כמו בכל טבלה חדשה: RLS דלוק, אין גישה לאנונימי, הכול דרך service_role.
alter table public.teachers enable row level security;
revoke all on public.teachers from anon, authenticated;
grant select, insert, update, delete on public.teachers to service_role;

alter table public.teacher_events enable row level security;
revoke all on public.teacher_events from anon, authenticated;
grant select, insert, update, delete on public.teacher_events to service_role;
