-- איתור מכונים: סטטוס "לא רלוונטי כרגע - לעבודה בהמשך", וחותמת תאריך לכל
-- שינוי סטטוס.
--
-- not_relevant_now: כמו later אבל בלי תאריך חזרה ובלי תזכורת. אילוץ CHECK
-- ולא enum, ולכן drop+add באותה טרנזקציה - בלעדיו המסד דוחה את הבחירה.
--
-- status_changed_at + status_history: נכתבים מעכשיו בכל מסלול שמשנה סטטוס
-- (center-prospects.ts). המילוי לאחור הוא רק למה שידוע באמת: מכון שעבר
-- לעסקאות - תאריך פתיחת העסקה; מכון בסטטוס פנייה - contacted_at, שנקבע ברגע
-- הבחירה בסטטוס. "לא מעוניין" ו"אולי בעתיד" נשארים בלי תאריך - לא ידוע מתי.
-- הוחל דרך MCP ב-29/9/26.

alter table public.center_prospects
  drop constraint if exists center_prospects_status_check;

alter table public.center_prospects
  add constraint center_prospects_status_check
  check (status in (
    'new',
    'contacted',
    'contacted_email',
    'contacted_phone',
    'later',
    'not_relevant_now',
    'not_interested',
    'moved_to_deal'
  ));

alter table public.center_prospects
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_history jsonb not null default '[]'::jsonb;

update public.center_prospects p
   set status_changed_at = d.created_at
  from public.crm_deals d
 where p.deal_id = d.id
   and p.status = 'moved_to_deal'
   and p.status_changed_at is null;

update public.center_prospects
   set status_changed_at = contacted_at
 where status in ('contacted', 'contacted_email', 'contacted_phone')
   and contacted_at is not null
   and status_changed_at is null;

update public.center_prospects
   set status_history = jsonb_build_array(jsonb_build_object('status', status, 'at', status_changed_at))
 where status_changed_at is not null
   and status_history = '[]'::jsonb;

grant select, insert, update, delete on public.center_prospects to service_role;
