-- תזכורת חד-פעמית למטפל שקיבל הזמנת-מילוי ולא השלים (cron center-nudges).
alter table public.center_therapist_invites
  add column if not exists reminded_at timestamptz;

grant select, insert, update, delete on public.center_therapist_invites to service_role;
