-- מעבר ממודל "מסלולים" למודל מחיר-פר-מטפל × מספר-מטפלים.
-- price_per_therapist = המחיר החודשי המוזל לכל מטפל (לפני מע"מ).
-- therapist_count     = מספר המטפלים בהצעה. סה"כ חודשי = price_per_therapist × therapist_count.
-- plans/selected_plan_key נשארים כשדות legacy (לא בשימוש בזרימה החדשה).
alter table public.therapy_center_accounts
  add column if not exists price_per_therapist numeric,
  add column if not exists therapist_count integer;

-- כדי שהוספת מרכז חדש לא תחייב plans (legacy), נותנים ברירת מחדל ריקה.
alter table public.therapy_center_accounts
  alter column plans set default '[]'::jsonb;

-- הטבלה סגורה ל-service_role בלבד; ודא הרשאות מפורשות (נוהל הפרויקט).
grant select, insert, update, delete on public.therapy_center_accounts to service_role;
