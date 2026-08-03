-- מנוי מרכז טיפולי נכשל ב"שגיאה פנימית": /api/centers/subscribe מכניס
-- payment_type='center_subscription', אבל ה-CHECK הישן התיר רק
-- subscription/subscription_renewal/quiz — ה-insert (מנעול הכפילות) נפל עוד
-- לפני Sumit, ואף מרכז לא יכול היה לשלם. אותה תבנית כמו באג site_message
-- (11/7): ערך חדש בקוד מחייב הרחבת ה-constraint.
alter table public.payments drop constraint payments_payment_type_check;
alter table public.payments add constraint payments_payment_type_check
  check (payment_type = any (array['subscription'::text, 'subscription_renewal'::text, 'quiz'::text, 'center_subscription'::text]));

grant select, insert, update, delete on public.payments to service_role;
