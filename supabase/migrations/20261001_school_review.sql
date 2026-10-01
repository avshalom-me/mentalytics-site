-- The review mode of the counsellor questionnaire (/school): who reviews, and
-- what they wrote.
--
-- A professional reviewer - an educational psychologist on the team - goes over
-- the whole questionnaire and leaves notes on what is wrong, badly worded or
-- missing. They get a personal link, open it on /school, and a layer on top of
-- the questionnaire loads invented cases for them and takes a note on any part
-- of any screen. The notes are read in /admin/school-review, checked, and only
-- then turned into code.
--
-- school_reviewers: one row per person. `token` is the capability in their
-- link. It is stored as given, not hashed, on purpose: the owner copies the
-- link again from the admin page whenever the reviewer loses it, and all the
-- token allows is writing review notes and scoring the questionnaire past the
-- daily per-IP cap. Switching `active` off revokes it.
--
-- school_review_notes: one row per note. A note carries the screen, the block
-- on it, the text the reviewer was pointing at, and the full set of answers the
-- questionnaire held at that moment - which is what lets the state be opened
-- again exactly as it was, and what turns "the wording here is off" into a line
-- of code that can be found.
--
-- The answers are those of an invented case. The review layer says so on
-- screen and loads only invented children; the /school consent screen's
-- promise that nothing is sent to the server is about counsellors filling in a
-- real student, and nothing here changes it for them. That is also why a
-- suicidality answer may sit in `answers` here although it is never recorded
-- against a visitor (app/lib/sensitive-findings.ts): there is no visitor, and
-- reproducing the safety notice is one of the things a reviewer is asked to
-- look at.
--
-- Server-only: RLS on with no policies, and an explicit grant to service_role
-- (new tables get none by default).

create table if not exists public.school_reviewers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  token text not null unique,
  active boolean not null default true,
  -- What the reviewer has had on screen: coverage key -> first seen (ISO).
  seen jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists public.school_review_notes (
  id uuid primary key default gen_random_uuid(),
  -- restrict, not cascade: a reviewer who has written notes is switched off,
  -- never deleted, so nothing they wrote can vanish with them.
  reviewer_id uuid not null references public.school_reviewers (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Where the note sits.
  step text not null,           -- a questionnaire screen id, or 'atlas'
  variant text,                 -- which version of the screen (age band, role)
  block_id text,                -- a stable anchor when the block has one, e.g. track:zakaut
  block_label text,             -- the same, in words
  quote text,                   -- the text the reviewer pointed at, as shown

  -- What it says.
  kind text not null check (kind in ('error', 'wording', 'missing', 'clinical', 'other')),
  severity text not null check (severity in ('high', 'medium', 'low')),
  note text not null,
  suggestion text,

  -- The state it was written on.
  case_id text,                 -- the bank case that was open, if any
  case_modified boolean not null default false,
  answers jsonb,                -- the questionnaire's answers at that moment (an invented case)
  context jsonb not null default '{}'::jsonb,

  -- What became of it.
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected', 'done')),
  response text,
  handled_at timestamptz,
  withdrawn_at timestamptz
);

create index if not exists school_review_notes_reviewer_idx on public.school_review_notes (reviewer_id, created_at desc);
create index if not exists school_review_notes_status_idx on public.school_review_notes (status, created_at desc);

alter table public.school_reviewers enable row level security;
alter table public.school_review_notes enable row level security;
revoke all on table public.school_reviewers from public, anon, authenticated;
revoke all on table public.school_review_notes from public, anon, authenticated;
grant select, insert, update, delete on table public.school_reviewers to service_role;
grant select, insert, update, delete on table public.school_review_notes to service_role;
