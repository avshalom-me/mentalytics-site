-- Per-therapist 30-day engagement counts for the /admin/therapists load.
-- The admin list used to pull EVERY profile_view + contact_click row and count
-- them in memory (paging past the 1000-row cap) — which grows linearly with
-- traffic and got slow during the recruitment campaign. This aggregates in SQL
-- (COUNT ... GROUP BY) so it's one grouped query per table, exact, and never
-- hits the row cap. views = match/directory profile entries; contacts = clicks.

create or replace function public.admin_engagement_counts(ids uuid[], since timestamptz)
returns json
language sql
stable
as $$
  select coalesce(json_agg(row_to_json(e)), '[]'::json)
  from (
    select t.id as therapist_id,
           coalesce(v.cnt, 0) as views_30d,
           coalesce(c.cnt, 0) as contacts_30d
    from unnest(ids) as t(id)
    left join (
      select therapist_id, count(*) as cnt
      from public.therapist_profile_views
      where therapist_id = any(ids)
        and source in ('match', 'directory')
        and viewed_at >= since
      group by therapist_id
    ) v on v.therapist_id = t.id
    left join (
      select therapist_id, count(*) as cnt
      from public.therapist_contact_clicks
      where therapist_id = any(ids)
        and clicked_at >= since
      group by therapist_id
    ) c on c.therapist_id = t.id
  ) e;
$$;

revoke all on function public.admin_engagement_counts(uuid[], timestamptz) from public, anon, authenticated;
grant execute on function public.admin_engagement_counts(uuid[], timestamptz) to service_role;
