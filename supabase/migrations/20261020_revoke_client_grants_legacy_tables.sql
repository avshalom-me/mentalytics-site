-- הסרת ההרשאות של המפתח הציבורי מ-16 טבלאות (20/10/2026, באישור הבעלים).
--
-- Supabase נותנת לכל טבלה חדשה ב-public הרשאה מלאה (קריאה, הוספה, עדכון,
-- מחיקה) לתפקידים anon ו-authenticated, ומשאירה את ההגנה ל-RLS. ב-16 הטבלאות
-- האלה ההרשאה נשארה, כך שכל ההגנה עליהן הייתה RLS בלבד: מספיק שינוי אחד
-- שמכבה RLS על טבלה או מוסיף policy "לכולם", וכל מי שמחזיק את המפתח הציבורי
-- (כל גולש) קורא וכותב בה. זה כבר קרה פעם (אירוע ה-CRITICAL של ה-policies).
--
-- למה זה לא שובר כלום (נבדק לפני ההחלה):
-- - כל הקוד בצד השרת ניגש לטבלאות דרך supabaseAdmin (service_role), שההרשאות
--   שלו לא משתנות. החיבורים עם המפתח הציבורי בשרת משמשים רק ל-auth.getUser.
-- - הדפדפן לא קורא מאף טבלה, חוץ ממילוי מוקדם בעמוד התשלום של המטפלים
--   (app/therapists/checkout/page.tsx), שכבר היום לא מקבל שורה: אין policy
--   שמאפשר למטפל מחובר לקרוא את therapists. אחרי השינוי הוא מקבל שגיאה
--   במקום תוצאה ריקה, והעמוד מתנהג אותו דבר (data ריק, נופל למייל מה-session).
-- - בכל ה-RLS במסד יש רק שני policies לתפקידים האלה: quiz_usage ("false")
--   ו-therapist_insights (שורות של המטפל עצמו), ואף קוד לא קורא את
--   therapist_insights. אין policies על storage שמפנים לטבלאות האלה.
--
-- ביטול: GRANT ALL ON TABLE <table> TO anon, authenticated;
-- טבלאות שייווצרו מ-30/10/2026 כבר לא מקבלות את ההרשאה אוטומטית (שינוי של Supabase).

REVOKE ALL ON TABLE
  public.backup_state,
  public.center_prospects,
  public.center_therapist_invites,
  public.gift_checkout_tokens,
  public.llm_calls,
  public.match_token_visits,
  public.payments,
  public.quiz_usage,
  public.retention_review_rows,
  public.retention_reviews,
  public.subscriptions,
  public.therapist_certificates,
  public.therapist_contact_clicks,
  public.therapist_insights,
  public.therapist_profile_views,
  public.therapists
FROM anon, authenticated;
