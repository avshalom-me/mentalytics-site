-- Monthly budget agent, step 1 (docs/agents/budget-agent-plan.md): a campaign the
-- owner has decided must not be cut, and the numbers /admin/budget ranks by.
--
-- The monthly ceiling itself needs no schema: it is a plan_targets row with
-- metric 'ads_budget_month' (₪ of Google Ads cost before VAT, as Google reports
-- it), read like cpl_max - the latest month that has started is the one in force.

alter table public.ads_campaign_registry
  add column if not exists protected_reason text,
  add column if not exists protected_until date;

comment on column public.ads_campaign_registry.protected_reason is
  'Why the budget agent must keep this campaign at its current budget (e.g. the only source for a centre whose first charge is near). Null = not protected.';
comment on column public.ads_campaign_registry.protected_until is
  'Last day the protection holds. Null with a reason = until changed.';

-- Spend and seekers per campaign over the trailing 30 and 60 days, measured the
-- way the owner's 29/9/2026 analysis measured them: whole days before p_asof,
-- Google's cost from the nightly sync, and a seeker = a distinct session that
-- clicked to contact a therapist from a Google ad. Contacts reaching paying
-- therapists are split out, because those are the regions the money protects.
create or replace function public.budget_campaign_stats(p_asof date default current_date)
returns table(
  utm_campaign text,
  first_spend date,
  cost30 numeric,
  cost60 numeric,
  seekers30 bigint,
  seekers60 bigint,
  paid_seekers60 bigint,
  trial_seekers60 bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with reg as (
    select google_name, utm_campaign from ads_campaign_registry where utm_campaign is not null
  ),
  cost as (
    select r.utm_campaign as camp,
      sum(d.cost) filter (where d.date >= p_asof - 60) as c60,
      sum(d.cost) filter (where d.date >= p_asof - 30) as c30,
      min(d.date) filter (where d.cost > 0) as first_spend
    from ads_campaign_daily d
    join reg r on r.google_name = d.campaign_name
    where d.date < p_asof
    group by 1
  ),
  con as (
    select c.utm_campaign as camp,
      count(distinct c.session_id) filter (where c.clicked_at >= p_asof - 60) as cs60,
      count(distinct c.session_id) filter (where c.clicked_at >= p_asof - 30) as cs30,
      count(distinct c.session_id) filter (
        where c.clicked_at >= p_asof - 60 and t.status = 'paying' and t.promotion_source in ('paid', 'center')
      ) as paid60,
      count(distinct c.session_id) filter (
        where c.clicked_at >= p_asof - 60 and t.status = 'paying' and t.promotion_source in ('trial', 'gift_trial')
      ) as trial60
    from therapist_contact_clicks c
    join therapists t on t.id = c.therapist_id
    where c.channel = 'google_paid' and c.clicked_at < p_asof and c.utm_campaign is not null
    group by 1
  )
  select cost.camp,
    cost.first_spend,
    round(coalesce(cost.c30, 0), 2),
    round(coalesce(cost.c60, 0), 2),
    coalesce(con.cs30, 0),
    coalesce(con.cs60, 0),
    coalesce(con.paid60, 0),
    coalesce(con.trial60, 0)
  from cost
  left join con on con.camp = cost.camp;
$$;

revoke all on function public.budget_campaign_stats(date) from public, anon, authenticated;
grant execute on function public.budget_campaign_stats(date) to service_role;
