-- draft_note: ההערה הפנימית שהמודל מחזיר (למשל "לא בטוח לגבי X") נזרקה עד
-- היום - הפרומפט הבטיח אותה ואיש לא שמר אותה. send_started_at: מנעול שליחה
-- עם פקיעה, כדי ששתי לשוניות אדמין פתוחות לא ישלחו את אותה תשובה פעמיים.
alter table public.inbox_messages
  add column if not exists draft_note text,
  add column if not exists send_started_at timestamptz;
