-- ענף בתי הספר (שאלון היועצות, בניהול שותפה חיצונית לפי הסכם ענף שאלון
-- היועצות, טיוטה 8). התכנון המלא: Dropbox\פרטי\Mentalitics\טיפול חכם לבתי ספר\
-- "תכנון CRM לענף בתי הספר" (גרסה 2) ו"סכמת בנייה".
--
-- עקרונות:
-- 1. הענף הוא מרכז רווח נפרד (סעיף 8.2 בהסכם): לכל טבלה כאן קידומת school_,
--    ושום דבר אינו נכתב ל-crm_deals / center_prospects של המרכזים.
-- 2. אין כאן מידע על תלמידים. אנשי קשר הם אנשי צוות (יועצת, מנהל, גזבר).
-- 3. תנאי ההסכם (סולם, שערים, דמי פלטפורמה) יושבים ב-school_branch_settings,
--    לא בקוד: הריפו ציבורי.
-- 4. כמו בכל טבלאות האדמין: RLS בלי policies, והרשאות ל-service_role בלבד.
--    הגישה מהשרת דרך supabaseAdmin.
-- 5. משימות והערות של הענף משתמשות ב-crm_tasks / crm_notes הקיימות עם
--    entity_type חדש ('school', 'school_owner', 'school_deal', 'school_license');
--    העמודה שם היא text בלי CHECK, ולכן אין צורך לשנות אותה.

-- ── בעלויות: מי שמשלם בפועל (רשות מקומית, רשת, בעלות פרטית) ────────────────
create table if not exists public.school_owners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'authority'
    check (kind in ('authority', 'network', 'private', 'other')),
  city text,
  region_key text,
  -- תנאי התשלום של הבעלות בימים (שוטף+30 = 30). NULL = עוד לא ידוע.
  payment_terms_days integer,
  -- האם נפתחנו אצלה כספק: none / forms_sent / approved.
  supplier_status text not null default 'none'
    check (supplier_status in ('none', 'forms_sent', 'approved')),
  supplier_notes text,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── בתי ספר (וגנים/מעונות): המוסד שמקבל רישיון ─────────────────────────────
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- סמל מוסד של משרד החינוך. ייחודי כשקיים; גן/מעון בלי סמל נשאר NULL.
  symbol text,
  stage text not null default 'elementary'
    check (stage in ('gan', 'maon', 'elementary', 'middle', 'high', 'six_year', 'other')),
  sector text
    check (sector is null or sector in ('mamlachti', 'mamad', 'haredi', 'arab', 'druze', 'other')),
  owner_id uuid references public.school_owners (id) on delete set null,
  city text,
  region_key text,
  students integer,
  counselors integer,
  status text not null default 'prospect'
    check (status in ('prospect', 'pilot', 'customer', 'past', 'lost', 'not_relevant')),
  -- מאיפה הגיע לרשימה: import / naama / inbound / referral / manual.
  source text,
  -- בית ספר הדגמה: לבדיקות ולהדגמות. מוחרג מהשערים ומכל סטטיסטיקה.
  is_demo boolean not null default false,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists schools_symbol_idx on public.schools (symbol) where symbol is not null;
create index if not exists schools_owner_idx on public.schools (owner_id);
create index if not exists schools_status_idx on public.schools (status);

-- ── אנשי קשר: אנשי צוות בבית הספר או בבעלות (לא תלמידים, לא הורים) ───────────
create table if not exists public.school_contacts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete cascade,
  owner_id uuid references public.school_owners (id) on delete cascade,
  role text not null default 'counselor'
    check (role in ('counselor', 'principal', 'deputy', 'coordinator', 'treasurer', 'education_head', 'other')),
  name text not null,
  phone text,
  email text,
  whatsapp text,
  is_primary boolean not null default false,
  active boolean not null default true,
  -- יועצת שעזבה: נשמרת לתיעוד, ומייצרת משימת היכרות עם המחליפה.
  left_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (school_id is not null or owner_id is not null)
);
create index if not exists school_contacts_school_idx on public.school_contacts (school_id);
create index if not exists school_contacts_owner_idx on public.school_contacts (owner_id);

-- ── עסקאות: הזדמנות מול בית ספר (או מול בעלות, לחבילה של כמה בתי ספר) ───────
create table if not exists public.school_deals (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete cascade,
  owner_id uuid references public.school_owners (id) on delete cascade,
  title text,
  -- שנת הלימודים שהעסקה נוגעת לה, בצורה '2026/27'.
  school_year text,
  stage text not null default 'listed'
    check (stage in ('listed', 'contacted', 'meeting', 'pilot', 'quote_sent', 'approval', 'active', 'renewal', 'frozen', 'lost')),
  product text not null default 'license'
    check (product in ('license', 'training', 'authority_package', 'other')),
  -- הסכום שסוכם או שהוצע, כולל מע"מ. המחיר פתוח: אין מחירון במערכת.
  value_gross numeric,
  source text
    check (source is null or source in ('naama', 'inbound', 'referral', 'gefen', 'authority', 'owner', 'other')),
  -- מי מטפל בעסקה (שם, כמו assignee ב-crm_tasks).
  handler text,
  next_step text,
  next_step_due date,
  -- מסלול הרכש של בית הספר: יוזמה ישירה, מאגר המשרד, דרך הרשות.
  procurement_route text
    check (procurement_route is null or procurement_route in ('initiative', 'registry', 'authority', 'unknown')),
  pilot_start date,
  pilot_end date,
  quote_ref text,
  po_number text,
  expected_payment_date date,
  lost_reason text
    check (lost_reason is null or lost_reason in ('no_budget', 'timing', 'other_tool', 'no_counselor', 'authority_refused', 'no_response', 'other')),
  -- בהקפאה: מתי לחזור.
  frozen_until date,
  notes text,
  stage_changed_at timestamptz not null default now(),
  closed_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (school_id is not null or owner_id is not null)
);
create index if not exists school_deals_school_idx on public.school_deals (school_id);
create index if not exists school_deals_stage_idx on public.school_deals (stage);

-- ── רישיונות: מה שנמכר, ומה שההסכם סופר ("בית ספר משלם", נספח ב') ─────────────
create table if not exists public.school_licenses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  deal_id uuid references public.school_deals (id) on delete set null,
  school_year text not null,
  start_date date not null,
  -- תמיד 31.8 של שנת הלימודים, אלא בפיילוט/הדגמה/ניסיון.
  end_date date not null,
  kind text not null default 'annual'
    check (kind in ('annual', 'partial', 'pilot', 'demo', 'trial', 'training_only')),
  price_gross numeric not null default 0,
  price_net numeric not null default 0,
  -- ברישיון חלקי: מספר החודשים הקלנדריים שבהם הוא בתוקף (להמרה לשנתי בשער ב').
  months integer,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'active', 'expired', 'cancelled')),
  -- קוד הגישה של בית הספר לשאלון. ייחודי. הדפדפן מקבל עוגייה חתומה, לא את הקוד.
  access_code text not null unique,
  code_disabled boolean not null default false,
  -- לוח התשלומים שנבחר לעסקה: מלא עם ההפעלה, או 40% בהפעלה ו-60% עד סוף פברואר.
  schedule_kind text not null default 'full'
    check (schedule_kind in ('full', 'split_40_60')),
  -- התשלום הראשון התקבל: מכאן הרישיון פעיל.
  paid_at timestamptz,
  cancelled_at timestamptz,
  -- הוחזר תוך 30 יום: לא נספר לשער (נספח ב').
  refunded_at timestamptz,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists school_licenses_school_idx on public.school_licenses (school_id);
create index if not exists school_licenses_status_idx on public.school_licenses (status, end_date);

-- ── תקבולים: ספר התקבולים של הענף, על בסיס מזומן (סעיף 8.4) ───────────────────
create table if not exists public.school_payments (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.school_licenses (id) on delete cascade,
  -- 1 = התשלום הראשון (או היחיד), 2 = השלמה ב-40/60.
  seq integer not null default 1,
  amount_gross numeric not null,
  amount_net numeric not null,
  method text
    check (method is null or method in ('card', 'transfer', 'check', 'po', 'other')),
  due_date date,
  status text not null default 'expected'
    check (status in ('expected', 'received', 'refunded', 'cancelled')),
  received_at timestamptz,
  -- המסמך ב-Sumit (חשבונית עסקה / חשבונית מס קבלה). בשלב א' מוקלד ביד.
  sumit_document_id text,
  sumit_document_number text,
  proforma_number text,
  -- שורת הבנק שזוהתה בייבוא החודשי.
  statement_line_id uuid references public.statement_lines (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (license_id, seq)
);

-- ── הדרכות: רכיב ההדרכה (חובה במאגר של המשרד) ושעות שנמכרו בנפרד ─────────────
create table if not exists public.school_trainings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  license_id uuid references public.school_licenses (id) on delete set null,
  held_on date not null,
  hours numeric not null default 1,
  trainer text,
  participants integer,
  topic text,
  billable boolean not null default false,
  amount_gross numeric,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

-- ── יומן פעילות: ציר הזמן של כל ישות, וגם רישום המבצע לכל פעולת מערכת ──────────
create table if not exists public.school_activities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null
    check (entity_type in ('school', 'school_owner', 'school_deal', 'school_license')),
  entity_id uuid not null,
  kind text not null
    check (kind in ('call', 'meeting', 'whatsapp', 'email', 'demo', 'training', 'status', 'system', 'note')),
  summary text not null,
  -- מי רשם: 'avshalom' / 'naama' / 'system'.
  actor text not null default 'system',
  happened_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists school_activities_entity_idx on public.school_activities (entity_type, entity_id, happened_at desc);

-- ── מונה שימוש: כמה שאלונים מילא בית ספר ביום. בלי תשובות ובלי פרטי תלמידים ──
create table if not exists public.school_usage_daily (
  school_id uuid not null references public.schools (id) on delete cascade,
  day date not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (school_id, day)
);

create or replace function public.bump_school_usage(p_school_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.school_usage_daily (school_id, day, count)
  values (p_school_id, (now() at time zone 'Asia/Jerusalem')::date, 1)
  on conflict (school_id, day)
  do update set count = public.school_usage_daily.count + 1, updated_at = now();
$$;
revoke all on function public.bump_school_usage(uuid) from public, anon, authenticated;
grant execute on function public.bump_school_usage(uuid) to service_role;

-- ── הגדרות הענף: פרמטרי ההסכם, עם גרסאות. השורה עם version הגבוה ביותר חלה ──
-- data: { start_date, ladder: [{stage, rate, not_before_month, gate_schools, gate_receipts}],
--         platform_fee: {tier1_max, tier1_monthly, tier2_max, tier2_monthly, pct_above},
--         min_paying_price_net, partial_min_months, trial_enabled, trial_days, quarter: 'calendar' }
create table if not exists public.school_branch_settings (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique,
  effective_from date not null,
  data jsonb not null,
  note text,
  created_by text,
  created_at timestamptz not null default now()
);

-- ── משתמשי שותפים (שלב ב'): כניסה במייל וסיסמה דרך Supabase Auth ───────────────
create table if not exists public.partner_users (
  user_id uuid primary key,
  branch text not null default 'schools' check (branch in ('schools')),
  role text not null default 'partner' check (role in ('partner', 'staff')),
  name text not null,
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── הוצאות: סימון ענף וסיווג לפי ההסכם, ואישור ─────────────────────────────────
-- branch: 'core' (החברה) או 'schools' (הענף). cost_class לפי סעיף 8.3:
-- fees (עמלות סליקה ובנק), staff (עובדי הענף), ops (תפעול ישיר, 8.6),
-- marketing (8.7), platform (דמי פלטפורמה, 8.8; נרשמים אוטומטית), other.
-- approval_status: הוצאה מוצעת נספרת רק אחרי אישור הבעלים. שורות קיימות = approved.
alter table public.expenses
  add column if not exists branch text not null default 'core' check (branch in ('core', 'schools')),
  add column if not exists cost_class text
    check (cost_class is null or cost_class in ('fees', 'staff', 'ops', 'marketing', 'platform', 'other')),
  add column if not exists approval_status text not null default 'approved'
    check (approval_status in ('proposed', 'approved', 'rejected')),
  add column if not exists proposed_by text,
  add column if not exists approved_at timestamptz;
create index if not exists expenses_branch_idx on public.expenses (branch, expense_date);

alter table public.recurring_expenses
  add column if not exists branch text not null default 'core' check (branch in ('core', 'schools')),
  add column if not exists cost_class text
    check (cost_class is null or cost_class in ('fees', 'staff', 'ops', 'marketing', 'platform', 'other'));

-- ── הרשאות: שרת בלבד ────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'school_owners', 'schools', 'school_contacts', 'school_deals', 'school_licenses',
    'school_payments', 'school_trainings', 'school_activities', 'school_usage_daily',
    'school_branch_settings', 'partner_users'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;
