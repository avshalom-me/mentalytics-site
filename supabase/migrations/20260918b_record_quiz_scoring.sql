-- One call per scoring, touching both counters every time
-- ========================================================
-- Replaces bump_research_count (20260918_research_weekly_counts.sql), which the
-- score routes called once for "scored" and a second time only when the result
-- contained a suicidality finding. That design kept the finding out of every row
-- and still let it be recovered two ways:
--
--   1. Row versions. Every UPDATE stamps the row with the transaction id that
--      wrote it (xmin), and transaction ids are ordered. The suicidality row was
--      written only by suicidal scorings, so its xmin pointed at the most recent
--      one, and the quiz_treatments row written seconds later - session id, age
--      band, gender, domains - sat right next to it in the same sequence. Anyone
--      with SQL access could link the latest finding of each week to a visitor,
--      after the fact. The row's mere existence in a given week said the same.
--   2. Request count. A suicidal scoring made two RPC calls and any other made
--      one, and the API gateway logs every call with its time.
--
-- record_quiz_scoring always upserts BOTH rows in one statement: the suicidality
-- row is incremented by 1 or by 0, and an UPDATE by 0 still writes a new row
-- version. Both rows therefore always carry the xmin of the latest scoring,
-- whatever it found, both exist from the first scoring of the week, and every
-- scoring is exactly one call. (track_commit_timestamp is off and log_statement
-- is 'ddl', so neither the commit time nor the call arguments are recorded
-- anywhere else - checked 18/9/2026.)

create or replace function public.record_quiz_scoring(p_quiz_type text, p_suicidality boolean)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.research_weekly_counts (week_start, quiz_type, metric, n)
  values
    (date_trunc('week', now() at time zone 'Asia/Jerusalem')::date, p_quiz_type, 'scored', 1),
    (date_trunc('week', now() at time zone 'Asia/Jerusalem')::date, p_quiz_type, 'suicidality',
       case when p_suicidality then 1 else 0 end)
  on conflict (week_start, quiz_type, metric)
  do update set n = public.research_weekly_counts.n + excluded.n;
$$;

revoke all on function public.record_quiz_scoring(text, boolean) from public, anon, authenticated;
grant execute on function public.record_quiz_scoring(text, boolean) to service_role;

-- bump_research_count is dropped in a follow-up migration, once the deployment
-- that stops calling it is live (dropping it first would lose counts written by
-- the previous build during the deploy window).
