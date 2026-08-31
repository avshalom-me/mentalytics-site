-- סיבת אבודה כערך סגור ולא טקסט חופשי: בעוד חצי שנה השאלה "למה עסקאות
-- נופלות" צריכה להיענות בשאילתה אחת, ולא בקריאת הערות.
alter table public.crm_deals
  add column if not exists lost_reason text
  check (lost_reason is null or lost_reason in ('price','competitor','not_relevant','no_response','timing','other'));
