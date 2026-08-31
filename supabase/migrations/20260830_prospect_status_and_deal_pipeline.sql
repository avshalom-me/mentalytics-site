-- CRM מכונים: סטטוס מפורש (new/contacted/later/not_interested/moved_to_deal)
-- + follow_up_at + status_note + deal_id, וגזירה חד-פעמית מהשדות הישנים.
-- עסקאות: prospect_id + region_key, ותחנות הצינור החדשות
-- (first_contact/negotiation/link_sent/closed/lost) כולל מיפוי הערכים הישנים.
-- הקובץ המלא הוחל דרך MCP ב-30/8/26 (prospect_status_and_deal_pipeline).
alter table public.center_prospects
  add column if not exists status text not null default 'new'
    check (status in ('new','contacted','later','not_interested','moved_to_deal')),
  add column if not exists follow_up_at timestamptz,
  add column if not exists status_note text,
  add column if not exists deal_id uuid references public.crm_deals(id) on delete set null;
update public.center_prospects set status = 'contacted' where contacted_at is not null and status = 'new';
update public.center_prospects set status = 'not_interested' where answer = 'no';
alter table public.crm_deals
  add column if not exists prospect_id uuid references public.center_prospects(id) on delete set null,
  add column if not exists region_key text;
update public.crm_deals set stage = 'first_contact' where stage = 'inquiry';
update public.crm_deals set stage = 'negotiation' where stage in ('meeting','pilot','proposal');
update public.crm_deals set stage = 'link_sent' where stage = 'contract';
update public.crm_deals set stage = 'closed' where stage = 'won';
alter table public.crm_deals drop constraint if exists crm_deals_stage_check;
alter table public.crm_deals add constraint crm_deals_stage_check check (
  stage in ('first_contact','negotiation','link_sent','closed','lost')
);
create index if not exists center_prospects_status_idx on public.center_prospects (status, follow_up_at);
