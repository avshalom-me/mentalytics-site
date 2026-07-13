-- therapist_contact_clicks had no session_id, so a contact click could not be
-- joined to the visitor's views/impressions. That made two things impossible:
--   1. measuring "clicked contact WITHOUT opening the profile" (directory cards
--      have inline WhatsApp/phone buttons — the only surface where that happens);
--   2. any session-level dedup of double clicks.
-- The senders (ContactButtons / TherapistsClient / SiteMessageModal) now pass
-- the same mnt_session_id used by analytics_events and therapist_profile_views.
-- Nullable: old rows and cookie-less visitors stay valid.

alter table public.therapist_contact_clicks
  add column if not exists session_id text;

-- Per project rule: every migration re-asserts service_role grants explicitly
-- (grants are additive — this never narrows existing ones).
grant select, insert on public.therapist_contact_clicks to service_role;
