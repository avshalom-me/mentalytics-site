-- לחיצת קשר: מכשיר, דגל אוטומציה, וגולש אחד נספר פעם אחת.
--
-- ב-6/10/2026 גולש אחד (מפרסומת בגוגל) לחץ 14 פעמים על "חיוג" בפרופיל של מטפלת,
-- בתוך 34 שניות, וכל לחיצה נרשמה כשורה. בכל ההיסטוריה (704 שורות) אין עוד זוג
-- לחיצות של אותו גולש על אותו כפתור בהפרש של פחות משנייה, ולכן זו לא הייתה כפילות
-- של האתר. מה שחסר היה דרך להכריע בין אדם שלחץ שוב ושוב על קישור שלא הגיב לבין
-- כלי אוטומטי: סינון הבוטים בודק את ה-User-Agent ברגע הבקשה ולא משאיר זכר.
--
-- device     'mobile' / 'tablet' / 'desktop', מה-User-Agent בשרת. ריק = שורה ישנה.
--            בלי CHECK בכוונה: ערך חדש בקוד לא צריך להיתקע על אילוץ בטבלה.
-- automated  true = הדפדפן עצמו הצהיר שהוא נשלט בידי כלי אוטומציה
--            (navigator.webdriver); false = הלקוח דיווח שלא; ריק = לא דווח (שורה
--            ישנה, או דף ישן שנשאר במטמון של הגולש). false אינו הוכחה לאדם:
--            כלי שמסתיר את הדגל עובר.
--
-- record_contact_click היא הכתיבה היחידה של לחיצות מכפתורי הקשר (/api/track-click).
-- לחיצה חוזרת של אותו גולש (session_id) על אותו מטפל, מאותו סוג (וואטסאפ / טלפון /
-- מייל), בתוך p_window_seconds שניות, לא נרשמת. הראשונה נשמרת תמיד, ולכן הכרעה
-- של "אפס פניות מול לפחות אחת" (ערבות ההחזר) לא משתנה. הבדיקה והכתיבה נעשות תחת
-- נעילה לפי (גולש, מטפל, סוג): שתי בקשות יכולות להגיע באותו רגע (ב-6/10 נרשמו
-- שתיים ברווח של 66 מיקרו-שניות), ובדיקה בלי נעילה הייתה מעבירה את שתיהן. בלי
-- session_id אין לפי מה לזהות גולש, ולכן הלחיצה נרשמת תמיד.
-- מחזירה true כשנרשמה שורה, false כשדולגה כחזרה. ההיסטוריה לא נגעה: רק לחיצות
-- מ-7/10/2026 ואילך נספרות כך.
alter table public.therapist_contact_clicks
  add column if not exists device text,
  add column if not exists automated boolean;

comment on column public.therapist_contact_clicks.device is
  'מכשיר הגולש לפי ה-User-Agent: mobile / tablet / desktop. ריק = שורה שנרשמה לפני 7/10/2026.';
comment on column public.therapist_contact_clicks.automated is
  'true = הדפדפן הצהיר שהוא נשלט בידי כלי אוטומציה (navigator.webdriver). false = הלקוח דיווח שלא (לא הוכחה לאדם). ריק = לא דווח.';

create or replace function public.record_contact_click(
  p_therapist_id   uuid,
  p_click_type     text,
  p_source         text,
  p_session_id     text,
  p_channel        text,
  p_utm_source     text,
  p_utm_medium     text,
  p_utm_campaign   text,
  p_referrer_host  text,
  p_device         text,
  p_automated      boolean,
  p_window_seconds integer default 120
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_session_id is not null and p_window_seconds > 0 then
    perform pg_advisory_xact_lock(
      hashtextextended(p_session_id || '|' || p_therapist_id::text || '|' || p_click_type, 0)
    );
    if exists (
      select 1
      from public.therapist_contact_clicks c
      where c.therapist_id = p_therapist_id
        and c.session_id   = p_session_id
        and c.click_type   = p_click_type
        and c.clicked_at   > now() - make_interval(secs => p_window_seconds)
    ) then
      return false;
    end if;
  end if;

  insert into public.therapist_contact_clicks (
    therapist_id, click_type, source, session_id,
    channel, utm_source, utm_medium, utm_campaign, referrer_host,
    device, automated
  ) values (
    p_therapist_id, p_click_type, p_source, p_session_id,
    p_channel, p_utm_source, p_utm_medium, p_utm_campaign, p_referrer_host,
    p_device, p_automated
  );
  return true;
end;
$$;

comment on function public.record_contact_click(uuid, text, text, text, text, text, text, text, text, text, boolean, integer) is
  'רושם לחיצת קשר, ודולג על חזרה של אותו גולש על אותו כפתור בתוך p_window_seconds שניות. true = נרשמה, false = דולגה.';

revoke all on function public.record_contact_click(uuid, text, text, text, text, text, text, text, text, text, boolean, integer) from public, anon, authenticated;
grant execute on function public.record_contact_click(uuid, text, text, text, text, text, text, text, text, text, boolean, integer) to service_role;
