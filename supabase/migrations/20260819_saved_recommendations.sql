-- שמירת ההמלצות עצמן, לא רק רשימת המטפלים.
--
-- למה: 28% ממסיימי השאלון (מדידה 17/8/2026) קוראים את ההמלצות בממוצע 206
-- שניות ועוזבים בלי לחפש מטפל. הם לא נטשו מתוך חוסר עניין - הם קראו לעומק
-- ואז הלכו, כנראה כדי לחשוב. הקישור השמור הקיים נוצר רק *אחרי* החיפוש, כלומר
-- בדיוק אחרי הנקודה שבה הם כבר לא נמצאים. השדה הזה מאפשר לשמור כבר במסך
-- ההמלצות, ולתת דרך חזרה במקום לנסות למנוע יציאה.
--
-- ── החלטת פרטיות ─────────────────────────────────────────────────────────
-- נשמרות *תוויות הטיפול המומלץ* בלבד ("CBT", "טיפול דינאמי") ולא ממצאי
-- השאלון ולא התשובות. "סימני דיכאון בינוני" הוא מידע בריאותי במובן הרגיש
-- של תיקון 13, והקישור נשלח בוואטסאפ ועלול להיות מועבר הלאה. תווית טיפול
-- לבדה היא מה שהמשתמש צריך כדי לחזור ולהמשיך, בלי לאחסן אבחנה.
--
-- therapist_ids הופך ל-nullable: לרשומה שנוצרת במסך ההמלצות עוד אין מטפלים
-- (החיפוש לא רץ). ה-CHECK מוודא שכל רשומה נושאת לפחות אחד מהשניים, אחרת
-- אפשר היה ליצור טוקן ריק שמוביל לעמוד בלי תוכן.
alter table public.match_tokens
  alter column therapist_ids drop not null;

alter table public.match_tokens
  add column if not exists recommended_treatments text[];

alter table public.match_tokens
  drop constraint if exists match_tokens_has_content;

alter table public.match_tokens
  add constraint match_tokens_has_content check (
    coalesce(array_length(therapist_ids, 1), 0) > 0
    or coalesce(array_length(recommended_treatments, 1), 0) > 0
  );

comment on column public.match_tokens.recommended_treatments is
  'תוויות הטיפול שהומלצו בשאלון. ללא ממצאים קליניים - ראו ההערה במיגרציה.';
