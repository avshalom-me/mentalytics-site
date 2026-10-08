-- The recruitment funnel past the join page (8/10/2026).
--
-- /therapists/join measured one thing, the page view. Of the people a
-- Facebook ad brought nobody could say how many pressed "open a free profile"
-- and left at the next screen, so a week of ad spend ended in "no signups"
-- with no way to tell a page nobody scrolled from a form nobody finished.
--
--   recruit_cta_click     a press on a register button of a recruitment page
--   recruit_register_view the register tab of the therapist login screen shown
--
-- One CHECK on the table, named valid_event_type (the one the nightly guard
-- reads); the list is app/lib/analytics-event-types.ts. Order matters: this runs
-- BEFORE the code that sends the events is deployed, because a row with a type
-- the CHECK does not know is rejected and /api/track answers 500.
alter table public.analytics_events drop constraint if exists analytics_events_event_type_check;
alter table public.analytics_events drop constraint if exists valid_event_type;
alter table public.analytics_events add constraint valid_event_type check (
  event_type in (
    'page_view','profile_impression','filter_used','quiz_step','quiz_complete',
    'quiz_treatments','recommendation_explain_click','match_free_fallback',
    'recruit_page_view','recruit_cta_click','recruit_register_view',
    'therapist_explain_click','matching_click',
    'match_search','match_results','match_saved',
    'center_page_view','center_website_click','center_contact_click'
  )
);
