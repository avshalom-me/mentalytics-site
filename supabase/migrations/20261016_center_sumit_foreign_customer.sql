-- sumit_foreign_customer_at - מתי הסנכרון היומי מצא לראשונה שהוראת הקבע של
-- המרכז רשומה ב-Sumit תחת לקוח אחר (נמצאה לפי פרטי המשלם ולא לפי
-- center:<id>). מונע התראה חוזרת כל יום; מתאפס כשההוראה נמצאת שוב לפי המזהה
-- שלנו. ראו findRecurringUnderPayerDetails ב-app/lib/sumit.ts.
alter table public.therapy_center_accounts
  add column if not exists sumit_foreign_customer_at timestamptz;
