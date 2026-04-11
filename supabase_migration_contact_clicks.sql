-- Run this in the Supabase SQL Editor
-- Creates the table that tracks therapist contact button clicks

create table if not exists therapist_contact_clicks (
  id          uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references therapists(id) on delete cascade,
  click_type  text not null check (click_type in ('whatsapp', 'phone', 'email')),
  clicked_at  timestamptz not null default now()
);

-- Index for fast weekly aggregation queries
create index if not exists idx_contact_clicks_therapist_week
  on therapist_contact_clicks (therapist_id, clicked_at);

-- Optional: RLS — only service role can read/write (API uses supabaseAdmin)
alter table therapist_contact_clicks enable row level security;
