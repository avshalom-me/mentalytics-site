-- Availability flag (2026-07-22): a therapist can be marked "כעת לא זמין/ה
-- לקבלת מטופלים / אבחונים חדשים" — by themselves (dashboard) or by the admin.
-- Effect: excluded from the matching engine and from new site messages;
-- still listed in the public directory (sorted last, contact buttons replaced
-- by an unavailability note that refers to similar therapists / the quiz).
ALTER TABLE public.therapists
  ADD COLUMN accepting_new_patients boolean NOT NULL DEFAULT true,
  ADD COLUMN accepting_new_changed_at timestamptz;
