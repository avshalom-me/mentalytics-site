-- דירוג חומרה לתור ההצעות. עד היום כל הפריטים נראו זהים, וממצא של
-- "מידע הולך לאיבוד בשקט" ישב יומיים לצד "מטפל לא עדכן פרופיל".
--
--   critical - נתונים אובדים / כסף נגבה שלא כדין / מסלול שבור בפרודקשן
--   high     - הבטחה ללקוח לא מקוימת, או הכנסה בסיכון
--   normal   - ברירת המחדל: יש מה לעשות, אבל שום דבר לא נשבר
--   low      - לידיעה בלבד
alter table public.agent_actions
  add column if not exists severity text not null default 'normal'
  check (severity in ('critical','high','normal','low'));

-- הפתוחים קודם, החמורים בראש, ובתוך אותה חומרה - הישנים קודם.
create index if not exists agent_actions_severity_idx
  on public.agent_actions (status, severity, created_at);
