-- שורת ישות-מרכז אחת בלבד לכל מרכז. האינדקס החלקי הקודם לא היה ייחודי, ושתי
-- שורות (מרוץ ב-ensureCenterEntityRow / החלפת מסלול) היו מפילות כל maybeSingle
-- שקורא אותן: הפורטל היה מציג "הפרופיל בהכנה", כל הסטטיסטיקות נעלמות, והעמוד
-- הציבורי מאבד את "מה המרכז מציע" - בשקט.
drop index if exists therapists_center_entity_idx;
create unique index if not exists therapists_center_entity_uniq
  on public.therapists (center_account_id)
  where entity_type = 'center';

grant select, insert, update, delete on public.therapists to service_role;
