-- 'superseded': הפונה שלח הודעה חדשה יותר באותו שרשור לפני שענינו על
-- הקודמת. הישנה יורדת מהתור - עונים פעם אחת, על ההודעה האחרונה, עם
-- ההיסטוריה כהקשר - במקום שני כרטיסים פתוחים לאותה שיחה.
alter table public.inbox_messages drop constraint if exists inbox_messages_status_check;
alter table public.inbox_messages add constraint inbox_messages_status_check check (
  status in ('new','drafted','sent','sent_external','ignored','superseded')
);
