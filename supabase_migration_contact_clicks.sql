-- Run this in the Supabase SQL Editor
-- Creates the table that tracks therapist contact button clicks

create table if not exists therapist_contact_clicks (
  id          uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references therapists(id) on delete cascade,
  click_type  text not null check (click_type in ('whatsapp', 'phone', 'email')),
  source      text not null default 'directory' check (source in ('match', 'directory')),
  clicked_at  timestamptz not null default now()
);

-- Index for fast weekly aggregation queries
create index if not exists idx_contact_clicks_therapist_week
  on therapist_contact_clicks (therapist_id, clicked_at);

-- If the table already exists, add the source column:
alter table therapist_contact_clicks
  add column if not exists source text not null default 'directory'
  check (source in ('match', 'directory'));

-- Optional: RLS — only service role can read/write (API uses supabaseAdmin)
alter table therapist_contact_clicks enable row level security;
