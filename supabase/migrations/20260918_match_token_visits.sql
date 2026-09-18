-- ביקורים אמיתיים ברשימת התאמות שמורה (/match/<token>), עם מזהה הסשן.
--
-- למה: מטופל שומר את רשימת המטפלים ששאלון ההתאמה המליץ לו ושולח אותה לעצמו
-- בוואטסאפ, וחוזר אליה מאוחר יותר - לפעמים מטלפון אחר, בסשן חדש. עד עכשיו
-- הפנייה שנולדה מהחזרה הזו לא הייתה ניתנת לקישור לשאלון שממנו הגיעה: אירוע
-- ה-page_view של החזרה לא נשא את הטוקן, וב-match_tokens יש רק מונה.
-- השורה כאן מחברת: פנייה (session_id) ← ביקור (token) ← match_tokens.session_id
-- (סשן השאלון המקורי).
--
-- גם מתקן מדידה: match_tokens.visit_count עולה בכל רינדור בשרת, כולל
-- התצוגה המקדימה שוואטסאפ מושך כשהקישור נשלח. כאן נרשם רק ביקור של דפדפן
-- שהריץ JavaScript ולא ביקש ביטול מדידה.
--
-- אין כאן מידע אישי: טוקן אקראי ומזהה סשן אנונימי.
create table if not exists public.match_token_visits (
  id bigint generated always as identity primary key,
  token text not null references public.match_tokens(token) on delete cascade,
  session_id text not null,
  visited_at timestamptz not null default now()
);

create index if not exists match_token_visits_token_idx on public.match_token_visits (token, visited_at desc);
create index if not exists match_token_visits_session_idx on public.match_token_visits (session_id);

alter table public.match_token_visits enable row level security;

grant select, insert, update, delete on public.match_token_visits to service_role;

comment on table public.match_token_visits is 'ביקור אמיתי (דפדפן, בלי ביטול מדידה) ברשימת התאמות שמורה, עם מזהה הסשן - מחבר פנייה לשאלון המקורי דרך match_tokens.session_id.';
