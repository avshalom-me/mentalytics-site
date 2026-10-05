-- קידום מתנה למרכז (בלי כרטיס), וסיבת העצירה של מנוי שנעצר.
--
-- עד 5/10/2026 מרכז יכול היה להיות באוויר רק עם הוראת קבע ב-Sumit, ומרכז
-- שהמנוי שלו בוטל נשאר במסך האדמין בלי אף פעולה: אי אפשר היה להחזיר אותו,
-- ולא נשמר למה הוא נעצר. למטפל יש שני כלים שלמרכז לא היו: קידום במתנה מהאדמין
-- (חודשים או בלי תאריך סיום, בלי כרטיס), וביטול מנוי שמשאיר את הפרופיל במקומו.
--
-- gift_granted_at  מתי האדמין נתן קידום מתנה. מלא + status='active' = המרכז
--                  באוויר בלי הוראת קבע ובלי חיוב. מתרוקן כשהמרכז נעצר או עובר
--                  לתשלום.
-- gift_until       מתי המתנה נגמרת; ריק = בלי תאריך סיום. הקרון היומי
--                  (sumit-status-sync) עוצר את המרכז כשהתאריך עובר.
-- cancel_reason    למה המנוי נעצר: 'admin' (מהאדמין), 'sumit' (הוראת הקבע
--                  בוטלה ב-Sumit), 'gift_ended' (תקופת המתנה הסתיימה). ריק אצל
--                  מרכז שנעצר לפני שהעמודה נוספה. בלי CHECK בכוונה: ערך חדש
--                  בקוד לא צריך להיתקע על אילוץ בטבלה.
--
-- לא להתבלבל עם gift_months: אלה חודשי המתנה שבהצעה בתשלום (הכרטיס נשמר
-- והחיוב הראשון נדחה). כאן אין כרטיס בכלל.
alter table public.therapy_center_accounts
  add column if not exists gift_granted_at timestamptz,
  add column if not exists gift_until timestamptz,
  add column if not exists cancel_reason text;

comment on column public.therapy_center_accounts.gift_granted_at is
  'מתי האדמין נתן למרכז קידום מתנה (בלי כרטיס). מלא יחד עם status=active = המרכז באוויר בלי הוראת קבע ובלי חיוב.';
comment on column public.therapy_center_accounts.gift_until is
  'סוף קידום המתנה. ריק = בלי תאריך סיום. כשהתאריך עובר, הקרון היומי עוצר את המרכז (cancel_reason=gift_ended).';
comment on column public.therapy_center_accounts.cancel_reason is
  'למה המנוי נעצר: admin / sumit / gift_ended. ריק = נעצר לפני 5/10/2026.';

grant select, insert, update on public.therapy_center_accounts to service_role;
