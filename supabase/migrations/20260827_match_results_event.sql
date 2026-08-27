-- match_results: כמה אפשרויות הוחזרו בפועל בחיפוש התאמה.
-- match_search אומר מה ביקשו; זה אומר מה קיבלו. בלי זה סוכן פערי
-- ההיצע סופר מלאי ולא חוויה - אזור נראה "מכוסה" גם כשעל המסך היו שתי אפשרויות.
--
-- הרשימה נכתבת במלואה בכוונה: DROP מוחק את הרשימה הקודמת, וכל ערך
-- שלא יופיע כאן יחסום אירועים קיימים. מקור האמת: app/lib/analytics-event-types.ts.
alter table public.analytics_events drop constraint if exists analytics_events_event_type_check;

alter table public.analytics_events add constraint analytics_events_event_type_check check (
  event_type in (
    'page_view',
    'profile_impression',
    'filter_used',
    'quiz_step',
    'quiz_complete',
    'quiz_treatments',
    'recommendation_explain_click',
    'match_free_fallback',
    'recruit_page_view',
    'therapist_explain_click',
    'matching_click',
    'match_search',
    'match_results',
    'match_saved',
    'center_page_view',
    'center_website_click',
    'center_contact_click'
  )
);
