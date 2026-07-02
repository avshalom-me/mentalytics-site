-- Paywall hardening (2026-07-02):
--   1) Atomic multi-identifier increment for quiz usage — replaces the JS
--      read-modify-write in consumeUsage(), which let concurrent /score
--      requests collapse two increments into one (shaving free runs).
--   2) A per-IP daily attempt counter used as a coarse backstop against the
--      fingerprint-rotation bypass (a client minting a fresh random _fp per
--      request otherwise gets unlimited free scored quizzes). Enforcement is
--      gated behind the QUIZ_FREE_IP_DAILY_CAP env var and skipped for
--      "unknown" IPs, so it never blocks legitimate CGNAT users unless the
--      operator opts in with a chosen cap.

BEGIN;

CREATE OR REPLACE FUNCTION public.increment_quiz_usage(p_ids text[], p_type text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.quiz_usage (ip, quiz_type, count, updated_at)
  SELECT unnest(p_ids), p_type, 1, now()
  ON CONFLICT (ip, quiz_type)
  DO UPDATE SET count = public.quiz_usage.count + 1, updated_at = now();
$$;

REVOKE ALL ON FUNCTION public.increment_quiz_usage(text[], text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_quiz_usage(text[], text) TO service_role;

CREATE TABLE IF NOT EXISTS public.quiz_ip_daily (
  ip         text NOT NULL,
  day        date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  count      int  NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ip, day)
);

ALTER TABLE public.quiz_ip_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.quiz_ip_daily
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.quiz_ip_daily FROM anon, authenticated;
GRANT ALL ON public.quiz_ip_daily TO service_role;

CREATE OR REPLACE FUNCTION public.bump_quiz_ip_daily(p_ip text)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.quiz_ip_daily (ip, day, count, updated_at)
  VALUES (p_ip, (now() AT TIME ZONE 'utc')::date, 1, now())
  ON CONFLICT (ip, day)
  DO UPDATE SET count = public.quiz_ip_daily.count + 1, updated_at = now()
  RETURNING count;
$$;

REVOKE ALL ON FUNCTION public.bump_quiz_ip_daily(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_quiz_ip_daily(text) TO service_role;

COMMIT;
