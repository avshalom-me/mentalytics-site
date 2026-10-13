-- Daily counters for public endpoints that spend money on every call: the two
-- LLM explanation buttons (13/10/2026). The per-address limiter in those routes
-- lives in the memory of one serverless instance, so a caller spread over
-- addresses or cold starts never meets it; this is the one number that holds
-- across instances. Same shape as quiz_ip_daily (20260702).
-- Read through app/lib/daily-cap.ts only.

CREATE TABLE IF NOT EXISTS public.daily_counters (
  key        text NOT NULL,
  day        date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  count      int  NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, day)
);

ALTER TABLE public.daily_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.daily_counters;
CREATE POLICY "Service role full access" ON public.daily_counters
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.daily_counters FROM anon, authenticated;
GRANT ALL ON public.daily_counters TO service_role;

CREATE OR REPLACE FUNCTION public.bump_daily_counter(p_key text)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.daily_counters (key, day, count, updated_at)
  VALUES (p_key, (now() AT TIME ZONE 'utc')::date, 1, now())
  ON CONFLICT (key, day)
  DO UPDATE SET count = public.daily_counters.count + 1, updated_at = now()
  RETURNING count;
$$;

REVOKE ALL ON FUNCTION public.bump_daily_counter(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_daily_counter(text) TO service_role;
