-- פילוח ערוץ לכל מטפל, לאבחון "למה הוא לא מקבל פניות".
--
-- עד כה היו רק מספרים מצרפיים (צפיות/פניות בשלושה חלונות), ומהם אי אפשר
-- להבחין בין שני מצבים שדורשים טיפול הפוך:
--   מטפל שכל החשיפה שלו מגיעה מקמפיין ממומן - הרעב שלו הוא תקציבי, והוא
--     ייעלם ברגע שהקמפיין באזור שלו ייעצר.
--   מטפל בלי חשיפה אורגנית כלל - הפרופיל שלו לא מדורג, וזו בעיית תוכן/SEO.
-- לכן הפילוח הוא על ה*צפיות* ולא רק על הפניות: אצל מטפל רעב הפניות הן אפס
-- ממילא, ופילוח של אפס אינו אבחנה.
--
-- החלון הוא 30 יום בלבד - פילוח ערוץ היסטורי מעורבב עם קו השבר של 8/8/2026
-- (לפני התאריך הזה הייחוס לא פג ולכן הערוצים מנופחים ולא אחיד), ו-30 יום
-- אחורה מכסים כבר רק תקופה נקייה.
create or replace function public.admin_engagement_windows(ids uuid[])
returns json
language sql
stable
as $$
  select coalesce(json_agg(row_to_json(e)), '[]'::json)
  from (
    select t.id as therapist_id,
           coalesce(v.c30, 0) as views_30d,
           coalesce(v.c60, 0) as views_60d,
           coalesce(v.ctotal, 0) as views_total,
           coalesce(c.c30, 0) as contacts_30d,
           coalesce(c.c60, 0) as contacts_60d,
           coalesce(c.ctotal, 0) as contacts_total,
           -- פילוח ערוץ, 30 יום. meta_paid מצטרף ל-paid: מבחינת האבחון שתיהן
           -- "חשיפה שנקנתה ותיעלם עם התקציב".
           coalesce(v.paid, 0)    as views_30d_paid,
           coalesce(v.organic, 0) as views_30d_organic,
           coalesce(v.direct, 0)  as views_30d_direct,
           coalesce(v.other, 0)   as views_30d_other,
           coalesce(c.paid, 0)    as contacts_30d_paid,
           coalesce(c.organic, 0) as contacts_30d_organic,
           coalesce(c.direct, 0)  as contacts_30d_direct,
           coalesce(c.other, 0)   as contacts_30d_other
    from unnest(ids) as t(id)
    left join (
      select therapist_id,
             count(*) filter (where viewed_at >= now() - interval '30 days') as c30,
             count(*) filter (where viewed_at >= now() - interval '60 days') as c60,
             count(*) as ctotal,
             count(*) filter (where viewed_at >= now() - interval '30 days'
                                and channel in ('google_paid','meta_paid')) as paid,
             count(*) filter (where viewed_at >= now() - interval '30 days'
                                and channel = 'google_organic') as organic,
             count(*) filter (where viewed_at >= now() - interval '30 days'
                                and channel = 'direct') as direct,
             count(*) filter (where viewed_at >= now() - interval '30 days'
                                and coalesce(channel, '') not in
                                    ('google_paid','meta_paid','google_organic','direct')) as other
      from public.therapist_profile_views
      where therapist_id = any(ids)
        and source in ('match', 'directory')
      group by therapist_id
    ) v on v.therapist_id = t.id
    left join (
      select therapist_id,
             count(*) filter (where clicked_at >= now() - interval '30 days') as c30,
             count(*) filter (where clicked_at >= now() - interval '60 days') as c60,
             count(*) as ctotal,
             count(*) filter (where clicked_at >= now() - interval '30 days'
                                and channel in ('google_paid','meta_paid')) as paid,
             count(*) filter (where clicked_at >= now() - interval '30 days'
                                and channel = 'google_organic') as organic,
             count(*) filter (where clicked_at >= now() - interval '30 days'
                                and channel = 'direct') as direct,
             count(*) filter (where clicked_at >= now() - interval '30 days'
                                and coalesce(channel, '') not in
                                    ('google_paid','meta_paid','google_organic','direct')) as other
      from public.therapist_contact_clicks
      where therapist_id = any(ids)
      group by therapist_id
    ) c on c.therapist_id = t.id
  ) e;
$$;

revoke all on function public.admin_engagement_windows(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_engagement_windows(uuid[]) to service_role;
