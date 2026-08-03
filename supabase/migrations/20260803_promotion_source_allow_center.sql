-- קידום מטפלי מרכז נכשל בשקט מאז ומעולם: promoteCenterTherapists כותב
-- promotion_source='center', אבל ה-CHECK התיר רק paid/manual/trial —
-- העדכון נפל, המטפל נשאר approved ולא נכנס להתאמות. אותה תבנית כמו
-- site_message (11/7) ו-center_subscription (2/8): ערך חדש בקוד מחייב
-- הרחבת ה-constraint. התגלה ב-e2e של מסלול 1, 3/8/26.
alter table public.therapists drop constraint therapists_promotion_source_check;
alter table public.therapists add constraint therapists_promotion_source_check
  check (promotion_source = any (array['paid'::text, 'manual'::text, 'trial'::text, 'center'::text]));

grant select, insert, update, delete on public.therapists to service_role;
