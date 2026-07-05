-- פורטל מרכזים (2026-07-05): כניסה עצמאית למרכז + קישור מטפלים למרכז.
--
-- שני שינויים:
-- 1) therapy_center_accounts.user_id — זהות הכניסה של המרכז (auth.users),
--    במקביל לאופן שבו therapists.user_id מקשר מטפל לחשבון שלו.
-- 2) therapists.center_account_id — קישור ישיר של מטפל למרכז, כדי שהפורטל
--    יציג את מטפלי המרכז ויחשב סטטיסטיקות מצטברות. קישור ישיר (ולא דרך
--    organizations) כי הוא חד-משמעי ומנוהל כולו במסך המרכזים באדמין.

alter table public.therapy_center_accounts
  add column if not exists user_id uuid;

create index if not exists therapy_center_accounts_user_idx
  on public.therapy_center_accounts (user_id)
  where user_id is not null;

alter table public.therapists
  add column if not exists center_account_id uuid
    references public.therapy_center_accounts(id) on delete set null;

create index if not exists therapists_center_account_idx
  on public.therapists (center_account_id)
  where center_account_id is not null;

-- service_role מריץ את כל הקריאות/כתיבות (פורטל + אדמין). ה-GRANT מפורש לפי
-- כלל הפרויקט (20260702_rls_scope_service_role) — additive, לא מצמצם דבר.
grant select, insert, update on public.therapy_center_accounts to service_role;
grant select, update on public.therapists to service_role;
