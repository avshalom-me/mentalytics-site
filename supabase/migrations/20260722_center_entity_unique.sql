-- שורת ישות-מרכז אחת בלבד לכל מרכז: הופך את האינדקס החלקי לייחודי כדי שמרוץ
-- (למשל double-click על שמירת הצעה) לא ייצור שתי שורות ישות — מצב שהיה מקדם
-- רובריקה כפולה בהתאמות ושובר את שליפת ה-.maybeSingle() בפורטל.
drop index if exists public.therapists_center_entity_idx;
create unique index if not exists therapists_center_entity_idx
  on public.therapists (center_account_id)
  where entity_type = 'center';
