-- תוכן הפניות של מטופלים למטפלים ולמרכזים יוצא מ-crm_leads.
--
-- פנייה שגולש שולח למטפל/ת או למרכז דרך טופס האתר (source = 'site_message')
-- נשלחת במייל לנמען, ונרשמה עד 11/10/2026 גם ב-crm_leads יחד עם שם הפונה, פרטי
-- הקשר שלו וההודעה עצמה. כל מסך אדמין שקורא את הטבלה (מסך הלידים, ציר הזמן
-- בכרטיס המטפל, "צפייה בתור מרכז") הציג אותם. הבעלים קבע: התוכן הזה שייך לנמען
-- בלבד, והצוות לא רואה אותו. ממשיכים לספור.
--
-- מה שנשאר ב-crm_leads: השורה עצמה - מתי, לאיזה מטפל/ת או מרכז, מאיזה ערוץ -
-- כי הספירות נשענות עליה (שומר הלילה, דוח הבוקר, מסכי המרכזים). שלוש העמודות
-- הרגישות (name, contact, message) ריקות בשורות האלה. טריגר מרוקן אותן בכל
-- כתיבה, כך שגם קוד עתידי שינסה לכתוב אותן לא יצליח, וגם קריאה של "כל העמודות"
-- מכל מסך קיים או עתידי לא יכולה להחזיר את התוכן.
--
-- למה טריגר ולא רק אילוץ: כשאילוץ נכשל, Postgres כותב ללוג שלו את השורה שנדחתה
-- ("Failing row contains ..."), כלומר בדיוק את התוכן שרצינו להרחיק. הטריגר
-- מרוקן לפני שהאילוץ נבדק, ולכן האילוץ נשאר רק כהצהרה שאי אפשר לעקוף.
--
-- private_inquiries מחזיקה את התוכן. הקורא היחיד שלה: פורטל המרכז, ורק להודעות
-- שהגיעו לתיבת המרכז (crm_leads.received_by_center_id). קוד האדמין לא נוגע בה,
-- ובדיקה אוטומטית (app/lib/private-inquiry.test.ts) מוודאת ששם הטבלה והמודול
-- שקורא ממנה מופיעים רק בקבצים המותרים. היא לא בגיבוי ל-Drive, והנתונים שלה
-- מוחרגים מהגיבוי של GitHub (.github/workflows/daily-backup.yml).
--
-- שני שלבים, כי הקוד הישן והחדש חיים יחד בזמן הפריסה:
--   שלב 1 (לפני הפריסה): יצירת הטבלה והעתקת התוכן הקיים. הקוד הישן לא מושפע.
--   שלב 2 (אחרי שהקוד החדש באוויר): העתקת מה שנכתב בינתיים, ריקון העמודות
--   ב-crm_leads, הטריגר והאילוץ.

-- ── שלב 1 ────────────────────────────────────────────────────────────────────
create table if not exists public.private_inquiries (
  lead_id        uuid primary key references public.crm_leads(id) on delete cascade,
  sender_name    text,
  sender_contact text,
  message        text,
  created_at     timestamptz not null default now()
);

comment on table public.private_inquiries is
  'התוכן של פנייה שגולש שלח למטפל/ת או למרכז דרך האתר: שם, פרטי קשר, הודעה. שייך לנמען בלבד. קוד האדמין לא קורא מכאן; הקורא היחיד הוא פורטל המרכז, להודעות שהגיעו לתיבת המרכז.';

-- RLS בלי אף policy: רק service_role (שעוקף RLS) מגיע לטבלה. בלי הרשאות ל-anon
-- ול-authenticated בכלל, כדי שלא תהיה תלות ב-RLS לבדו.
alter table public.private_inquiries enable row level security;
revoke all on public.private_inquiries from public, anon, authenticated;
grant select, insert, delete on public.private_inquiries to service_role;

insert into public.private_inquiries (lead_id, sender_name, sender_contact, message, created_at)
select id, name, contact, message, created_at
from public.crm_leads
where source = 'site_message'
  and (name is not null or contact is not null or message is not null)
on conflict (lead_id) do nothing;

-- ── שלב 2 ────────────────────────────────────────────────────────────────────
-- מה שנכתב ל-crm_leads בזמן הפריסה, בידי הקוד הישן.
insert into public.private_inquiries (lead_id, sender_name, sender_contact, message, created_at)
select id, name, contact, message, created_at
from public.crm_leads
where source = 'site_message'
  and (name is not null or contact is not null or message is not null)
on conflict (lead_id) do nothing;

update public.crm_leads
set name = null, contact = null, message = null
where source = 'site_message'
  and (name is not null or contact is not null or message is not null);

create or replace function public.crm_leads_strip_private_content()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.source = 'site_message' then
    new.name := null;
    new.contact := null;
    new.message := null;
  end if;
  return new;
end;
$$;

revoke all on function public.crm_leads_strip_private_content() from public, anon, authenticated;

drop trigger if exists crm_leads_strip_private_content on public.crm_leads;
create trigger crm_leads_strip_private_content
  before insert or update on public.crm_leads
  for each row execute function public.crm_leads_strip_private_content();

alter table public.crm_leads
  drop constraint if exists crm_leads_site_message_has_no_content;
alter table public.crm_leads
  add constraint crm_leads_site_message_has_no_content
  check (source is distinct from 'site_message' or (name is null and contact is null and message is null));
