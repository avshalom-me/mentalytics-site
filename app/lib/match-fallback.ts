import { ALL_REGIONS, CITY_TO_REGION } from "./regions";

// ─────────────────────────────────────────────────────────────────────────────
// FREE_REGION_FALLBACK — פיצ'ר זמני.
//
// מטפלים חינמיים מאושרים נכנסים למאגר ההתאמות כגיבוי, רק כשהמטופל לא ביקש
// טיפול אונליין, ורק באחד משני מצבים באזור המבוקש (אזור שלם, לא רק עיר):
//   1. region_empty — אין אף מטפל משלם/מקודם שמכסה את האזור.
//   2. expertise_gap — יש משלמים באזור, אבל אף אחד מהם לא בתחום הטיפול
//      שהמטופל הופנה אליו (או בסוג המטפל הנדרש) — ואז נכנסים רק חינמיים
//      מהאזור שכן בתחום.
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

// Local normalization so raw admin values ("CBT") and normalized match-API
// values ("cbt") compare consistently.
function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** True if the two lists share at least one value (case/whitespace-insensitive). */
export function overlaps(a: string[], b: string[]): boolean {
  const setB = new Set(b.map(norm));
  return a.some((item) => setB.has(norm(item)));
}

/**
 * A therapist's effective expertise list — same synthesis the match scoring
 * uses: training areas + assessment types, plus "טיפול זוגי" when any couples
 * modality is declared. Returned normalized.
 */
export function expertiseOf(
  trainingAreas: string[],
  assessmentTypes: string[],
  couplesModalities: string[]
): string[] {
  const areas = [
    ...trainingAreas,
    ...assessmentTypes,
    ...(couplesModalities.length > 0 ? ["טיפול זוגי"] : []),
  ];
  return Array.from(new Set(areas.map(norm).filter(Boolean)));
}
