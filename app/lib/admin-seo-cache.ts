// כמה טרי צריך להיות העותק ש-/admin/seo קורא (admin_report_cache).
//
// pg_cron מחשב אותו כל 6 שעות (30 */6 * * *, כלומר 03:30 / 09:30 / 15:30 /
// 21:30 בשעון ישראל בקיץ). ב-24-28/9/2026 הריצה היחידה של הלילה נכשלה עם
// "job startup timeout": כל בסיס הנתונים נתקע כ-6 שעות (כ-370 בקשות נחתכו
// ב-8 שניות), והעמוד נשאר על העותק של יום שני ב-03:30 - שנגמר בשבוע המלא
// הקודם, כך שהשבוע החדש לא הופיע בו בכלל. מעל 14 שעות = שתי ריצות ברצף
// נפלו, ואז העמוד מנסה לחשב חי במקום להסתפק בעותק.
export const SEO_CACHE_FRESH_MS = 14 * 3_600_000;

export type SeoCacheFreshness = "missing" | "fresh" | "stale";

export function seoCacheFreshness(
  computedAt: string | null | undefined,
  nowMs: number = Date.now(),
): SeoCacheFreshness {
  if (!computedAt) return "missing";
  const at = Date.parse(computedAt);
  if (!Number.isFinite(at)) return "missing";
  return nowMs - at > SEO_CACHE_FRESH_MS ? "stale" : "fresh";
}

/** "לפני שעה", "לפני 5 שעות", "לפני יומיים" - הגיל של העותק בעברית. */
export function ageInHebrew(computedAt: string, nowMs: number = Date.now()): string {
  const hours = Math.max(0, Math.floor((nowMs - Date.parse(computedAt)) / 3_600_000));
  if (hours < 1) return "לפני פחות משעה";
  if (hours === 1) return "לפני שעה";
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "לפני יום" : days === 2 ? "לפני יומיים" : `לפני ${days} ימים`;
}
