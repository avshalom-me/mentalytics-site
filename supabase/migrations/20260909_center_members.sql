-- חברי צוות של מרכז טיפולי: יותר מכניסה אחת לאותו פורטל.
--
-- עד היום מרכז זוהה אך ורק לפי therapy_center_accounts.user_id - עמודה אחת,
-- חשבון Supabase Auth אחד. מרכז ביקש כניסה לאדם שני, ובמודל הזה זה בלתי
-- אפשרי גם ידנית. הטבלה הזו הופכת למקור האמת לגישה; user_id בטבלת המרכז
-- נשאר כ"החשבון הראשי" (זה שקישר את המרכז) לתצוגה ולהגנה מפני נעילה.
--
-- מה שנשמר במכוון מהמודל הישן:
--   * UNIQUE(user_id) - משתמש אחד מנהל מרכז אחד לכל היותר. resolveCenter מחזיר
--     מרכז יחיד, ולפורטל אין מחליף-מרכזים; בלי הייחודיות התוצאה הייתה תלויה
--     בסדר שורות. זו אותה כוונה כמו therapy_center_accounts_user_uniq.
--   * אין claim-by-email. חבר חדש נוסף רק על ידי חבר קיים ומאומת (או אדמין),
--     כי המייל בהרשמה אינו מאומת ו"יש לי מייל תואם" אינו הוכחת בעלות.
--
-- email מוכפל כאן בזמן ההוספה: auth.users אינו נגיש מ-supabase-js, ובלעדיו
-- כל רינדור של הרשימה היה דורש listUsers. added_by ריק = backfill / claim.

BEGIN;

CREATE TABLE IF NOT EXISTS public.center_members (
  center_id  uuid NOT NULL REFERENCES public.therapy_center_accounts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  email      text,
  added_by   uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (center_id, user_id),
  CONSTRAINT center_members_user_uniq UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS center_members_center_idx ON public.center_members (center_id);

ALTER TABLE public.center_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.center_members
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.center_members FROM anon, authenticated;
GRANT ALL ON public.center_members TO service_role;

-- backfill: כל חשבון שכבר מקושר הופך לחבר. שום מרכז לא מאבד גישה ברגע
-- ש-resolveCenter עובר לקרוא מכאן.
INSERT INTO public.center_members (center_id, user_id, email, added_by)
SELECT c.id, c.user_id, u.email, NULL
FROM public.therapy_center_accounts c
LEFT JOIN auth.users u ON u.id = c.user_id
WHERE c.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
