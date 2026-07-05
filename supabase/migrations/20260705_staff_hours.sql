-- שעות עבודה לעובדים (2026-07-05): טבלת עובדים + רישומי כניסה/יציאה.
-- העובדים מדווחים דרך עמוד ציבורי (/staff) עם קוד אישי (PIN); האדמין מנהל
-- עובדים, מתקן רישומים ורואה סיכומים חודשיים ב-/admin/staff.
--
-- ה-PIN נשמר כטקסט רגיל בכוונה: זהו קוד שעון-נוכחות בעל ערך נמוך (לא סיסמה
-- לשימוש חוזר), האדמין צריך לראות אותו כדי למסור לעובד, והטבלה נגישה רק
-- ל-service_role. ה-API מגביל ניסיונות ניחוש לפי IP.

CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  pin text UNIQUE,              -- קוד דיווח אישי (4-8 ספרות); NULL = טרם הוגדר, אי אפשר לדווח
  hourly_rate numeric,          -- אופציונלי — לחישוב עלות שכר עתידי
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.staff_work_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  clock_in timestamptz NOT NULL,
  clock_out timestamptz,        -- NULL = משמרת פתוחה (טרם דווחה יציאה)
  note text,
  source text NOT NULL DEFAULT 'self', -- self = דיווח עצמי / admin = הוזן או תוקן ע"י אדמין
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_session_valid_range CHECK (clock_out IS NULL OR clock_out > clock_in)
);

CREATE INDEX staff_work_sessions_staff_idx
  ON public.staff_work_sessions (staff_id, clock_in DESC);

-- service_role בלבד, לפי הקונבנציה של 20260702_rls_scope_service_role.
ALTER TABLE public.staff_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_work_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.staff_members       FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.staff_work_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.staff_members       FROM anon, authenticated;
REVOKE ALL ON public.staff_work_sessions FROM anon, authenticated;

GRANT ALL ON public.staff_members       TO service_role;
GRANT ALL ON public.staff_work_sessions TO service_role;

-- העובדת הראשונה. בלי PIN — האדמין מגדיר לה קוד במסך ניהול הצוות ורק אז
-- היא יכולה להתחיל לדווח.
INSERT INTO public.staff_members (full_name) VALUES ('עומר סבו');
