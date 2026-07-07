-- עמוד מרכז ציבורי (SEO) — הטבה במסלול הממומן. שדות ציבוריים + slug ל-URL.
-- public_page_enabled: המרכז/אדמין מדליקים את העמוד (ברירת מחדל כבוי עד מילוי).
alter table public.therapy_center_accounts
  add column if not exists slug text,
  add column if not exists public_page_enabled boolean not null default false,
  add column if not exists public_description text,
  add column if not exists public_managers text,
  add column if not exists public_city text,
  add column if not exists public_website text,
  add column if not exists public_phone text;

-- slug ייחודי (מרובה-null מותר) — ה-URL הציבורי /centers/<slug>.
create unique index if not exists therapy_center_accounts_slug_key
  on public.therapy_center_accounts (slug) where slug is not null;

-- נוהל הפרויקט: GRANT מפורש ל-service_role על כל שינוי סכימה.
grant select, insert, update, delete on public.therapy_center_accounts to service_role;
