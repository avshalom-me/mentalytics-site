-- לאיזו תיבת דואר של מרכז הגיעה הודעת האתר - נקבע ברגע השליחה.
--
-- פורטל המרכז מציג את ההודעות שהמרכז קיבל בפועל. זה לא נגזר מהמצב הנוכחי:
-- מטפל/ת של מרכז שיש לו/ה מייל אישי מקבל/ת את הפנייה לתיבה הפרטית, והמרכז
-- לא אמור לראות אותה (therapist-recipient.ts: "פנייה של מטופל שייכת למי
-- שיטפל בו"). אילו הפורטל היה בודק "האם למטפל יש כרגע מייל", מרכז שמוחק את
-- השדה בפרופיל - והמרכז הוא שעורך פרופילים במסלול 1 - היה חושף בדיעבד את כל
-- ההודעות הפרטיות שכבר נשלחו. לכן היעד נרשם פעם אחת, כשהמייל יוצא.
--
-- עמודה נפרדת ולא center_account_id: לשדה ההוא כבר יש משמעות ("הודעה לעמוד
-- המרכז במסלול 1") ו-admin-centers סופר לפיו הודעות שאינן בתוך לחיצות הישות.
-- מילוי שלו גם בהודעות למטפלים היה סופר אותן פעמיים.
alter table public.crm_leads
  add column if not exists received_by_center_id uuid
    references public.therapy_center_accounts(id) on delete set null;

create index if not exists crm_leads_received_by_center_idx
  on public.crm_leads (received_by_center_id, created_at desc)
  where received_by_center_id is not null;

-- מילוי לאחור. שלושה מקרים שבהם ההודעה נחתה בתיבת המרכז:
-- 1. הודעה לישות-מרכז (מסלול 2) - הנמען הוא המרכז עצמו.
update public.crm_leads l
   set received_by_center_id = t.center_account_id
  from public.therapists t
 where l.therapist_id = t.id
   and t.entity_type = 'center'
   and t.center_account_id is not null
   and l.source = 'site_message'
   and l.received_by_center_id is null;

-- 2. הודעה מעמוד המרכז (מסלול 1).
update public.crm_leads
   set received_by_center_id = center_account_id
 where therapist_id is null
   and center_account_id is not null
   and source = 'site_message'
   and received_by_center_id is null;

-- 3. הודעה למטפל/ת במסלול 1 שנפלה לתיבת המרכז: אין מייל אישי, או שהמייל
--    שהוזן הוא בעצם תיבת המרכז. להודעות העבר זה המידע הטוב ביותר שיש.
update public.crm_leads l
   set received_by_center_id = t.center_account_id
  from public.therapists t
  join public.therapy_center_accounts c on c.id = t.center_account_id
 where l.therapist_id = t.id
   and t.entity_type <> 'center'
   and l.source = 'site_message'
   and l.received_by_center_id is null
   and (
     nullif(trim(t.email), '') is null
     or lower(trim(t.email)) = lower(trim(coalesce(c.email, '')))
     or lower(trim(t.email)) = lower(trim(coalesce(c.payer_email, '')))
   );

grant select, insert, update on public.crm_leads to service_role;
