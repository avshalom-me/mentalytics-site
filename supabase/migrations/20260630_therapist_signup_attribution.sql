-- Therapist signup attribution: record which marketing touch drove each
-- therapist registration (the lead). Mirrors the click-id capture already on
-- `payments` (20260618_payment_click_ids), but here on the therapist row
-- itself so the admin can measure recruitment campaigns — e.g. a Facebook A/B
-- test — by utm_campaign.
--
-- All columns are nullable: organic / direct signups and every historical row
-- simply carry NULLs (reported as "unknown" / "(ללא קמפיין)").

alter table public.therapists
  add column if not exists signup_channel       text,
  add column if not exists signup_utm_source    text,
  add column if not exists signup_utm_medium    text,
  add column if not exists signup_utm_campaign  text,
  add column if not exists signup_gclid         text,
  add column if not exists signup_gbraid        text,
  add column if not exists signup_wbraid        text,
  add column if not exists signup_fbclid        text;

-- The admin recruitment report aggregates signups by campaign; index only the
-- rows that actually carry a campaign (the paid / tagged ones).
create index if not exists therapists_signup_utm_campaign_idx
  on public.therapists (signup_utm_campaign)
  where signup_utm_campaign is not null;

-- service_role drives every server-side write (signup route) and read (admin
-- report). New columns inherit the existing table grants, but we re-assert
-- explicitly per the project rule that every migration grants service_role.
grant select, insert, update on public.therapists to service_role;
