/**
 * Unified taxonomy for therapist stats tracking.
 * Keep this file the single source of truth — DB enforces only `text`,
 * but API validation uses these constants.
 */

export const ISSUE_CATEGORIES = [
  "emotional",       // רגשי — דיכאון/חרדה/טראומה/דימוי עצמי
  "relationship",    // זוגיות/משפחה
  "addiction",       // התמכרות
  "functional",      // תפקודי/תעסוקתי/קשב וריכוז/אקדמי
  "personal",        // התפתחות אישית
  "sexual",          // טיפול מיני
  "parenting",       // הדרכת הורים
  "child",           // התפתחותי/רגשי של ילדים
  "other",
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const ISSUE_LABELS: Record<IssueCategory, string> = {
  emotional: "רגשי",
  relationship: "זוגיות / משפחה",
  addiction: "התמכרות",
  functional: "תפקודי / תעסוקתי",
  personal: "התפתחות אישית",
  sexual: "טיפול מיני",
  parenting: "הדרכת הורים",
  child: "ילדים ונוער",
  other: "אחר",
};

export const TREATMENT_CATEGORIES = [
  "cbt",
  "dynamic",
  "dbt",
  "emdr",
  "couples",
  "family",
  "sexual",
  "addiction",
  "parenting",
  "occupational",
  "cog-fun",
  "other",
] as const;
export type TreatmentCategory = (typeof TREATMENT_CATEGORIES)[number];

export const REGION_CATEGORIES = [
  "center",        // גוש דן + שפלה
  "sharon",        // צפון/דרום השרון
  "jerusalem",     // ירושלים וסביבה
  "haifa",         // חיפה והקריות
  "north",         // גליל + עמק יזרעאל
  "south",         // דרום (באר שבע, אשקלון, אשדוד)
  "online",        // אונליין בלבד
  "other",
] as const;
export type RegionCategory = (typeof REGION_CATEGORIES)[number];

export const REGION_LABELS: Record<RegionCategory, string> = {
  center: "מרכז / גוש דן",
  sharon: "השרון",
  jerusalem: "ירושלים והסביבה",
  haifa: "חיפה והקריות",
  north: "צפון / גליל",
  south: "דרום",
  online: "אונליין",
  other: "אחר",
};

export const AGE_BANDS = ["child", "18-30", "31-45", "46-60", "60+"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const AGE_LABELS: Record<AgeBand, string> = {
  child: "ילדים/נוער",
  "18-30": "18-30",
  "31-45": "31-45",
  "46-60": "46-60",
  "60+": "60+",
};

export const GENDERS = ["m", "f", "other"] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  m: "גבר",
  f: "אישה",
  other: "אחר",
};

/** Map the app's internal region names (from regions.ts) to stats buckets. */
export function normalizeRegion(raw: string | null | undefined): RegionCategory | null {
  if (!raw) return null;
  const r = raw.trim().toLowerCase();
  if (r === "online" || r.includes("אונליין")) return "online";
  if (r.includes("גוש דן") || r.includes("שפלה") || r === "center") return "center";
  if (r.includes("שרון") || r === "sharon") return "sharon";
  if (r.includes("ירושלים") || r === "jerusalem") return "jerusalem";
  if (r.includes("חיפה") || r.includes("קריות") || r === "haifa") return "haifa";
  if (r.includes("גליל") || r.includes("עמק") || r === "north") return "north";
  if (r.includes("דרום") || r.includes("באר שבע") || r.includes("אשקלון") || r.includes("אשדוד") || r === "south") return "south";
  return "other";
}

export function normalizeAge(age: number | null | undefined): AgeBand | null {
  if (age == null || isNaN(age)) return null;
  if (age < 18) return "child";
  if (age <= 30) return "18-30";
  if (age <= 45) return "31-45";
  if (age <= 60) return "46-60";
  return "60+";
}

export function normalizeGender(raw: string | null | undefined): Gender | null {
  if (!raw) return null;
  const g = raw.trim().toLowerCase();
  if (g === "m" || g === "male" || g === "זכר" || g === "גבר") return "m";
  if (g === "f" || g === "female" || g === "נקבה" || g === "אישה") return "f";
  return "other";
}

export function isValidIssue(x: unknown): x is IssueCategory {
  return typeof x === "string" && (ISSUE_CATEGORIES as readonly string[]).includes(x);
}
export function isValidTreatment(x: unknown): x is TreatmentCategory {
  return typeof x === "string" && (TREATMENT_CATEGORIES as readonly string[]).includes(x);
}
export function isValidRegion(x: unknown): x is RegionCategory {
  return typeof x === "string" && (REGION_CATEGORIES as readonly string[]).includes(x);
}
export function isValidAgeBand(x: unknown): x is AgeBand {
  return typeof x === "string" && (AGE_BANDS as readonly string[]).includes(x);
}
export function isValidGender(x: unknown): x is Gender {
  return typeof x === "string" && (GENDERS as readonly string[]).includes(x);
}
