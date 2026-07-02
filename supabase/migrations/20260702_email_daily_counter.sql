-- Safety net against blowing the Resend daily quota (free tier = 100/day).
-- A shared per-day counter that BULK email sends (completion reminders, monthly
-- reports) claim a slot from before sending. Transactional/critical mail
-- (registration, leads, payment) is NOT gated, so a bulk burst can never starve
-- it. bump_email_counter atomically increments only while under the passed
-- limit, returning the new count — or NULL when the cap is already reached.

BEGIN;

CREATE TABLE IF NOT EXISTS email_send_counter (
  day  date PRIMARY KEY,
  sent integer NOT NULL DEFAULT 0
);

-- App access is service-role only (via supabaseAdmin) — see reference_supabase_grants.
GRANT SELECT, INSERT, UPDATE ON email_send_counter TO service_role;

CREATE OR REPLACE FUNCTION bump_email_counter(p_limit integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_sent integer;
BEGIN
  INSERT INTO email_send_counter (day, sent)
  VALUES (current_date, 1)
  ON CONFLICT (day) DO UPDATE
    SET sent = email_send_counter.sent + 1
    WHERE email_send_counter.sent < p_limit
  RETURNING sent INTO v_sent;
  -- v_sent is NULL when the ON CONFLICT update was blocked (at/over the limit).
  RETURN v_sent;
END;
$$;

GRANT EXECUTE ON FUNCTION bump_email_counter(integer) TO service_role;

COMMIT;
