-- תשתית הסוכנים האוטונומיים (גל 1): שתי טבלאות משותפות לכל הסוכנים.
--
-- agent_actions - תור ההצעות המאוחד: כל סוכן כותב לכאן מה שהוא מציע לעשות,
-- והאדמין מאשר/דוחה. זו הרחבה של דפוס marketing_recommendations הקיים,
-- ומיועדת לקלוט בהמשך גם את שני התורים הקיימים (המלצות שיווק, הצעות משימות)
-- כדי שיהיה תור אחד ולא רביעי.
--
-- agent_runs - יומן ריצות: כל ריצת סוכן נרשמת (מתי, מה מצאה, שגיאות),
-- כדי שיהיה מקום אחד לראות שהסוכנים חיים ומה הם עשו.

create table if not exists public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  agent text not null,                 -- 'daily_digest' / 'watchdog' / 'leads' / ...
  action_type text not null,           -- 'alert' / 'email_draft' / 'recommendation' / ...
  title text not null,
  body text,                           -- תוכן מלא (טיוטה, נימוק) להצגה לאדמין
  entity_type text,                    -- 'therapist' / 'lead' / 'center' / ...
  entity_id uuid,
  entity_label text,                   -- שם מפוענח, כמו ב-crm_tasks - להצגה בלי join
  payload jsonb,                       -- נתונים מובנים לביצוע עתידי
  status text not null default 'pending'
    check (status in ('pending','approved','dismissed','executed','failed')),
  status_changed_at timestamptz,
  resolved_by text,                    -- מי הכריע (טקסט חופשי, כמו בשאר ה-CRM)
  resolution_note text,
  dedupe_key text,                     -- מפתח יציב: אותה הצעה לא נפתחת פעמיים
  created_at timestamptz not null default now()
);

create index if not exists agent_actions_status_idx
  on public.agent_actions (status, created_at desc);
create index if not exists agent_actions_agent_idx
  on public.agent_actions (agent, created_at desc);
-- הצעה פתוחה אחת לכל מפתח: סוכן שמריץ שוב לא יוצר כפילות של אותה הצעה
-- כל עוד הקודמת ממתינה.
create unique index if not exists agent_actions_dedupe_pending
  on public.agent_actions (dedupe_key)
  where dedupe_key is not null and status = 'pending';

alter table public.agent_actions enable row level security;
revoke all on public.agent_actions from anon, authenticated;
grant select, insert, update, delete on public.agent_actions to service_role;

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running','ok','empty','error')),
  mode text,                           -- 'preview' / 'send' - לקרונים עם דפוס confirm
  summary text,                        -- שורה אנושית: מה הריצה מצאה
  details jsonb,                       -- מספרי הסקציות וכו', לתחקור
  error text
);

create index if not exists agent_runs_agent_idx
  on public.agent_runs (agent, started_at desc);

alter table public.agent_runs enable row level security;
revoke all on public.agent_runs from anon, authenticated;
grant select, insert, update, delete on public.agent_runs to service_role;
