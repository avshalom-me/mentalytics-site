-- בדיקת דריפט של constraint האירועים, עבור שומר הלילה (סוכן 2).
--
-- valid_event_type על analytics_events כבר "בלע" אירועים בשקט פעמיים -
-- קוד שלח סוג אירוע חדש, ה-CHECK דחה אותו, והשגיאה נבלעה בנתיב הניטור
-- (ראה 20260713_analytics_events_matching_explain_events.sql). הפונקציה
-- הזו מחזירה את ההגדרה החיה של ה-constraint, כדי ששומר הלילה ישווה אותה
-- כל לילה מול רשימת האירועים שהקוד מכיר ויתריע על הפעם השלישית תוך יום.
create or replace function public.admin_event_constraint_def()
returns text
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select pg_get_constraintdef(c.oid)
  from pg_constraint c
  where c.conname = 'valid_event_type'
    and c.conrelid = 'public.analytics_events'::regclass;
$$;

revoke all on function public.admin_event_constraint_def() from public;
revoke all on function public.admin_event_constraint_def() from anon, authenticated;
grant execute on function public.admin_event_constraint_def() to service_role;
