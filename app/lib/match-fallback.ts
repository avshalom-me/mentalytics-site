import { ALL_REGIONS, CITY_TO_REGION } from "./regions";

// ─────────────────────────────────────────────────────────────────────────────
// FREE_REGION_FALLBACK — פיצ'ר זמני.
//
// כשאין אף מטפל משלם/מקודם שמכסה את האזור המבוקש (אזור שלם, לא רק עיר),
// והמטופל לא ביקש טיפול אונליין — מטפלים חינמיים מאושרים שמכסים את האזור
// נכנסים למאגר ההתאמות כגיבוי.
//
// להסרה עתידית: לשנות ל-false (או למחוק את הקובץ ואת כל הבלוקים המסומנים
// FREE_REGION_FALLBACK — חיפוש "FREE_REGION_FALLBACK" מוצא את כולם:
// app/api/match/route.ts + app/admin/therapists/page.tsx).
// ─────────────────────────────────────────────────────────────────────────────
export const FREE_REGION_FALLBACK_ENABLED = true;

/**
 * Maps a therapist's regions list (entries may be city names or region names,
 * raw or normalized) to the set of region names they cover. Unknown entries
 * (e.g. "אונליין") are dropped.
 */
export function regionsCovered(regionEntries: string[]): Set<string> {
  const covered = new Set<string>();
  for (const raw of regionEntries) {
    const entry = String(raw ?? "").trim();
    if (!entry) continue;
    const region = CITY_TO_REGION[entry] ?? entry;
    if ((ALL_REGIONS as readonly string[]).includes(region)) covered.add(region);
  }
  return covered;
}

/** True if the therapist's regions list covers the given region (via a city in it or the region itself). */
export function coversRegion(regionEntries: string[], region: string): boolean {
  return regionsCovered(regionEntries).has(region);
}
