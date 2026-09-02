/**
 * מסלולי הבירוקרטיה של תלמיד עם קושי: צוות רב-מקצועי, ועדת זכאות ואפיון,
 * ועדת התאמות בדרכי היבחנות, והערר על כל אחת מהן.
 *
 * Pure: no React, no I/O, no clock. `today` is injected, so the deadline
 * arithmetic is testable and a report can be reproduced for the day it was
 * written. Call sites pass israelToday(): Vercel runs on UTC, and a deadline
 * that flips at 02:00 Israel time is exactly the kind of bug nobody notices
 * until April.
 *
 * SOURCING RULE FOR THIS FILE - inherited from btl-tracks.ts, do not relax it.
 * Every date, window and list here was read in an official document, and each
 * carries its source tag. Where the official text does not state a number, the
 * code says so instead of guessing. Two things this file deliberately does NOT
 * contain because the sources do not state them: a validity period in years
 * for assessments (the rule is a floor date, [D] §8), and numeric functioning
 * levels (the ministry page names assessment areas, not levels, [B]).
 * Commercial assessment centres publish both numbers with confidence; that is
 * how the first draft of this plan got them wrong.
 *
 * What is clinical - which findings should push a child toward which track,
 * how urgent, what counts as "interventions tried" - is NOT here. It lives in
 * school-tracks-clinical.ts as reviewable rules, and this engine applies only
 * the rules marked approved.
 *
 * Sources (read 2.9.2026):
 *  [A] תוספת ראשונה: גורמים שאבחנתם או חוות דעתם קבילה בוועדות מתוקף תיקון 11
 *      http://meyda.education.gov.il/files/PortalBaaluyot/POB/admissible-functionary.pdf
 *  [B] פורטל רשויות ובעלויות חינוך - ועדת זכאות ואפיון
 *      https://pob.education.gov.il/students/main-special-education/entitlement-committee/
 *  [C] כל-זכות - ועדת זכאות ואפיון לשירותי חינוך מיוחדים (השגה, מועד 15.7)
 *      https://www.kolzchut.org.il/he/ועדת_זכאות_ואפיון_לשירותי_חינוך_מיוחדים
 *  [D] חוזר נהלים - הגשת בקשות להתאמות בדרכי היבחנות בבחינות הבגרות, תשפ"ה (9.12.2024)
 *      https://meyda.education.gov.il/files/shefi/liikoheylemida/Hatamot_2024/Hozer_Hatamot_2024-2025.pdf
 *  [E] שפ"ינט - נהלים להתאמות (מפרסם את חוזר השנה השוטפת)
 *      https://shefi.education.gov.il/learning-disabilities/procedures-for-adjustments/
 */

import { ASSESSMENT_TYPES } from "./therapist-options";

// ── Vocabulary shared with the kids questionnaire ────────────────────────────

/** Grades the school rubric serves. Same literals as the kids questionnaire's grade tracks. */
export const SCHOOL_GRADES = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "יא", "יב"] as const;
export type SchoolGrade = (typeof SCHOOL_GRADES)[number];

/**
 * External referral keys of the kids questionnaire that name a diagnosing
 * professional. Must match the `key` strings in EXTERNAL_PATTERNS of
 * kids-recommendations.ts character for character - the drift test checks.
 */
export const EXTERNAL_DIAGNOSER_KEYS = ["נוירולוג קשב", "פסיכיאטר ילדים", "פסיכולוג חינוכי", "פסיכולוג קליני"] as const;

/**
 * What a counsellor can say a student "already has". This is the kids
 * questionnaire's own vocabulary - its assessment types plus the referral keys
 * above - so the two engines describe the same document with the same word.
 */
export const DIAGNOSIS_KINDS = [...ASSESSMENT_TYPES, ...EXTERNAL_DIAGNOSER_KEYS] as const;
export type DiagnosisKind = (typeof DIAGNOSIS_KINDS)[number];

// ── The First Schedule: who may diagnose what [A] ────────────────────────────

export const DISABILITY_CATEGORIES = [
  "משכל גבולי",
  "מוגבלות שכלית התפתחותית",
  "חשד למוגבלות שכלית התפתחותית",
  "הפרעות התנהגותיות ורגשיות",
  "מוגבלות על רצף האוטיזם",
  "הפרעות נפשיות",
  "לקות למידה רב-בעייתית",
  "AD(H)D",
  "מוגבלות פיזית",
  "מוגבלות בשמיעה",
  "מוגבלות בראייה",
  "עיכוב התפתחותי בתחום התפקודי",
  "עיכוב התפתחותי בתחום השפה",
  "מחלות ותסמונות נדירות",
] as const;
export type DisabilityCategory = (typeof DISABILITY_CATEGORIES)[number];

export const DIAGNOSING_BODIES = [
  "פסיכולוג חינוכי",
  "פסיכולוג התפתחותי",
  "פסיכולוג קליני",
  "פסיכולוג מומחה",
  "פסיכולוג מומחה שהוכשר בלקויות למידה",
  "פסיכולוג בעל הכשרה מוכחת בתחום האוטיזם",
  "מאבחן דידקטי",
  "רופא מומחה בפסיכיאטריה של ילדים ונוער",
  "רופא מומחה בנוירולוגיה של הילד ובהתפתחות הילד",
  "רופא ילדים בעל ניסיון של שלוש שנים לפחות במכון מוכר להתפתחות הילד",
  "ועדת אבחון לפי חוק הסעד",
  "קלינאי תקשורת שהוסמך לאודיולוגיה",
  "קלינאי תקשורת במכון להתפתחות הילד",
  "קלינאי תקשורת",
  "מרפא בעיסוק",
  "מכון לראייה ירודה או רופא עיניים",
] as const;
export type DiagnosingBody = (typeof DIAGNOSING_BODIES)[number];

type Acceptable = {
  /** Any one of these signs an acceptable diagnosis on its own. */
  bodies: DiagnosingBody[];
  /** Each inner list must be present together (one document or several). */
  combos?: DiagnosingBody[][];
  note?: string;
};

/** Verbatim from the First Schedule [A]. Do not "improve" the wording; it is what the committee reads. */
export const ACCEPTABLE_BY_CATEGORY: Record<DisabilityCategory, Acceptable> = {
  "משכל גבולי": { bodies: ["פסיכולוג חינוכי", "פסיכולוג התפתחותי", "פסיכולוג קליני"] },
  "מוגבלות שכלית התפתחותית": {
    bodies: ["ועדת אבחון לפי חוק הסעד"],
    note: "ועדת האבחון לפי חוק הסעד (טיפול באנשים עם מוגבלות שכלית-התפתחותית) התשכ\"ט-1969, ובמידת הצורך גורם מקצועי נוסף שאבחנתו קבילה בהלימה למוגבלות או למוגבלויות נוספות.",
  },
  "חשד למוגבלות שכלית התפתחותית": { bodies: ["פסיכולוג חינוכי", "פסיכולוג התפתחותי", "פסיכולוג קליני"] },
  "הפרעות התנהגותיות ורגשיות": {
    bodies: ["פסיכולוג חינוכי", "פסיכולוג התפתחותי", "פסיכולוג קליני", "רופא מומחה בפסיכיאטריה של ילדים ונוער"],
  },
  "מוגבלות על רצף האוטיזם": {
    bodies: [
      "רופא מומחה בפסיכיאטריה של ילדים ונוער",
      "רופא ילדים בעל ניסיון של שלוש שנים לפחות במכון מוכר להתפתחות הילד",
      "רופא מומחה בנוירולוגיה של הילד ובהתפתחות הילד",
    ],
    note: "באבחון הראשון נדרש בנוסף אבחון של פסיכולוג קליני מומחה בתחום הקליני של הילד, פסיכולוג התפתחותי, או פסיכולוג שיקומי או חינוכי בעל הכשרה מוכחת בתחום האוטיזם.",
  },
  "הפרעות נפשיות": { bodies: ["רופא מומחה בפסיכיאטריה של ילדים ונוער"] },
  "לקות למידה רב-בעייתית": {
    bodies: ["פסיכולוג חינוכי", "פסיכולוג מומחה שהוכשר בלקויות למידה"],
    combos: [["פסיכולוג מומחה", "מאבחן דידקטי"]],
    note: "פסיכולוג מומחה ומאבחן דידקטי - בין במסמך אחד ובין במסמכים נפרדים.",
  },
  "AD(H)D": {
    bodies: [
      "פסיכולוג מומחה",
      "רופא מומחה בנוירולוגיה של הילד ובהתפתחות הילד",
      "רופא מומחה בפסיכיאטריה של ילדים ונוער",
      "רופא ילדים בעל ניסיון של שלוש שנים לפחות במכון מוכר להתפתחות הילד",
    ],
  },
  "מוגבלות פיזית": {
    bodies: ["רופא ילדים בעל ניסיון של שלוש שנים לפחות במכון מוכר להתפתחות הילד", "רופא מומחה בנוירולוגיה של הילד ובהתפתחות הילד"],
  },
  "מוגבלות בשמיעה": {
    bodies: ["קלינאי תקשורת שהוסמך לאודיולוגיה"],
    note: "\"אודיולוגיה\" לעניין זה - עריכת בדיקות שמיעה והתאמת מכשירי שמיעה.",
  },
  "מוגבלות בראייה": { bodies: ["מכון לראייה ירודה או רופא עיניים"] },
  "עיכוב התפתחותי בתחום התפקודי": {
    bodies: ["רופא מומחה בנוירולוגיה של הילד ובהתפתחות הילד"],
    combos: [
      ["פסיכולוג חינוכי", "קלינאי תקשורת"],
      ["פסיכולוג חינוכי", "מרפא בעיסוק"],
      ["פסיכולוג התפתחותי", "קלינאי תקשורת"],
      ["פסיכולוג התפתחותי", "מרפא בעיסוק"],
    ],
  },
  "עיכוב התפתחותי בתחום השפה": { bodies: ["קלינאי תקשורת במכון להתפתחות הילד"] },
  "מחלות ותסמונות נדירות": {
    bodies: ["רופא ילדים בעל ניסיון של שלוש שנים לפחות במכון מוכר להתפתחות הילד", "רופא מומחה בנוירולוגיה של הילד ובהתפתחות הילד"],
  },
};

/**
 * Who signs each questionnaire-vocabulary document, as far as the word itself
 * tells us. A psycho-didactic assessment is by definition a psychologist plus a
 * didactic assessor; "הערכה פסיכולוגית" tells us only that a psychologist
 * signed it, not which specialty - and the Schedule cares about the specialty.
 * The wildcards exist for exactly that gap, and the gate reports it as
 * "verify_signer" rather than guessing either way.
 */
type ImpliedSigner = DiagnosingBody | "any-psychologist" | "any-physician";

const IMPLIED_SIGNERS: Record<DiagnosisKind, ImpliedSigner[]> = {
  // A psycho-didactic assessment always carries a didactic assessor; whether
  // the psychologist half was a specialist is exactly what the word does not say.
  "פסיכו-דידקטי": ["any-psychologist", "מאבחן דידקטי"],
  "פסיכו-דיאגנוסטי": ["any-psychologist"],
  "נוירו-פסיכולוגי": ["any-psychologist"],
  "הערכה פסיכולוגית": ["any-psychologist"],
  "אבחון קשיי תקשורת ASD": ["any-physician"],
  "אבחון תעסוקתי": [],
  "הערכת בשלות לגן": [],
  "נוירולוג קשב": ["רופא מומחה בנוירולוגיה של הילד ובהתפתחות הילד"],
  "פסיכיאטר ילדים": ["רופא מומחה בפסיכיאטריה של ילדים ונוער"],
  "פסיכולוג חינוכי": ["פסיכולוג חינוכי", "פסיכולוג התפתחותי"],
  "פסיכולוג קליני": ["פסיכולוג קליני"],
};

/** Assessment kinds that can serve a request for exam accommodations [D] §8. */
const HATAMOT_ASSESSMENT_KINDS: DiagnosisKind[] = ["פסיכו-דידקטי", "פסיכו-דיאגנוסטי", "נוירו-פסיכולוגי"];

const isPsychologist = (b: DiagnosingBody) => b.startsWith("פסיכולוג");
const isPhysician = (b: DiagnosingBody) => b.startsWith("רופא");

export interface Diagnosis {
  kind: DiagnosisKind;
  /** Calendar year the document was signed. The year is what a counsellor reliably knows. */
  year: number;
  /** When the counsellor can read the signature, the gate becomes exact. */
  signedBy?: DiagnosingBody;
}

export type GateResult = "acceptable" | "verify_signer" | "not_acceptable";

/** Would this document be accepted by ועדת זכאות ואפיון as the diagnosis of `category`? */
export function diagnosisGate(d: Diagnosis, category: DisabilityCategory): GateResult {
  const rule = ACCEPTABLE_BY_CATEGORY[category];
  const implied = IMPLIED_SIGNERS[d.kind];
  const isWildcard = (s: ImpliedSigner) => s === "any-psychologist" || s === "any-physician";
  // A named signer fills the wildcard the document kind left open; the parts the
  // kind guarantees (a didactic assessor inside a psycho-didactic report) stay.
  // For a kind with no wildcard the counsellor's word replaces the assumption.
  const signedBy = d.signedBy;
  const signers: ImpliedSigner[] = !signedBy
    ? implied
    : implied.some(isWildcard)
      ? implied.map(s => (isWildcard(s) ? signedBy : s))
      : [signedBy];
  const exact = signers.filter((s): s is DiagnosingBody => s !== "any-psychologist" && s !== "any-physician");

  if (exact.some(s => rule.bodies.includes(s))) return "acceptable";
  if (rule.combos?.some(combo => combo.every(b => exact.includes(b)))) return "acceptable";

  const wantsPsychologist = rule.bodies.some(isPsychologist) || rule.combos?.some(c => c.some(isPsychologist));
  const wantsPhysician = rule.bodies.some(isPhysician);
  if (signers.includes("any-psychologist") && wantsPsychologist) return "verify_signer";
  if (signers.includes("any-physician") && wantsPhysician) return "verify_signer";
  return "not_acceptable";
}

/** The best gate result per category across everything the student has. */
export function eligibilityByCategory(diagnoses: Diagnosis[]): Record<DisabilityCategory, GateResult> {
  const rank: Record<GateResult, number> = { acceptable: 2, verify_signer: 1, not_acceptable: 0 };
  const out = {} as Record<DisabilityCategory, GateResult>;
  for (const c of DISABILITY_CATEGORIES) {
    out[c] = diagnoses.reduce<GateResult>((best, d) => {
      const r = diagnosisGate(d, c);
      return rank[r] > rank[best] ? r : best;
    }, "not_acceptable");
  }
  return out;
}

// ── Dates ────────────────────────────────────────────────────────────────────
// ISO "YYYY-MM-DD" strings throughout. They compare lexicographically, they
// carry no timezone, and they survive JSON - which is what a draft needs.

const DAY_MS = 86_400_000;
function toUtc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
export function isoAddDays(iso: string, days: number): string {
  return new Date(toUtc(iso) + days * DAY_MS).toISOString().slice(0, 10);
}
export function isoDiffDays(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}
/** 2027-03-31 -> 31.3.2027, the way an Israeli reads a date. */
export function formatDateHe(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(d)}.${Number(m)}.${y}`;
}

/** Today's civil date in Israel, regardless of the server's clock zone. */
export function israelToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

/** 5787 -> תשפ"ז. Thousands are dropped, as in everyday use; ASCII quote, as people type it. */
export function hebrewYearLabel(year: number): string {
  let n = year % 1000;
  const letters: string[] = [];
  for (const [v, l] of [[400, "ת"], [300, "ש"], [200, "ר"], [100, "ק"]] as const) {
    while (n >= v) { letters.push(l); n -= v; }
  }
  const tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
  const units = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
  if (n === 15) letters.push("ט", "ו");
  else if (n === 16) letters.push("ט", "ז");
  else {
    if (Math.floor(n / 10)) letters.push(tens[Math.floor(n / 10)]);
    if (n % 10) letters.push(units[n % 10]);
  }
  if (letters.length === 1) return letters[0] + "'";
  return letters.slice(0, -1).join("") + '"' + letters[letters.length - 1];
}

export interface SchoolYear { start: number; hebrew: string; label: string }

/** The school year a date falls in. Starts 1 September; named for the Hebrew year most of it falls in. */
export function schoolYear(iso: string): SchoolYear {
  const [y, m] = iso.split("-").map(Number);
  const start = m >= 9 ? y : y - 1;
  const hebrew = hebrewYearLabel(start + 3761);
  return { start, hebrew, label: `${hebrew} (${start}/${String(start + 1).slice(2)})` };
}

export interface ZakautWindow {
  open: boolean;
  /** Referral deadline for placement in the following school year: 31 March, every year [B]. */
  deadline: string;
  daysLeft: number | null;
  /** School committees finish by 15 May [B]. (Kindergartens and children entering א: 31 May - out of this rubric's scope.) */
  committeesFinishBy: string;
  /** A follow-up discussion after an assessment the committee asked for: by 15 July [C]. */
  followUpAfterAssessmentBy: string;
  nextOpens: string;
  /** The school year the entitlement would apply to. */
  placementYear: string;
}

export function zakautWindow(todayIso: string): ZakautWindow {
  const sy = schoolYear(todayIso);
  const deadline = `${sy.start + 1}-03-31`;
  const open = todayIso <= deadline;
  return {
    open,
    deadline,
    daysLeft: open ? isoDiffDays(todayIso, deadline) : null,
    committeesFinishBy: `${sy.start + 1}-05-15`,
    followUpAfterAssessmentBy: `${sy.start + 1}-07-15`,
    nextOpens: `${sy.start + 1}-09-01`,
    placementYear: schoolYear(`${sy.start + 1}-09-01`).label,
  };
}

/**
 * Earliest date an assessment may have been conducted and still serve a
 * request for exam accommodations: 1 July at the end of grade ו [D] §8. The
 * rule is a floor date tied to the student's cohort, not a number of years.
 */
export function hatamotAssessmentFloor(grade: SchoolGrade, todayIso: string): string {
  const gi = SCHOOL_GRADES.indexOf(grade);
  return `${schoolYear(todayIso).start - gi + 6}-07-01`;
}

export type AssessmentCurrency = "valid" | "verify_month" | "too_early" | "not_for_hatamot";

/** Is this document usable for exam accommodations, given when it was signed? */
export function assessmentCurrency(d: Diagnosis, grade: SchoolGrade, todayIso: string): AssessmentCurrency {
  if (!HATAMOT_ASSESSMENT_KINDS.includes(d.kind)) return "not_for_hatamot";
  const floorYear = Number(hatamotAssessmentFloor(grade, todayIso).slice(0, 4));
  if (d.year < floorYear) return "too_early";
  if (d.year === floorYear) return "verify_month"; // only the year is known; the floor is 1 July
  return "valid";
}

/**
 * Submission rounds to the district accommodations committee, as published for
 * תשפ"ה [D] §2.4. The dates are set anew each year, so they are stamped with
 * their year and shown as last year's pattern - never computed forward. The
 * current year's circular is published on [E].
 */
export const HATAMOT_ROUNDS = {
  circularYear: 'תשפ"ה',
  rounds: [
    {
      label: "מועד הגשה ראשון",
      by: "2025-01-07",
      forWhom: "תלמידי כיתה י' הניגשים להיבחנות במועד קיץ של אותה שנה במקצועות החברה, המורשת והרוח, ותלמידים בתוכניות מיוחדות",
      note: "הפנייה כוללת את כל הבקשות במקצועות רבי המלל; מה שהוגש במועד זה לא ניתן להוסיף או לשנות במועד השני",
    },
    {
      label: "מועד הגשה שני",
      by: "2025-06-10",
      forWhom: "תלמידי כיתה י' הניגשים להיבחנות בשנת הלימודים הבאה, בכלל המקצועות",
      note: "הבקשה מוגשת במלואה לכל ההתאמות הנחוצות עד תום כיתה י\"ב; לא ניתן להגיש חלקי בקשות",
    },
  ],
} as const;

// ── Tracks ───────────────────────────────────────────────────────────────────

export type TrackKey =
  | "school_team"
  | "zakaut"
  | "zakaut_appeal"
  | "hatamot"
  | "hatamot_appeal"
  | "assessment"
  | "risk_protocol"
  | "attendance";

export type Relevance = "primary" | "consider" | "info";

export interface SchoolTrack {
  key: TrackKey;
  name: string;
  relevance: Relevance;
  /** The facts about this student that put the track here. Shown to the counsellor. */
  why: string[];
  deadline?: { date: string; label: string; note?: string };
  documents: string[];
  steps: string[];
  appeals: { against: string; window: string; to: string }[];
  cautions: string[];
  officialLinks: { label: string; href: string }[];
  /** Which source and date the facts on this card were verified against. */
  verified: string;
}

export interface SchoolTracksInput {
  grade: SchoolGrade;
  /** ISO date. Pass israelToday() at call sites. */
  today: string;
  diagnoses: Diagnosis[];
  schoolTeam?: { convened: boolean };
  zakaut?: {
    status: "none" | "in_process" | "decided";
    /** ISO date the parents received the decision - the appeal clock runs from here [C]. */
    decisionReceivedOn?: string;
  };
  hatamot?: {
    status: "none" | "school_level" | "district_submitted" | "district_decided";
    /** ISO date the district committee's answer was received - the appeal clock runs from here [D]. */
    districtAnswerReceivedOn?: string;
  };
  /** What the questionnaire's scoring recommended, in its own keys. Read by the clinical rules only. */
  findings?: { assessmentKeys: string[]; treatmentKeys: string[]; externalKeys: string[] };
  /** Raised by the questionnaire's own screens. Read by the clinical rules only. */
  risk?: { suicidality?: boolean; abuseIndication?: boolean; schoolRefusal?: boolean };
  /** From the counsellor's own module. Read by the clinical rules only. */
  interventionsTried?: number;
  economicConstraint?: boolean;
}

const LINKS = {
  zakautPortal: { label: "ועדת זכאות ואפיון - פורטל משרד החינוך", href: "https://pob.education.gov.il/students/main-special-education/entitlement-committee/" },
  admissible: { label: "גורמים שאבחנתם קבילה - תוספת ראשונה (משרד החינוך)", href: "http://meyda.education.gov.il/files/PortalBaaluyot/POB/admissible-functionary.pdf" },
  zakautKolzchut: { label: "כל-זכות - ועדת זכאות ואפיון", href: "https://www.kolzchut.org.il/he/%D7%95%D7%A2%D7%93%D7%AA_%D7%96%D7%9B%D7%90%D7%95%D7%AA_%D7%95%D7%90%D7%A4%D7%99%D7%95%D7%9F_%D7%9C%D7%A9%D7%99%D7%A8%D7%95%D7%AA%D7%99_%D7%97%D7%99%D7%A0%D7%95%D7%9A_%D7%9E%D7%99%D7%95%D7%97%D7%93%D7%99%D7%9D" },
  hatamotShefi: { label: "שפ\"ינט - נהלים להתאמות בדרכי היבחנות (חוזר השנה)", href: "https://shefi.education.gov.il/learning-disabilities/procedures-for-adjustments/" },
  hatamotCircular: { label: "חוזר נהלים להתאמות, תשפ\"ה (PDF)", href: "https://meyda.education.gov.il/files/shefi/liikoheylemida/Hatamot_2024/Hozer_Hatamot_2024-2025.pdf" },
} as const;

const ZAKAUT_DOCUMENTS = [
  "טופס ויתור סודיות (בהורים פרודים - חתימת שני ההורים)",
  "מסמכים קבילים על אבחנת המוגבלות, מגורם שאבחנתו קבילה לפי התוספת הראשונה",
  "בדיקות ראייה ושמיעה עדכניות",
  "שאלון הפניה לוועדת זכאות ואפיון ושאלון רמת תפקוד (המוסד החינוכי)",
  "שאלון להורים ושאלון לתלמיד (רשות)",
  "חוות דעת מקצועיות ומסמכים נוספים (רשות)",
];

const HATAMOT_DOCUMENTS = [
  "אישור הורים על ויתור סודיות והעברת מידע מבית הספר לוועדת ההתאמות המחוזית",
  "האבחון הרלוונטי: דידקטי, פסיכו-דידקטי, פסיכולוגי ודידקטי, או אבחנת קשב בצירוף אבחון דידקטי/פסיכו-דידקטי - בהתאם להתאמות המבוקשות",
  "גיליון ציונים, תעודות והערות מילוליות בתעודה - עדויות תומכות",
  "מבחנים מצורפים התואמים את רמת הידע הנדרשת במקצועות ההיבחנות ומשקפים את הקשיים שאותרו",
];

const CATEGORY_LIST = (r: Record<DisabilityCategory, GateResult>, want: GateResult) =>
  DISABILITY_CATEGORIES.filter(c => r[c] === want);

const REL_RANK: Record<Relevance, number> = { primary: 0, consider: 1, info: 2 };

/**
 * The mechanical map: everything here follows from dates, grades and documents,
 * never from a clinical reading of the child. Approved clinical rules are
 * applied on top by mapSchoolTracks.
 */
export function mechanicalTracks(input: SchoolTracksInput): SchoolTrack[] {
  const { grade, today, diagnoses } = input;
  const tracks: SchoolTrack[] = [];
  const gi = SCHOOL_GRADES.indexOf(grade);
  const sy = schoolYear(today);

  // ── צוות רב-מקצועי: the first station, always ──
  const convened = input.schoolTeam?.convened === true;
  tracks.push({
    key: "school_team",
    name: "צוות רב-מקצועי בית-ספרי",
    relevance: convened ? "info" : "primary",
    why: convened
      ? ["הצוות הרב-מקצועי כבר התכנס - התחנה הראשונה מאחוריכם"]
      : ["התחנה הראשונה לכל תלמיד עם קושי: הצוות הרב-מקצועי של בית הספר, בהשתתפות התלמיד והוריו, דן בתמיכות שיקבל במסגרת החינוכית"],
    documents: ["סיכום התערבויות שנוסו בבית הספר ותוצאותיהן", "נספח 6.5 - סיכום דיון במסגרת החינוכית והסכמת הורים"],
    steps: [
      "לכנס את הצוות הרב-מקצועי עם ההורים ועם התלמיד/ה",
      "לתעד את התמיכות שהוחלט עליהן ואת מועד הבדיקה מחדש",
      "אם התמיכות בבית הספר אינן מספיקות - זו נקודת היציאה למסלול ועדת זכאות ואפיון",
    ],
    appeals: [],
    cautions: [],
    officialLinks: [LINKS.zakautPortal],
    verified: "פורטל משרד החינוך [B], 2.9.2026",
  });

  // ── ועדת זכאות ואפיון ──
  const eligibility = eligibilityByCategory(diagnoses);
  const acceptable = CATEGORY_LIST(eligibility, "acceptable");
  const verify = CATEGORY_LIST(eligibility, "verify_signer");
  const win = zakautWindow(today);
  const zStatus = input.zakaut?.status ?? "none";

  if (zStatus !== "decided") {
    const why: string[] = [];
    const cautions: string[] = [];
    let relevance: Relevance = "info";

    if (acceptable.length) {
      relevance = "consider";
      why.push(`בתיק מסמך מגורם שאבחנתו קבילה לצורך: ${acceptable.join(", ")} - בתנאי שהאבחנה עצמה כתובה בו`);
    } else if (verify.length) {
      relevance = "consider";
      why.push(`ייתכן שקיימת אבחנה קבילה עבור: ${verify.join(", ")} - תלוי בהתמחות החותם/ת על המסמך`);
      cautions.push("לבדוק מי חתום/ה על האבחון ולהשוות לתוספת הראשונה: התוספת קובעת התמחות, לא רק מקצוע");
    } else {
      why.push("הוועדה דנה בתלמידים עם מוגבלות מזכה שיש עליה אבחנה קבילה - ובתיק אין כרגע מסמך כזה. אבחון קודם, ועדה אחר כך");
    }
    if (zStatus === "in_process") why.push("ההליך כבר בעיצומו לפי הדיווח");

    const deadline = win.open
      ? { date: win.deadline, label: `הפניה עד ${formatDateHe(win.deadline)} לזכאות בשנת הלימודים ${win.placementYear}`, note: `נותרו ${win.daysLeft} ימים. זהו המועד הסטטוטורי; לרשות המקומית עשוי להיות מועד פנימי מוקדם יותר - לברר מול מחלקת החינוך` }
      : { date: win.nextOpens, label: `חלף מועד ההפניה (31.3) לשנת הלימודים ${win.placementYear}; החלון הבא נפתח ב-${formatDateHe(win.nextOpens)}`, note: "חריגים לאחר 31.3: שחרור מאשפוז, טראומה, עלייה חדשה - לברר מול הרשות" };

    tracks.push({
      key: "zakaut",
      name: "ועדת זכאות ואפיון",
      relevance,
      why,
      deadline,
      documents: ZAKAUT_DOCUMENTS,
      steps: [
        "לוודא שקיימת אבחנה קבילה של המוגבלות מגורם המופיע בתוספת הראשונה",
        "לאסוף את מסמכי ההפניה ולהגיש דרך המוסד החינוכי או הרשות (רשאים להפנות: הורה, מוסד חינוך מוכר, רשות החינוך המקומית, ארגון ציבורי)",
        `הוועדה מסיימת את דיוניה עד ${formatDateHe(win.committeesFinishBy)}; דיון המשך לאחר אבחון שביקשה - עד ${formatDateHe(win.followUpAfterAssessmentBy)}`,
        "ההורים בוחרים בין שלוש מסגרות: כיתה רגילה, כיתה רגילה עם שירותי חינוך מיוחדים, או מסגרת חינוך מיוחד",
      ],
      appeals: [{ against: "החלטת ועדת זכאות ואפיון", window: "21 יום מקבלת ההודעה על ההחלטה", to: "ועדת השגה; לאחריה - עתירה מנהלית" }],
      cautions,
      officialLinks: [LINKS.zakautPortal, LINKS.admissible, LINKS.zakautKolzchut],
      verified: "פורטל משרד החינוך [B] ותוספת ראשונה [A], כל-זכות [C], 2.9.2026",
    });
  }

  // ── השגה על החלטת ועדת זכאות ──
  if (zStatus === "decided" && input.zakaut?.decisionReceivedOn) {
    const received = input.zakaut.decisionReceivedOn;
    const until = isoAddDays(received, 21);
    const stillOpen = today <= until;
    tracks.push({
      key: "zakaut_appeal",
      name: "השגה על החלטת ועדת זכאות ואפיון",
      relevance: stillOpen ? "primary" : "info",
      why: stillOpen
        ? [`ההחלטה התקבלה ב-${formatDateHe(received)}; חלון ההשגה פתוח עוד ${isoDiffDays(today, until)} ימים`]
        : [`ההחלטה התקבלה ב-${formatDateHe(received)} וחלון ההשגה של 21 יום נסגר ב-${formatDateHe(until)}`],
      deadline: stillOpen
        ? { date: until, label: `הגשת השגה עד ${formatDateHe(until)}` }
        : { date: until, label: "מועד ההשגה חלף", note: "הדרך שנותרה היא עתירה מנהלית - נדרש ייעוץ משפטי" },
      documents: ["נימוקי ההשגה", "מסמכים חדשים שלא היו בפני הוועדה, אם יש"],
      steps: [
        "ועדת ההשגה מזמינה את ההורים ואת התלמיד ומאפשרת להם או לנציג מטעמם להשמיע את דבריהם",
        "ועדת ההשגה מחליטה תוך 21 יום מהגשת ההשגה: קבלה, דחייה, או החזרה לדיון בוועדת הזכאות",
      ],
      appeals: [{ against: "החלטת ועדת ההשגה", window: "לפי דין - ייעוץ משפטי", to: "עתירה מנהלית לבית המשפט לעניינים מנהליים" }],
      cautions: [],
      officialLinks: [LINKS.zakautKolzchut],
      verified: "כל-זכות [C], 2.9.2026",
    });
  }

  // ── ועדת התאמות בדרכי היבחנות ──
  const floor = hatamotAssessmentFloor(grade, today);
  const hStatus = input.hatamot?.status ?? "none";
  const currency = diagnoses.map(d => ({ d, c: assessmentCurrency(d, grade, today) }));
  const usable = currency.filter(x => x.c === "valid");
  const stale = currency.filter(x => x.c === "too_early");
  const unsure = currency.filter(x => x.c === "verify_month");

  if (hStatus !== "district_decided") {
    const why: string[] = [];
    const cautions: string[] = [];
    let relevance: Relevance = "info";

    if (gi <= 5) {
      why.push(`רלוונטי מחטיבת הביניים. אבחון שיוגש לוועדה המחוזית חייב להיערך מ-${formatDateHe(floor)} ואילך (1 ביולי בסיום כיתה ו') - אבחון מוקדם יותר לא ישמש להתאמות`);
    } else {
      if (grade === "י") {
        relevance = "consider";
        why.push("כיתה י' היא שנת ההגשה לוועדת ההתאמות המחוזית לקראת הבגרויות");
      } else if (gi > 9) {
        relevance = "consider";
        why.push("ההגשה המרכזית נעשית בכיתה י'; בקשה מאוחרת יותר - לברר את המסלול מול רכז/ת ההתאמות והמחוז");
      } else {
        why.push("השנים ז'-ט' הן הזמן להסדיר אבחון תקף ולבסס התערבות לפני ההגשה בכיתה י'");
      }
      if (usable.length) why.push(`בתיק אבחון שיכול לשמש להתאמות: ${usable.map(x => x.d.kind).join(", ")}`);
      if (stale.length) cautions.push(`אבחון משנת ${stale.map(x => x.d.year).join(", ")} קדם ל-${formatDateHe(floor)} ולכן לא ישמש לוועדה המחוזית - נדרש אבחון עדכני`);
      if (unsure.length) cautions.push(`אבחון משנת ${unsure.map(x => x.d.year).join(", ")}: לבדוק אם נערך אחרי 1 ביולי של אותה שנה`);
      // A stale assessment is explained by its caution; saying "none of that kind" on top of it would be false.
      if (!usable.length && !unsure.length && !stale.length) why.push("אין בתיק אבחון מהסוג שהוועדה המחוזית מקבלת (דידקטי, פסיכו-דידקטי, או פסיכולוגי ודידקטי)");
      cautions.push("אבחון ראשון שנערך סמוך להגשה: חייב להיות חתום לפחות שישה חודשים לפני ההגשה, ובתקופה זו מתקיימת התערבות לפי המלצותיו");
    }

    const roundsNote = sy.hebrew === HATAMOT_ROUNDS.circularYear
      ? `מועדי ההגשה לוועדה המחוזית לפי חוזר ${HATAMOT_ROUNDS.circularYear}`
      : `מועדי ההגשה נקבעים מדי שנה בחוזר. בחוזר ${HATAMOT_ROUNDS.circularYear} הם היו: ${HATAMOT_ROUNDS.rounds.map(r => `${r.label} עד ${formatDateHe(r.by)}`).join("; ")}. חוזר ${sy.hebrew} מתפרסם בשפ"ינט`;

    tracks.push({
      key: "hatamot",
      name: "התאמות בדרכי היבחנות (בגרויות)",
      relevance,
      why,
      documents: HATAMOT_DOCUMENTS,
      steps: [
        "התאמות שבסמכות בית הספר נדונות ומאושרות בוועדה הבית-ספרית, עם אבחון או בלעדיו",
        "התאמות שאינן בסמכות בית הספר מוגשות לוועדת ההתאמות המחוזית, בשני מועדי הגשה שנתיים",
        roundsNote,
        "התאמות החורגות מסמכות שתי הוועדות - ועדת חריגים של אגף הבחינות",
      ],
      appeals: [
        { against: "החלטת הוועדה הבית-ספרית", window: "לפי נוהל בית הספר (פרק 6.1 בחוזר)", to: "ערעור בית-ספרי" },
        { against: "החלטת ועדת ההתאמות המחוזית", window: "14 יום מקבלת התשובה במועד הראשון; 21 יום כשההגשה והיבחנות באותו מועד", to: "ועדת ערעורים עליונה" },
      ],
      cautions,
      officialLinks: [LINKS.hatamotShefi, LINKS.hatamotCircular],
      verified: 'חוזר התאמות תשפ"ה [D], 2.9.2026',
    });
  }

  // ── ערעור על החלטת הוועדה המחוזית ──
  if (hStatus === "district_decided" && input.hatamot?.districtAnswerReceivedOn) {
    const received = input.hatamot.districtAnswerReceivedOn;
    const until14 = isoAddDays(received, 14);
    const until21 = isoAddDays(received, 21);
    const stillOpen = today <= until21;
    tracks.push({
      key: "hatamot_appeal",
      name: "ערעור לוועדת ערעורים עליונה",
      relevance: stillOpen ? "primary" : "info",
      why: stillOpen
        ? [`תשובת הוועדה המחוזית התקבלה ב-${formatDateHe(received)}; חלון הערעור הוא 14 או 21 יום לפי מועד ההגשה`]
        : [`תשובת הוועדה המחוזית התקבלה ב-${formatDateHe(received)} וחלון הערעור נסגר`],
      deadline: stillOpen
        ? { date: until14, label: `ערעור עד ${formatDateHe(until14)} (14 יום) או עד ${formatDateHe(until21)} (21 יום) - לפי מועד ההגשה`, note: "לנהוג לפי המועד המוקדם אלא אם ידוע בוודאות שחל חלון 21 הימים" }
        : { date: until21, label: "מועד הערעור חלף" },
      documents: ["נימוקי הערעור והמסמכים התומכים"],
      steps: ["הגשה לוועדת ערעורים עליונה לפי פרק 6 בחוזר"],
      appeals: [],
      cautions: [],
      officialLinks: [LINKS.hatamotShefi],
      verified: 'חוזר התאמות תשפ"ה [D] §2.4, 2.9.2026',
    });
  }

  // ── אבחון: the prerequisite both committees share ──
  const needsForZakaut = zStatus !== "decided" && !acceptable.length;
  const needsForHatamot = gi >= 6 && hStatus !== "district_decided" && !usable.length;
  if (needsForZakaut || needsForHatamot || stale.length) {
    const why: string[] = [];
    if (needsForZakaut) why.push("ועדת זכאות ואפיון דורשת אבחנה קבילה של המוגבלות מגורם המופיע בתוספת הראשונה");
    if (needsForHatamot) why.push("ועדת ההתאמות המחוזית דורשת אבחון דידקטי או פסיכו-דידקטי (או פסיכולוגי ודידקטי) שנערך מ-1 ביולי בסיום כיתה ו' ואילך");
    if (stale.length) why.push("האבחון הקיים קדם לתאריך הרצפה ואינו משמש להתאמות");
    tracks.push({
      key: "assessment",
      name: "אבחון קביל",
      relevance: zStatus === "in_process" || stale.length ? "consider" : "info",
      why,
      documents: ["הפניה מבית הספר עם תיאור הקשיים וההתערבויות שנוסו", "ויתור סודיות להעברת האבחון לוועדה"],
      steps: [
        "לבחור את סוג האבחון לפי הצורך: ועדת זכאות - לפי המוגבלות המשוערת והגורם הקביל לה; התאמות - דידקטי או פסיכו-דידקטי",
        "לוודא מראש שהחותם/ת על האבחון עומד/ת בדרישת התוספת הראשונה - לא כל פסיכולוג וכל רופא",
        "לתעד את מועד הפנייה: אבחון ראשון סמוך להגשה להתאמות חייב להיות חתום שישה חודשים לפני ההגשה",
      ],
      appeals: [],
      cautions: [],
      officialLinks: [LINKS.admissible, LINKS.hatamotShefi],
      verified: "תוספת ראשונה [A] וחוזר התאמות [D], 2.9.2026",
    });
  }

  return tracks.sort((a, b) => REL_RANK[a.relevance] - REL_RANK[b.relevance]);
}
