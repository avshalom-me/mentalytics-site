-- Did the therapist actually open the invitation link?
--
-- Added 4/9/26. Twelve offers went out on 3/9 and produced no signups, and we
-- could not tell whether nobody clicked or everybody clicked and balked: the
-- page's own page_view is blockable, and Resend's open tracking turned out to
-- be switched off entirely (past mails known to have been read still showed
-- only "Delivered"). This records the click on our side, where nothing can
-- block it - the token GET runs on our server every time the page loads.
alter table gift_checkout_tokens
  add column if not exists first_viewed_at timestamptz,
  add column if not exists last_viewed_at timestamptz,
  add column if not exists view_count integer not null default 0;

comment on column gift_checkout_tokens.first_viewed_at is
  'When the invitation link was first opened. NULL = the mail was never clicked (or never arrived).';

-- Atomic stamp. A read-then-write from the route would race between two tabs
-- and lose a view; this does it in one statement.
create or replace function gift_token_mark_viewed(p_token text, p_now timestamptz)
returns void
language sql
security definer
set search_path = public
as $$
  update gift_checkout_tokens
  set first_viewed_at = coalesce(first_viewed_at, p_now),
      last_viewed_at = p_now,
      view_count = view_count + 1
  where token = p_token;
$$;

revoke execute on function gift_token_mark_viewed(text, timestamptz) from public, anon, authenticated;
grant execute on function gift_token_mark_viewed(text, timestamptz) to service_role;
