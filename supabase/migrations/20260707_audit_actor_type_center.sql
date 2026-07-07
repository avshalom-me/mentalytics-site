-- מוסיף 'center' לסוגי השחקן ביומן הביקורת — פעולות שמרכז טיפולי מבצע
-- מהפורטל (יצירת/עריכת פרופיל מטפל) נרשמות בשם המרכז, לא כ-system.
alter table public.therapist_audit_log
  drop constraint if exists therapist_audit_log_actor_type_check;
alter table public.therapist_audit_log
  add constraint therapist_audit_log_actor_type_check
  check (actor_type = any (array['admin'::text, 'self'::text, 'sumit'::text, 'cron'::text, 'system'::text, 'center'::text]));
