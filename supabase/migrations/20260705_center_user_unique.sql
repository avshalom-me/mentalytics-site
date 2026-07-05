-- הקשחת פורטל מרכזים (2026-07-05): אילוץ ייחוד על user_id.
--
-- ה-claim מזהה מרכז לפי user_id עם maybeSingle — אם בטעות שני מרכזים יקושרו
-- לאותו משתמש (למשל אדמין שיצר שתי הצעות לאותו אדם), ה-lookup ייכשל וכל
-- הכניסה תישבר. אינדקס ייחודי חלקי מונע את המצב מהשורש (ומשמש גם ל-lookup,
-- אז מחליף את האינדקס הלא-ייחודי הקודם).

drop index if exists public.therapy_center_accounts_user_idx;

create unique index if not exists therapy_center_accounts_user_uniq
  on public.therapy_center_accounts (user_id)
  where user_id is not null;
