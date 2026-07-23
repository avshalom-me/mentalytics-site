-- גלריית תמונות של המרכז (הכניסה, חדרי הטיפול, המרחב) — self-serve מהפורטל,
-- מוצגת בעמוד הציבורי /centers/<slug>. מערך {path, caption} (עד 8, נאכף ב-API).
alter table public.therapy_center_accounts
  add column if not exists gallery jsonb not null default '[]'::jsonb;

grant select, insert, update, delete on public.therapy_center_accounts to service_role;
