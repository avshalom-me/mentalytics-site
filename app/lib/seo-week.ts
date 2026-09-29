// כמה ימים מתוך שבעה כבר נספרו בשבוע שעדיין רץ, כפי שמופיע על הנקודה
// האחרונה בגרף של /admin/seo ("28.9 · 2/7").
//
// השבוע של ה-RPC (admin_seo_overview) מתחיל ביום שני ב-00:00 UTC, כלומר
// ב-03:00 שעון ישראל בקיץ (02:00 בחורף). התווית חישבה עד 30/9/2026 מחצות
// מקומית של יום שני, ולכן בשלוש השעות שבין 00:00 ל-03:00 בכל לילה היא רצה
// יום קדימה: ב-00:07 של 30/9 היא הראתה "3/7" כשעברו 1.9 ימים.
//
// `week` הוא תאריך יום שני כפי שה-RPC מחזיר ("2026-09-28").

const DAY_MS = 86_400_000;

/** תחילת השבוע במילישניות: יום שני 00:00 UTC. */
export function weekStartMs(week: string): number {
  return Date.parse(`${week}T00:00:00Z`);
}

/** 1 עד 7. היום שעובר עכשיו נספר: בתוך היממה הראשונה זה 1, בשנייה 2, וכן הלאה. */
export function daysCounted(week: string, nowMs: number = Date.now()): number {
  const days = Math.ceil((nowMs - weekStartMs(week)) / DAY_MS);
  return Math.min(7, Math.max(1, Number.isFinite(days) ? days : 1));
}
