-- מכונים ומרכזים טיפוליים שמועמדים להפוך ללקוחות, ומעקב הפנייה אליהם.
-- שני מקורות: 'internal_lead' (מרכז שקיבל הצעה ולא סגר - הליד הכי חם),
-- ו-'places' (מכון שנמצא בחיפוש Google Places באזור עם פערי גיוס).
create table if not exists public.center_prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source text not null default 'places' check (source in ('places', 'internal_lead', 'manual')),
  place_id text unique,
  center_account_id uuid references public.therapy_center_accounts(id) on delete set null,
  city text, region_key text, address text, phone text, website text, email text,
  gaps_in_region integer not null default 0,
  contacted_at timestamptz, answered_at timestamptz,
  answer text check (answer in ('yes', 'no', 'maybe')),
  notes text, obstacles text,
  draft_subject text, draft_body text, draft_requested_at timestamptz, draft_sent_at timestamptz,
  dismissed_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists center_prospects_open_idx on public.center_prospects (dismissed_at, gaps_in_region desc);
create index if not exists center_prospects_region_idx on public.center_prospects (region_key);
alter table public.center_prospects enable row level security;
grant select, insert, update, delete on public.center_prospects to service_role;
