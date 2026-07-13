-- Fix: 'matching_click' and 'therapist_explain_click' (added to the app in
-- commit ae16b89, deployed 2026-07-11) were never added to the valid_event_type
-- CHECK constraint, so every such insert was silently rejected — /api/track
-- swallowed the error. Same failure mode as the site_message contacts bug
-- (20260711_contact_clicks_allow_site_message). Events sent between 11/7 and
-- this migration are lost; from here on they insert normally.
--   matching_click          — patient clicked "מצא לי מטפל" (top of match funnel)
--   therapist_explain_click — patient opened the per-therapist "✦ ניתוח אישי"

alter table public.analytics_events
  drop constraint if exists valid_event_type;

alter table public.analytics_events
  add constraint valid_event_type check (event_type in (
    'page_view',
    'profile_impression',
    'filter_used',
    'quiz_step',
    'quiz_complete',
    'recommendation_explain_click',
    'match_free_fallback',
    'recruit_page_view',
    'therapist_explain_click',
    'matching_click'
  ));

-- Per project rule: every migration re-asserts service_role grants explicitly
-- (grants are additive — this never narrows existing ones).
grant select, insert on public.analytics_events to service_role;
