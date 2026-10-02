-- תזכורת אחרונה לנרשמים שלא השלימו פרופיל, וסגירת ההרשמה שבוע אחריה.
--
-- final_reminder_sent_at: מתי יצאה התזכורת האחרונה. מרגע שהיא מלאה לא יוצאות
--   עוד תזכורות השלמה למטפל/ת (הובטח במייל עצמו), וזה גם המפתח לאי-שליחה כפולה.
-- signup_archived_at: ההרשמה נסגרה (לא פעילה) שבוע אחרי התזכורת האחרונה, כי
--   הפרופיל נשאר ריק. הפיכה לגמרי: השורה, החשבון והכניסה נשארים, ומי שחוזר
--   וממלא את הפרופיל ממשיך מאותה נקודה. זו לא מחיקה.
--
-- אידמפוטנטי: אפשר להריץ שוב בלי נזק.

alter table public.therapists
  add column if not exists final_reminder_sent_at timestamptz,
  add column if not exists signup_archived_at timestamptz;

create index if not exists therapists_final_reminder_pending_idx
  on public.therapists (final_reminder_sent_at)
  where signup_archived_at is null and final_reminder_sent_at is not null;
