-- Fix: site-message contacts were silently rejected by the therapist_contact_clicks
-- CHECK constraints. click_type lacked 'site_message' and source lacked 'profile',
-- so every site-message contact (sent via /api/contact-therapist from a profile page)
-- failed to insert and was dropped from ALL contact metrics — the therapist dashboard,
-- /admin/attribution, /admin/analytics, and the refund-guarantee contact count.
-- Widen both constraints to exactly the values the app writes:
--   click_type: whatsapp | phone | email | site_message
--   source:     match | directory | profile
-- Additive change (existing rows stay valid); no data migration needed.

alter table public.therapist_contact_clicks
  drop constraint if exists therapist_contact_clicks_click_type_check;
alter table public.therapist_contact_clicks
  add constraint therapist_contact_clicks_click_type_check
    check (click_type = any (array['whatsapp'::text, 'phone'::text, 'email'::text, 'site_message'::text]));

alter table public.therapist_contact_clicks
  drop constraint if exists therapist_contact_clicks_source_check;
alter table public.therapist_contact_clicks
  add constraint therapist_contact_clicks_source_check
    check (source = any (array['match'::text, 'directory'::text, 'profile'::text]));
