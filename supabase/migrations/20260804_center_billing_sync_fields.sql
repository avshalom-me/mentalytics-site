-- סנכרון גבייה של מרכזים:
--   sumit_miss_count       — פריט שלא נמצא ב-Sumit נחשב "קריאה עמומה"; רק אחרי
--                            2 החמצות רצופות מורידים (כמו אצל מטפלים). בלי זה
--                            הוראה שנמחקה ב-Sumit השאירה מרכז פעיל לנצח בחינם.
--   last_billed_on         — תאריך החיוב האחרון שכבר שיקפנו כשורת payments,
--                            כדי שהמראה המקומית לא תכפיל רישום.
alter table public.therapy_center_accounts
  add column if not exists sumit_miss_count int not null default 0,
  add column if not exists last_billed_on date;

grant select, insert, update, delete on public.therapy_center_accounts to service_role;
