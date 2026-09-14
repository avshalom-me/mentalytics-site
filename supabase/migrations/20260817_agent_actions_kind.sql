-- סיווג התוצר במקור: פעולה מול ממצא.
--
-- עד היום העמוד ניחש לפי action_type ("recruit_gap"/"alert" = ממצא, השאר =
-- פעולה). עם 11 סוכנים הניחוש הזה נשבר: כל סוכן חדש מוסיף שם חדש שצריך
-- לזכור להוסיף לרשימה ב-UI, ואם שוכחים - ממצא חדש מוצג כמשימה שדורשת
-- החלטה ומציף את התור.
--
-- action  = יש בו מה לעשות ורק האדמין יכול להכריע (הצעת מתנה לשליחה).
-- finding = מסקנה נכונה כל עוד המצב קיים, בלי "אשר/דחה" אמיתי (פער גיוס,
--           קמפיין ששורף כסף, בדיקה שנכשלה). חוזר מעצמו אם המצב נמשך.
alter table public.agent_actions
  add column if not exists kind text not null default 'action'
    check (kind in ('action', 'finding'));

-- מילוי לאחור לפי הסיווג שה-UI ניחש עד עכשיו, כדי שהתור הקיים לא ישנה
-- התנהגות ברגע הפריסה.
update public.agent_actions
set kind = 'finding'
where action_type in ('alert', 'recruit_gap');

create index if not exists agent_actions_kind_status_idx
  on public.agent_actions (kind, status, created_at desc);
