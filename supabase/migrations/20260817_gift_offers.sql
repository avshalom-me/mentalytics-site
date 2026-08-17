-- מסלול השליחה של הצעות קידום מתנה (סוכן פערי ההיצע).
--
-- gift_offers = רישום של כל הצעת מתנה שיצאה בפועל למטפל, אחרי אישור ידני
-- בעמוד הסוכנים. הטבלה משרתת שלושה דברים:
--   1. מניעת הצעה כפולה לאותו מטפל (צינון) - "פנייה אחת למטפל" ולא הצפה.
--   2. השתקת הפער בזמן ההמתנה לתשובה, כדי שהתור לא יציע שוב את מה שכבר נשלח.
--   3. תיעוד: מה בדיוק נשלח, למי, ומאיזה פער - כולל גוף המייל אחרי עריכת האדמין.
--
-- הענקת הקידום עצמה לא נעשית כאן ולא אוטומטית: המייל הוא הצעה, והקידום
-- מוענק ידנית מעמוד המטפלים אחרי שהמטפל משיב שהוא מעוניין.

create table if not exists public.gift_offers (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  region text not null,
  treatment text not null,
  gap_key text,                                  -- dedupe_key של הפער שממנו נולדה ההצעה
  agent_action_id uuid references public.agent_actions(id) on delete set null,
  months integer not null default 2,             -- אורך הקידום שהוצע
  subject text,
  body text,                                     -- הטקסט שנשלח בפועל (אחרי עריכה)
  sent_by text not null default 'admin',
  sent_at timestamptz not null default now()
);

-- שאילתת הצינון: "האם למטפל הזה כבר נשלחה הצעה לאחרונה".
create index if not exists gift_offers_therapist_idx
  on public.gift_offers (therapist_id, sent_at desc);
-- שאילתת ההמתנה: "האם לחיתוך הזה כבר יצאה הצעה שממתינה לתשובה".
create index if not exists gift_offers_gap_idx
  on public.gift_offers (region, treatment, sent_at desc);

alter table public.gift_offers enable row level security;
revoke all on public.gift_offers from anon, authenticated;
grant select, insert, update, delete on public.gift_offers to service_role;
