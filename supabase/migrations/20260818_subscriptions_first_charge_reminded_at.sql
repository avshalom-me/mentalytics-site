-- תזכורת שבוע לפני החיוב הראשון במסלול ההזמנה. הסימון יושב על המנוי ולא
-- על המטפל, כי הוא שייך לחיוב הספציפי הזה: מטפל שיבטל ויצטרף שוב יקבל
-- תזכורת חדשה, ולא יישאר מסומן מהפעם הקודמת.
alter table public.subscriptions
  add column if not exists first_charge_reminded_at timestamptz;
