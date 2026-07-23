-- תוספות להצעת המרכז: הנחה בסכום קבוע (₪/חודש) ומספר מיקומים (מכפיל מחיר).
-- הסכום החודשי = (בסיס × מספר מיקומים) − הנחה. חודשי המתנה (gift_months) כבר קיימים.
alter table public.therapy_center_accounts
  add column if not exists discount_amount numeric not null default 0,
  add column if not exists num_locations integer not null default 1;

alter table public.therapy_center_accounts
  drop constraint if exists therapy_center_accounts_discount_chk;
alter table public.therapy_center_accounts
  add constraint therapy_center_accounts_discount_chk check (discount_amount >= 0);

alter table public.therapy_center_accounts
  drop constraint if exists therapy_center_accounts_locations_chk;
alter table public.therapy_center_accounts
  add constraint therapy_center_accounts_locations_chk check (num_locations >= 1);

grant select, insert, update, delete on public.therapy_center_accounts to service_role;
