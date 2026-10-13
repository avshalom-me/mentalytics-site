-- "הארכה במתנה - שימור": הפסקה זמנית של החיובים למטפל/ת משלם/ת.
--
-- המנגנון: הוראת הקבע ב-Sumit נשארת כמו שהיא, ורק תאריך החיוב הבא שלה נדחה
-- (NextPaymentDate). בסוף התקופה Sumit ממשיכה לחייב מעצמה - אין אצלנו שום
-- פעולה שצריכה לקרות כדי שהתשלומים יחזרו.
--
-- retention_gift_until        התאריך שבו החיוב חוזר (= תאריך החיוב הבא החדש)
-- retention_gift_prev_billing תאריך החיוב הבא כפי שהיה לפני המתנה
-- retention_gift_months       כמה חודשים ניתנו
-- retention_gift_granted_at   מתי ניתנה (נשאר גם אחרי שהמתנה נגמרה, לתיעוד)
-- retention_gift_reminded_at  מתי יצא המייל של "שבוע לפני הסוף" (פעם אחת בלבד)
--
-- אידמפוטנטי: אפשר להריץ שוב בלי נזק. טבלה קיימת, ולכן אין צורך ב-GRANT חדש.

alter table public.subscriptions
  add column if not exists retention_gift_granted_at timestamptz,
  add column if not exists retention_gift_until date,
  add column if not exists retention_gift_prev_billing date,
  add column if not exists retention_gift_months integer,
  add column if not exists retention_gift_reminded_at timestamptz;

create index if not exists subscriptions_retention_gift_until_idx
  on public.subscriptions (retention_gift_until)
  where retention_gift_until is not null;
