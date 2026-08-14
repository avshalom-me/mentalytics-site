-- פנייה דרך האתר אל מרכז טיפולי (ולא אל מטפל/ת בודד/ת).
--
-- עד כה כל פנייה ב-crm_leads הייתה מיוחסת ל-therapist_id. מרכז מסלול-2 מיוצג
-- בשורת ישות ב-therapists ולכן נכנס לשם; מרכז מסלול-1 (מטפלים בנפרד) אינו
-- קיים כשורת מטפל, ופנייה אליו הייתה נשמרת בלי שום ייחוס - ליד יתום שאי אפשר
-- לדעת למי הוא נועד. העמודה הזו נותנת לו כתובת.
alter table public.crm_leads
  add column if not exists center_account_id uuid
    references public.therapy_center_accounts(id) on delete set null;

create index if not exists crm_leads_center_account_id_idx
  on public.crm_leads (center_account_id)
  where center_account_id is not null;

-- מדיניות ה-grants של הפרויקט: כל טבלה/עמודה חדשה נגישה ל-service_role בלבד
-- (המפתח הציבורי אינו כותב ל-CRM).
grant select, insert, update on public.crm_leads to service_role;
