-- Spend and seekers per Google campaign over any trailing window, for the
-- monthly budget report's 90-day column (docs/agents/budget-agent-plan.md,
-- section ו.1). Same definitions as budget_campaign_stats: whole days before
-- p_asof, a seeker = a distinct session that clicked to contact a therapist
-- from a Google ad.
create or replace function public.budget_campaign_window(p_days integer, p_asof date default current_date)
returns table(utm_campaign text, cost numeric, seekers bigint)
language sql
stable
security definer
set search_path = public
as $$
  with reg as (
    select google_name, utm_campaign from ads_campaign_registry where utm_campaign is not null
  ),
  cost as (
    select r.utm_campaign as camp, sum(d.cost) as c
    from ads_campaign_daily d
    join reg r on r.google_name = d.campaign_name
    where d.date >= p_asof - p_days and d.date < p_asof
    group by 1
  ),
  con as (
    select c.utm_campaign as camp, count(distinct c.session_id) as s
    from therapist_contact_clicks c
    where c.channel = 'google_paid'
      and c.clicked_at >= p_asof - p_days and c.clicked_at < p_asof
      and c.utm_campaign is not null
    group by 1
  )
  select cost.camp, round(coalesce(cost.c, 0), 2), coalesce(con.s, 0)
  from cost
  left join con on con.camp = cost.camp;
$$;

revoke all on function public.budget_campaign_window(integer, date) from public, anon, authenticated;
grant execute on function public.budget_campaign_window(integer, date) to service_role;
