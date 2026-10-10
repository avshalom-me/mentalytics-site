-- 10/10/2026: יומן קריאות למודלי שפה (app/lib/llm.ts).
-- עד היום לא הייתה שום נראות על ההוצאה: אף קריאה לא רשמה טוקנים או עלות.
-- שורה לכל ניסיון, כולל כשלים, וכולל סימון מתי התשובה הגיעה מהגיבוי.

create table public.llm_calls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- הפיצ'ר שקרא: inbox_draft, inbox_lessons, admin_report, explain_match...
  feature text not null,
  provider text not null check (provider in ('anthropic', 'openai')),
  model text not null,
  ok boolean not null default true,
  error text,
  -- המודל הראשי שנכשל כשהתשובה הגיעה מהגיבוי; 'budget' כשהגיבוי נבחר בגלל תקרת הקרדיט.
  fallback_from text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  -- null = מודל שלא במחירון (llm-pricing.ts).
  cost_usd numeric(10, 6),
  duration_ms integer not null default 0,
  stop_reason text
);

create index llm_calls_created_at_idx on public.llm_calls (created_at desc);
create index llm_calls_feature_idx on public.llm_calls (feature, created_at desc);

-- רק השרת כותב וקורא (supabaseAdmin). אין גישה מהדפדפן.
grant select, insert on public.llm_calls to service_role;
alter table public.llm_calls enable row level security;
