-- /api/admin-analytics used to download every analytics_events row in the
-- period (46k rows / ~8 MB for a month, 128k / ~22 MB for all time, in pages of
-- 1000) and aggregate them in JS. This returns the same events already grouped:
-- one row per distinct combination of the fields that route actually reads,
-- with a count, so the route can expand them back and run its aggregation code
-- unchanged. A month comes back as ~1.6k groups, all time as ~3.3k.
--
-- Fields per event type - exactly what the route reads, nothing else:
--   page_view                     week, metadata.page
--   profile_impression            week, therapist_id
--   quiz_complete                 metadata.quiz_type
--   quiz_step                     metadata.quiz_type, metadata.step
--   filter_used                   metadata.filter_value
--   recommendation_explain_click  metadata.questionnaire_type, treatment_label,
--                                 viewer_age_band, viewer_gender, viewer_region, domain
--
-- Metadata values are returned as jsonb, not text, so the route sees the same
-- JS value it saw in the raw row and applies its own truthiness and String()
-- coercion to it. The week is the Monday of the event's UTC week - the same
-- anchor as getWeek() in the route.
--
-- Groups come back ordered by their first event, which keeps the order in which
-- each name, step or therapist first appears - the tie-break of every sort in the
-- route. Positional arrays keep the payload small:
--   [event_type, week, therapist_id, page, quiz_type, step, filter_value,
--    questionnaire_type, treatment_label, viewer_age_band, viewer_gender,
--    viewer_region, domain, n]

create or replace function public.admin_analytics_event_groups(
  p_since timestamptz default null,
  p_until timestamptz default null
)
returns jsonb
language sql
stable
set search_path = public
as $fn$
  select coalesce(
    jsonb_agg(
      jsonb_build_array(
        g.event_type, g.week, g.therapist_id, g.page, g.quiz_type, g.step, g.filter_value,
        g.questionnaire_type, g.treatment_label, g.viewer_age_band, g.viewer_gender,
        g.viewer_region, g.domain, g.n
      )
      order by g.first_seen, g.event_type, g.week, g.therapist_id,
        g.page::text, g.quiz_type::text, g.step::text, g.filter_value::text,
        g.questionnaire_type::text, g.treatment_label::text, g.viewer_age_band::text,
        g.viewer_gender::text, g.viewer_region::text, g.domain::text
    ),
    '[]'::jsonb
  )
  from (
    select
      e.event_type,
      case when e.event_type in ('page_view', 'profile_impression')
        then to_char(date_trunc('week', e.created_at at time zone 'UTC'), 'YYYY-MM-DD') end as week,
      case when e.event_type = 'profile_impression' then e.therapist_id end as therapist_id,
      case when e.event_type = 'page_view' then e.metadata -> 'page' end as page,
      case when e.event_type in ('quiz_step', 'quiz_complete') then e.metadata -> 'quiz_type' end as quiz_type,
      case when e.event_type = 'quiz_step' then e.metadata -> 'step' end as step,
      case when e.event_type = 'filter_used' then e.metadata -> 'filter_value' end as filter_value,
      case when e.event_type = 'recommendation_explain_click' then e.metadata -> 'questionnaire_type' end as questionnaire_type,
      case when e.event_type = 'recommendation_explain_click' then e.metadata -> 'treatment_label' end as treatment_label,
      case when e.event_type = 'recommendation_explain_click' then e.metadata -> 'viewer_age_band' end as viewer_age_band,
      case when e.event_type = 'recommendation_explain_click' then e.metadata -> 'viewer_gender' end as viewer_gender,
      case when e.event_type = 'recommendation_explain_click' then e.metadata -> 'viewer_region' end as viewer_region,
      case when e.event_type = 'recommendation_explain_click' then e.metadata -> 'domain' end as domain,
      count(*) as n,
      min(e.created_at) as first_seen
    from public.analytics_events e
    where e.event_type in ('page_view', 'profile_impression', 'quiz_complete', 'quiz_step', 'filter_used', 'recommendation_explain_click')
      and (p_since is null or e.created_at >= p_since)
      and (p_until is null or e.created_at < p_until)
    group by 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13
  ) g
$fn$;

revoke all on function public.admin_analytics_event_groups(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_analytics_event_groups(timestamptz, timestamptz) to service_role;
