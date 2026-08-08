-- מדדי מעורבות לאדמין-מטפלים בשלושה חלונות בבת אחת: 30 יום, 60 יום, וסה"כ
-- מאז ההרשמה. מחליף את admin_engagement_counts (חלון יחיד) - סריקה אחת לכל
-- טבלה עם count(*) filter, אותה סמנטיקה: views = כניסות לעמוד פרופיל
-- (match/directory, בלי חשיפות כרטיס), contacts = כל לחיצות יצירת הקשר.
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
           coalesce(c.ctotal, 0) as contacts_total
    from unnest(ids) as t(id)
    left join (
      select therapist_id,
             count(*) filter (where viewed_at >= now() - interval '30 days') as c30,
             count(*) filter (where viewed_at >= now() - interval '60 days') as c60,
             count(*) as ctotal
      from public.therapist_profile_views
      where therapist_id = any(ids)
        and source in ('match', 'directory')
      group by therapist_id
    ) v on v.therapist_id = t.id
    left join (
      select therapist_id,
             count(*) filter (where clicked_at >= now() - interval '30 days') as c30,
             count(*) filter (where clicked_at >= now() - interval '60 days') as c60,
             count(*) as ctotal
      from public.therapist_contact_clicks
      where therapist_id = any(ids)
      group by therapist_id
    ) c on c.therapist_id = t.id
  ) e;
$$;

revoke all on function public.admin_engagement_windows(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_engagement_windows(uuid[]) to service_role;
