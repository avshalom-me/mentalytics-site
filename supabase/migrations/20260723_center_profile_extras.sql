-- הרחבת הפרופיל הציבורי של מרכז: עובדות-אמון, דבר המנהל/ת, מידע פרקטי, FAQ.
-- כולם self-serve מהפורטל; מוצגים בעמוד /centers/<slug> רק כשמולאו.
alter table public.therapy_center_accounts
  add column if not exists public_founded_year int check (public_founded_year is null or (public_founded_year between 1900 and 2100)),
  add column if not exists public_team_size int check (public_team_size is null or public_team_size >= 0),
  add column if not exists public_address text,
  add column if not exists public_hours text,
  add column if not exists public_accessibility text,
  add column if not exists public_director jsonb not null default '{}'::jsonb, -- {name, role, note, photo_path}
  add column if not exists public_faq jsonb not null default '[]'::jsonb;      -- [{q, a}] עד 6, נאכף ב-API

grant select, insert, update, delete on public.therapy_center_accounts to service_role;
