-- מסלול 2 למרכזים טיפוליים ("אינטייק במרכז" / מרכז כישות אחת):
-- המרכז נכנס למערכת ההתאמות כרובריקה אחת (לא פרופיל-פר-מטפל), בתמחור חודשי
-- קבוע. מסלול 1 הקיים (מחיר-למטפל × מספר) נשאר ברירת המחדל ואינו מושפע.
--
-- billing_track:       'per_therapist' (מסלול 1, ברירת מחדל) | 'center_entity' (מסלול 2)
-- fixed_monthly_price: הסכום החודשי הקבוע (₪, לפני מע"מ) במסלול 2 בלבד.
alter table public.therapy_center_accounts
  add column if not exists billing_track text not null default 'per_therapist',
  add column if not exists fixed_monthly_price numeric;

alter table public.therapy_center_accounts
  drop constraint if exists therapy_center_accounts_billing_track_chk;
alter table public.therapy_center_accounts
  add constraint therapy_center_accounts_billing_track_chk
  check (billing_track in ('per_therapist', 'center_entity'));

-- entity_type על טבלת המטפלים: 'therapist' (מטפל רגיל, ברירת מחדל) | 'center'
-- (שורת ישות-מרכז אחת שמייצגת מרכז שלם בהתאמות ובמאגר — center_account_id
-- מצביע על המרכז, user_id ריק, שדות הסגנון/אישיות ריקים כדי שהניקוד יהיה
-- מקצועי בלבד).
alter table public.therapists
  add column if not exists entity_type text not null default 'therapist';

alter table public.therapists
  drop constraint if exists therapists_entity_type_chk;
alter table public.therapists
  add constraint therapists_entity_type_chk
  check (entity_type in ('therapist', 'center'));

-- אינדקס חלקי לאיתור מהיר של שורת ישות-המרכז לפי המרכז (שורה אחת לכל מרכז).
create index if not exists therapists_center_entity_idx
  on public.therapists (center_account_id)
  where entity_type = 'center';

-- הרשאות מפורשות (נוהל הפרויקט — service_role בלבד; RLS deny-all לאחרים).
grant select, insert, update, delete on public.therapy_center_accounts to service_role;
grant select, insert, update, delete on public.therapists to service_role;
