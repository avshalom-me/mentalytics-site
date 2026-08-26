-- "Where did the contacts go" - per therapist, who received contact clicks,
-- which plan they are on, and whether the click came from the matching quiz or
-- from the therapist's own profile page.
--
-- Why the source split is the point of this function: a 28-day check on
-- 26/8/2026 showed 85% of ORGANIC contact clicks landing on free therapists,
-- which reads as the regional fallback flooding the results. It was not. Split
-- by source, free therapists took 20 of 21 clicks on their OWN profile pages
-- (traffic they brought themselves via name searches) and exactly 1 of 8
-- through the matcher. Aggregating without `source` produces a number that is
-- arithmetically true and directionally misleading.
--
-- THREE sources, not two: `directory` is a contact click straight off a card in
-- the listing without opening the profile, and it is the largest of the three
-- (118 of 326 all time). Folding it into `from_other` made the UI columns fail
-- to add up, so it gets its own count.
--
-- Each row carries `clicks_all_channels` - the therapist's total across EVERY
-- channel in the same window - so a scoped table can never be mistaken for an
-- absolute one. That confusion was real: a therapist showed 9 in the paid view
-- and 12 on her profile, and the gap looked like a bug. 77 of 108 therapists
-- with clicks differ that way, and 81 of 328 clicks sit in channels neither the
-- organic nor the paid view shows. It is PER THERAPIST: in the paid view a
-- therapist with three campaigns produces three rows carrying the same value,
-- so display it as context and never sum it down the column.
--
-- p_since null = all time. p_channel null = every channel. p_campaign null =
-- every campaign, and is only meaningful for paid channels.
-- Aggregated in SQL so it stays exact past the 1000-row PostgREST cap.

create or replace function public.admin_contact_destinations(
  p_since    timestamptz default null,
  p_channel  text        default null,
  p_campaign text        default null
)
returns json
language sql
stable
as $$
  with clicks as (
    select c.therapist_id,
           c.source,
           c.click_type,
           c.utm_campaign,
           c.clicked_at
    from public.therapist_contact_clicks c
    where (p_since    is null or c.clicked_at   >= p_since)
      and (p_channel  is null or c.channel       = p_channel)
      and (p_campaign is null or c.utm_campaign  = p_campaign)
  ),
  r as (
    select t.id                                   as therapist_id,
           t.full_name,
           -- the commercial tier, in the same language the admin already uses
           case
             when t.status = 'paying' and t.promotion_source = 'paid'   then 'paid'
             when t.status = 'paying' and t.promotion_source = 'center' then 'center'
             when t.status = 'paying'                                    then 'trial'
             else 'free'
           end                                    as plan,
           cl.utm_campaign                        as campaign,
           count(*)                               as clicks,
           coalesce(max(ac.clicks_all_channels), 0) as clicks_all_channels,
           -- the split that stops the aggregate from misleading
           count(*) filter (where cl.source = 'match')     as from_match,
           count(*) filter (where cl.source = 'directory') as from_directory,
           count(*) filter (where cl.source = 'profile')   as from_profile,
           count(*) filter (where cl.source is null
                              or cl.source not in ('match','directory','profile')) as from_other,
           count(*) filter (where cl.click_type = 'whatsapp')     as whatsapp,
           count(*) filter (where cl.click_type = 'phone')        as phone,
           count(*) filter (where cl.click_type = 'email')        as email,
           count(*) filter (where cl.click_type = 'site_message') as site_message,
           max(cl.clicked_at)                     as last_click
    from clicks cl
    join public.therapists t on t.id = cl.therapist_id
    left join all_ch ac on ac.therapist_id = cl.therapist_id
    group by t.id, t.full_name, plan, cl.utm_campaign
    order by count(*) desc, t.full_name
  )
  select coalesce((select json_agg(row_to_json(r)) from r), '[]'::json);
$$;

revoke all on function public.admin_contact_destinations(timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.admin_contact_destinations(timestamptz, text, text) to service_role;
