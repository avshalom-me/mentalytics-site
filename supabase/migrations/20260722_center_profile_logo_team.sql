-- פרופיל מרכז ויזואלי (מסלול 2 בעיקר): לוגו + צוות/ראשי-המרכז. המרכז ממלא
-- self-serve מהפורטל; מוצג בעמוד הציבורי /centers/<slug>.
--   logo_path    — נתיב אחסון ללוגו (bucket therapist-certificates, מוגש signed).
--   team_members — מערך {name, role, photo_path} לכרטיסי הצוות המוביל.
alter table public.therapy_center_accounts
  add column if not exists logo_path text,
  add column if not exists team_members jsonb not null default '[]'::jsonb;

grant select, insert, update, delete on public.therapy_center_accounts to service_role;
