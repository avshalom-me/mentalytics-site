-- מסלול מרכזים טיפוליים (2026-07-05): הצעת מחיר פר-מרכז + חיוב חוזר ב-Sumit.
--
-- זרימה: האדמין יוצר רשומת מרכז עם מסלול/ים וסכום חודשי מותאם (מה שסוכם
-- בהצעת המחיר) ואופציונלית חודשי מתנה. המערכת מנפיקה קישור סודי
-- (/centers/join/<token>) שבו המרכז רואה מה הוא מקבל בכל מסלול וממלא פרטי
-- אשראי. החיוב נוצר כהוראת קבע ב-Sumit; חודשי מתנה = Date_Start עתידי על
-- הוראת הקבע (הכרטיס נשמר מיד, החיוב הראשון נדחה).
--
-- נפרד מ-subscriptions של מטפלים בכוונה: מודל הגבייה שונה (סכום מותאם
-- אישית, מסלולים פר-מרכז, מתנה) והאדמין רוצה חלק נפרד.

CREATE TABLE public.therapy_center_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- קישור אופציונלי לרשומת הארגון ב-CRM (טבלת organizations)
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,

  name text NOT NULL,                 -- שם המרכז
  contact_name text,
  email text,
  phone text,
  notes text,                         -- הערות פנימיות לאדמין

  token text NOT NULL UNIQUE,         -- טוקן הקישור הסודי שנשלח למרכז
  -- המסלולים שמוצעים למרכז הזה: [{key, title, monthly_price, features: [..]}]
  -- monthly_price לפני מע"מ, כמו כל המחירים במערכת.
  plans jsonb NOT NULL DEFAULT '[]',
  gift_months int NOT NULL DEFAULT 0 CHECK (gift_months >= 0 AND gift_months <= 12),

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'active', 'cancelled')),

  -- נקבעים ברגע התשלום:
  selected_plan_key text,
  agreed_monthly_price numeric,       -- המחיר החודשי (לפני מע"מ) של המסלול שנבחר
  billing_starts_at date,             -- תאריך החיוב הראשון (אחרי המתנה)
  payer_name text,
  payer_email text,
  payer_phone text,
  payer_company_number text,          -- ח.פ / עוסק מורשה

  sumit_recurring_id text,            -- מזהה הוראת הקבע ב-Sumit (לביטול/עדכון)
  sumit_document_id text,             -- מסמך החיוב הראשון (אם חויב מיידית)

  paid_at timestamptz,                -- מתי הוזנו פרטי התשלום
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX therapy_center_accounts_status_idx
  ON public.therapy_center_accounts (status, created_at DESC);

-- service_role בלבד; העמוד הציבורי ניגש דרך route של השרת בלבד (לפי token).
ALTER TABLE public.therapy_center_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.therapy_center_accounts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.therapy_center_accounts FROM anon, authenticated;
GRANT ALL ON public.therapy_center_accounts TO service_role;
