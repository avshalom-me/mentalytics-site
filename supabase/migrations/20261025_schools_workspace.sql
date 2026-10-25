-- The shared workspace of the schools branch CRM (/admin/schools, /partner/schools):
-- the annual plan drawn as a Gantt, a board of notes with reminders, and the
-- branch's files - so the work the owner and the partner share lives in the CRM
-- and not in a Drive folder nobody else can see.
--
-- school_plan_items: the bars and the diamonds of the annual plan. A phase runs
--   from start_date to end_date; a milestone is a single day. A milestone may
--   carry a gate: it is reached when the money received crosses a threshold
--   (gate_metric, gate_threshold), and the plan shows how far it is.
--   The plan's own content is business planning, so it lives here and never in
--   the repo, which is public.
-- school_board_notes: notes, decisions, ready texts, links and items for the
--   next meeting. A note may be scheduled: from remind_at it pops up for each
--   name in remind_to until that person closes it or puts it off
--   (reminder_state: name -> {"dismissed_at": ...} or {"snooze_until": ...}).
-- school_files: drafts and documents of the branch. The bytes are in the
--   private Storage bucket school-branch-files and reach a browser only through
--   a short-lived signed URL issued by the API.
--
-- crm_tasks gains start_date: a branch task with a start and a due date is drawn
--   on the Gantt as a bar. Nothing else reads it, and every existing row keeps
--   its meaning (null = no start).
--
-- Server-only, like every table since 20/10/2026: RLS on with no policies for
-- anon or authenticated, and an explicit grant to service_role.

alter table public.crm_tasks add column if not exists start_date date;

create table if not exists public.school_plan_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'phase' check (kind in ('phase', 'milestone')),
  title text not null,
  track text not null default 'general' check (track in ('product', 'marketing', 'pricing', 'sales', 'team', 'general')),
  start_date date not null,
  end_date date,
  status text not null default 'planned' check (status in ('planned', 'active', 'done', 'dropped')),
  owner text,
  description text,
  gate_metric text check (gate_metric in ('received_gross', 'received_net')),
  gate_threshold numeric(12, 2) check (gate_threshold is null or gate_threshold > 0),
  sort integer not null default 0,
  created_by text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (end_date is null or end_date >= start_date)
);
create index if not exists school_plan_items_dates_idx on public.school_plan_items (start_date, end_date) where archived_at is null;

create table if not exists public.school_board_notes (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'note' check (kind in ('note', 'decision', 'template', 'link', 'agenda')),
  title text,
  body text,
  url text,
  pinned boolean not null default false,
  remind_at timestamptz,
  remind_to text[] not null default '{}',
  reminder_state jsonb not null default '{}'::jsonb,
  created_by text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists school_board_notes_remind_idx on public.school_board_notes (remind_at) where archived_at is null and remind_at is not null;

create table if not exists public.school_files (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  storage_path text not null unique,
  size_bytes bigint,
  mime text,
  folder text not null default 'כללי',
  description text,
  plan_item_id uuid references public.school_plan_items (id) on delete set null,
  uploaded_by text not null default 'admin',
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists school_files_created_idx on public.school_files (created_at desc) where archived_at is null;

alter table public.school_plan_items enable row level security;
alter table public.school_board_notes enable row level security;
alter table public.school_files enable row level security;
revoke all on table public.school_plan_items from public, anon, authenticated;
revoke all on table public.school_board_notes from public, anon, authenticated;
revoke all on table public.school_files from public, anon, authenticated;
grant select, insert, update, delete on table public.school_plan_items to service_role;
grant select, insert, update, delete on table public.school_board_notes to service_role;
grant select, insert, update, delete on table public.school_files to service_role;

-- The private bucket for the branch's files: 50MB a file, no public URL.
insert into storage.buckets (id, name, public, file_size_limit)
values ('school-branch-files', 'school-branch-files', false, 52428800)
on conflict (id) do nothing;
