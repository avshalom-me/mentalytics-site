-- אבטחה: email_send_counter (מונה המיילים ההמוניים היומי, מנגנון
-- EMAIL_BULK_DAILY_CAP) נוצר עם RLS כבוי ו-anon בעל CRUD מלא — כל מי שמחזיק
-- במפתח ה-anon הציבורי יכול לאפס/לנפח אותו דרך PostgREST (עקיפת רשת הביטחון
-- של Resend או חסימת כל המיילים ההמוניים). זו אותה משפחת חור שתוקנה ב-
-- 20260702_rls_scope_service_role; הטבלה הזו נוצרה מאוחר יותר ופספסה אותה.
-- האפליקציה ניגשת למונה אך ורק דרך service_role (bump_email_counter RPC ב-
-- app/lib/email-quota.ts), אז נעילה מלאה אינה שוברת דבר. סוגר את ה-lint
-- rls_disabled_in_public ואת שתי אזהרות ה-SECURITY DEFINER על bump_email_counter.

alter table public.email_send_counter enable row level security;

revoke all on public.email_send_counter from anon, authenticated;

-- הפונקציה SECURITY DEFINER — לחסום הרצה מ-anon/authenticated (וגם דרך PUBLIC),
-- ולהשאיר הרשאה מפורשת ל-service_role שדרכו האפליקציה קוראת לה.
revoke execute on function public.bump_email_counter(integer) from public, anon, authenticated;
grant execute on function public.bump_email_counter(integer) to service_role;
