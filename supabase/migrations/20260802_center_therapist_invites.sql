-- הזמנות מטפלים ע"י מרכז (מסלול 1): המנהל מזין מיילים, כל מטפל מקבל קישור
-- אישי (token) וממלא את הפרופיל שלו בעצמו — הפרופיל נוצר משויך למרכז
-- (center_account_id, user_id ריק) ונכנס לתור האישורים הרגיל.
create table if not exists public.center_therapist_invites (
  id uuid primary key default gen_random_uuid(),
  center_account_id uuid not null references public.therapy_center_accounts(id) on delete cascade,
  email text not null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_at timestamptz not null default now(),
  used_at timestamptz,
  therapist_id uuid references public.therapists(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_center_invites_center on public.center_therapist_invites(center_account_id);

-- גישה דרך service_role בלבד (כמו therapy_center_accounts) — אין policies ל-anon.
alter table public.center_therapist_invites enable row level security;
grant select, insert, update, delete on public.center_therapist_invites to service_role;
