-- הרחבת admin_seo_overview: משפך מלא במקום "לחיצת קשר" בלבד.
--
-- למה: מדידת המרה רק לפי לחיצת יצירת-קשר מציגה את תנועת הביקוש כחלשה בהרבה
-- ממה שהיא. מי שנוחת מחיפוש "פסיכולוג בחיפה" לרוב *ממלא את השאלון* - זו
-- ההמרה האמיתית של המשפך הזה - ורק אחר כך, לעיתים בביקור נפרד, יוצר קשר.
-- לעומתו מי שחיפש שם של מטפל מדלג על השאלון ולוחץ ישירות. שתי הקבוצות
-- ממירות בערוצים שונים, ולכן צריך למדוד את שתיהן.
--
-- כל קבוצה/סוג/עמוד מחזירים עכשיו: sessions, viewed (צפו בפרופיל),
-- quiz (השלימו שאלון), contacts (לחצו ליצירת קשר), certain (מתוכם - הודעה
-- שנשלחה בפועל דרך האתר = פנייה ודאית; היתר טלפון/וואטסאפ = כוונה בלבד).
--
-- contacts_since: session_id נוסף ללחיצות יצירת-קשר רק ב-13/7/26. לחיצות
-- קודמות אינן ניתנות לשיוך לסשן, ולכן שיעורי ההמרה בחלונות שכוללים את
-- התקופה ההיא נמוכים מהאמת. ה-UI מציג את התאריך כאזהרה.

create or replace function public.admin_seo_overview(p_days int default 90)
returns jsonb
language sql
stable
as $$
with touches as (
  select session_id, created_at as ts,
         case
           when event_type like 'recruit%' then 'recruit'
           when event_type in ('quiz_step','quiz_complete','matching_click','therapist_explain_click','match_saved') then 'quiz'
           when event_type in ('profile_impression','filter_used') then 'directory'
           when event_type='page_view' then
             case
               when metadata->>'page' = 'region:online'        then 'online'
               when metadata->>'page' like 'online_topic:%'    then 'online_topic'
               when metadata->>'page' like 'city_topic:%'      then 'city_topic'
               when metadata->>'page' like 'city:%'            then 'city'
               when metadata->>'page' like 'region:%'          then 'region'
               when metadata->>'page' like 'specialty:%'       then 'specialty'
               when metadata->>'page' like 'topic:%'           then 'topic'
               when metadata->>'page' like 'assessment:%'      then 'assessment'
               when metadata->>'page' like 'arrangement:%'     then 'arrangement'
               when metadata->>'page' like 'research:%'        then 'research'
               when metadata->>'page' = 'directory'            then 'directory'
               when metadata->>'page' = 'para-medical'         then 'para_medical'
               else 'other'
             end
           else 'other'
         end as kind,
         metadata->>'page' as page,
         null::uuid as therapist_id
  from analytics_events
  where channel = 'google_organic' and session_id is not null
  union all
  select session_id, viewed_at, 'profile', null, therapist_id
  from therapist_profile_views
  where channel = 'google_organic' and session_id is not null
),
first_touch as (
  select distinct on (session_id) session_id, ts, kind, page, therapist_id
  from touches
  order by session_id, ts
),
grouped as (
  select ft.*,
         case when ft.kind = 'profile' then 'name'
              when ft.kind = 'recruit' then 'recruit'
              when ft.kind = 'other'   then 'other'
              else 'demand' end as grp,
         exists (select 1 from therapist_profile_views v where v.session_id = ft.session_id) as viewed,
         exists (select 1 from analytics_events e where e.session_id = ft.session_id and e.event_type = 'quiz_complete') as quiz,
         exists (select 1 from therapist_contact_clicks c where c.session_id = ft.session_id) as contacted,
         exists (select 1 from therapist_contact_clicks c where c.session_id = ft.session_id and c.click_type = 'site_message') as certain
  from first_touch ft
),
win as (
  select * from grouped where ts >= now() - make_interval(days => p_days)
)
select jsonb_build_object(
  'since', (select min(ts)::date from grouped),
  'window_days', p_days,
  'contacts_since', (
    select coalesce(max(clicked_at::date) + 1, current_date)
    from therapist_contact_clicks where session_id is null
  ),
  'weekly', (
    select coalesce(jsonb_agg(w.row order by (w.row->>'week')), '[]'::jsonb) from (
      select jsonb_build_object(
        'week', date_trunc('week', ts)::date,
        'demand',  count(*) filter (where grp = 'demand'),
        'name',    count(*) filter (where grp = 'name'),
        'recruit', count(*) filter (where grp = 'recruit'),
        'other',   count(*) filter (where grp = 'other')
      ) as row
      from grouped group by date_trunc('week', ts)
    ) w
  ),
  'totals', (
    select jsonb_build_object(
      'sessions', count(*),
      'demand',   count(*) filter (where grp = 'demand'),
      'name',     count(*) filter (where grp = 'name'),
      'recruit',  count(*) filter (where grp = 'recruit'),
      'other',    count(*) filter (where grp = 'other')
    ) from win
  ),
  'kinds', (
    select coalesce(jsonb_agg(k.row order by (k.row->>'sessions')::int desc), '[]'::jsonb) from (
      select jsonb_build_object(
        'kind', kind,
        'sessions', count(*),
        'viewed',   count(*) filter (where viewed),
        'quiz',     count(*) filter (where quiz),
        'contacts', count(*) filter (where contacted),
        'certain',  count(*) filter (where certain)
      ) as row
      from win group by kind
    ) k
  ),
  'demand_pages', (
    select coalesce(jsonb_agg(p.row order by (p.row->>'sessions')::int desc), '[]'::jsonb) from (
      select jsonb_build_object(
        'page', page,
        'sessions', count(*),
        'quiz', count(*) filter (where quiz),
        'contacts', count(*) filter (where contacted)
      ) as row
      from win
      where grp = 'demand' and page is not null
      group by page
      order by count(*) desc
      limit 15
    ) p
  ),
  'name_top', (
    select coalesce(jsonb_agg(n.row order by (n.row->>'sessions')::int desc), '[]'::jsonb) from (
      select jsonb_build_object('name', t.full_name, 'status', t.status, 'sessions', count(*)) as row
      from win
      join therapists t on t.id = win.therapist_id
      where win.grp = 'name'
      group by t.id, t.full_name, t.status
      order by count(*) desc
      limit 10
    ) n
  ),
  'name_breadth', (
    select jsonb_build_object('therapists', count(distinct therapist_id), 'sessions', count(*))
    from win where grp = 'name'
  ),
  'funnel', (
    select coalesce(jsonb_agg(c.row), '[]'::jsonb) from (
      select jsonb_build_object(
        'grp', grp,
        'sessions', count(*),
        'viewed',   count(*) filter (where viewed),
        'quiz',     count(*) filter (where quiz),
        'contacts', count(*) filter (where contacted),
        'certain',  count(*) filter (where certain)
      ) as row
      from win where grp in ('demand', 'name') group by grp
    ) c
  )
);
$$;

revoke all on function public.admin_seo_overview(int) from public, anon, authenticated;
grant execute on function public.admin_seo_overview(int) to service_role;
