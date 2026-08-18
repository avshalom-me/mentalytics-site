-- מסלול ההצטרפות בהזמנה ('gift_trial') הוא מקור קידום חדש, וה-CHECK לא
-- הכיר אותו: ההצטרפות הצליחה מול Sumit ונפלה בשורה האחרונה אצלנו.
-- אותה מלכודת בדיוק שכבר נתקלנו בה עם סוגי אירועי אנליטיקה - ערך חדש
-- בקוד מחייב הרחבת ה-constraint.
alter table public.therapists
  drop constraint if exists therapists_promotion_source_check;

alter table public.therapists
  add constraint therapists_promotion_source_check
  check (promotion_source = any (array['paid'::text, 'manual'::text, 'trial'::text, 'center'::text, 'gift_trial'::text]));
