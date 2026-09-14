-- שני CHECK כפולים חיו על analytics_events: analytics_events_event_type_check
-- ו-valid_event_type. מיגרציית match_results הרחיבה רק את הראשון, והשני דחה
-- כל אירוע חדש - 52 חיפושי התאמה נרשמו ואף תוצאה אחת לא, בשקט מוחלט.
--
-- מכאן והלאה נשאר CHECK אחד בלבד, ששמו valid_event_type (זה שה-RPC של שומר
-- הלילה בודק). מקור האמת לרשימה: app/lib/analytics-event-types.ts.
alter table public.analytics_events drop constraint if exists analytics_events_event_type_check;
alter table public.analytics_events drop constraint if exists valid_event_type;
alter table public.analytics_events add constraint valid_event_type check (
  event_type in (
    'page_view','profile_impression','filter_used','quiz_step','quiz_complete',
    'quiz_treatments','recommendation_explain_click','match_free_fallback',
    'recruit_page_view','therapist_explain_click','matching_click',
    'match_search','match_results','match_saved',
    'center_page_view','center_website_click','center_contact_click'
  )
);
