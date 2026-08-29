-- הטבלה מכילה תוכן מיילים של לקוחות. הגישה היחידה המתוכננת היא service_role
-- (השרת), ו-RLS בלי policies כבר חוסם את anon - אבל הרשאות ברירת המחדל של
-- Supabase נשארו על הטבלה, והגנה אחת עדיפה כשתיים קיימות.
revoke all on public.inbox_messages from anon, authenticated;
