-- Organic entries grouped by landing-page FAMILY, which is the cut that was
-- missing: /admin/seo showed one organic total and the per-page detail lived
-- only in ad-hoc SQL.
--
-- The reason it exists: "region" was hiding its own answer. Eight geographic
-- region pages earn 15 organic entries between them all time, while
-- region:online earns 42 - so the family read as healthy when the geographic
-- half of it does essentially nothing. `online` is therefore split out as its
-- own family rather than left inside `region`.
--
-- `top_page` and `top_page_organic` are here because concentration is the real
-- story in every family: 91% of the arrangements total is one page (משרד
-- הביטחון), 74% of what used to be "region" is the online page. A family total
-- without its leader invites planning around an average that does not exist.
--
-- Counts are google_organic page_view events. p_since null = all time.
create or replace function public.admin_organic_by_page_family(
  p_since timestamptz default null
)
returns json
language sql
stable
as $$
  with ev as (
    select e.metadata->>'page' as page,
           case
             when e.metadata->>'page' = 'region:online' then 'online'
             else split_part(e.metadata->>'page', ':', 1)
           end as family,
           e.created_at
    from public.analytics_events e
    where e.event_type = 'page_view'
      and e.channel = 'google_organic'
      and e.metadata->>'page' is not null
      and (p_since is null or e.created_at >= p_since)
  ),
  per_page as (
    select family, page, count(*) as organic from ev group by 1, 2
  ),
  leader as (
    select distinct on (family) family, page as top_page, organic as top_page_organic
    from per_page order by family, organic desc, page
  ),
  fam as (
    select family,
           count(*)                                                        as organic,
           count(*) filter (where created_at >= now() - interval '30 days') as organic_30d,
           count(*) filter (where created_at >= now() - interval '7 days')  as organic_7d,
           count(distinct page)                                            as pages
    from ev group by 1
  ),
  r as (
    select f.family,
           case f.family
             when 'city'         then 'ערים'
             when 'city_topic'   then 'עיר × נושא'
             when 'region'       then 'אזורים גיאוגרפיים'
             when 'online'       then 'אונליין'
             when 'online_topic' then 'אונליין × נושא'
             when 'specialty'    then 'סוגי טיפול'
             when 'topic'        then 'נושאים'
             when 'arrangement'  then 'הסדרים ומימון'
             when 'assessment'   then 'אבחונים'
             when 'para-medical' then 'פארא-רפואי'
             when 'research'     then 'מאמרים'
             when 'directory'    then 'מאגר המטפלים'
             when 'home'         then 'דף הבית'
             when 'hub'          then 'עמודי רכזת'
             else f.family
           end                                                             as label,
           -- the code-generated landing families, i.e. what the SEO work targets
           (f.family in ('city','city_topic','region','online','online_topic',
                         'specialty','topic','arrangement','assessment','para-medical')) as is_landing,
           f.organic, f.organic_30d, f.organic_7d, f.pages,
           replace(l.top_page, f.family || ':', '') as top_page,
           l.top_page_organic
    from fam f left join leader l on l.family = f.family
    order by f.organic desc
  )
  select coalesce((select json_agg(row_to_json(r)) from r), '[]'::json);
$$;

revoke all on function public.admin_organic_by_page_family(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_organic_by_page_family(timestamptz) to service_role;
