-- The /admin/recruitment funnel showed 3-5 "visitors" while Meta reported
-- hundreds of ad clicks: the ad landing page (/therapists/join) never emitted
-- any analytics event, so the only sessions carrying a utm_campaign were ad
-- clickers who LATER wandered into patient-facing pages (directory / quiz).
--
-- 'recruit_page_view' is fired on recruitment landing pages. It gets its own
-- event type (rather than reusing page_view) so every patient-funnel report
-- that counts page_view — admin-analytics directory entries, the weekly
-- report, the attribution report — stays unaffected by therapist-ad traffic.

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
    'recruit_page_view'
  ));

-- Per project rule: every migration re-asserts service_role grants explicitly
-- (grants are additive — this never narrows existing ones).
grant select, insert on public.analytics_events to service_role;
