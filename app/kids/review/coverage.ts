/**
 * What a reviewer has had in front of them, and what is still unseen.
 *
 * "Seen" here means shown on screen - a screen opened, a committee card
 * rendered, a kind of referral that appeared in a report. It is not a claim
 * that anything was read; it is the list that lets a reviewer say "I have not
 * yet looked at the kindergarten's extra-year card" instead of guessing.
 *
 * The universe is written out below rather than computed, because computing it
 * needs the scoring engine, which lives on the server. cases.test.ts scores the
 * whole bank with the real engine and holds these lists against the result in
 * both directions: nothing listed here that no case can show, and nothing a
 * case shows that is missing from here.
 *
 * Pure. No React, no storage, no network.
 */

import { parseKidsBoxes } from "@/app/lib/kids-recommendations";
import { toTracksInput, isSchoolGrade, isGanGrade, SCHOOL_TIPS, type CounselorFields } from "@/app/lib/school-report";
import { toGanTracksInput, GAN_TIPS } from "@/app/lib/gan-report";
import { mapSchoolTracks } from "@/app/lib/school-tracks-engine";
import { ganTracks } from "@/app/lib/gan-tracks";
import type { SchoolTrack } from "@/app/lib/school-tracks";
import { PAGES, acadGg, gg, type Ans, type KidsScoreResult, type PageId } from "../quiz-logic";

export const DOMAIN_KEYS = ["emotional", "academic", "developmental", "behavioral", "social"] as const;

// ── Screens ──────────────────────────────────────────────────────────────────

/** The screen names a reviewer reads in the menu. */
export const PAGE_NAMES: Record<PageId, string> = {
  "p-consent": "פתיחה והצהרה",
  "p-demo": "פרטי התלמיד/ה",
  "p-areas": "תחומי הקושי",
  "p-emo-intro": "לפני התחום הרגשי",
  "p-q1": "1. דאגות ולחצים",
  "p-q1-pain": "כאבים כרוניים",
  "p-aq": "שאלון חרדה",
  "p-q2": "2. דימוי עצמי",
  "p-q3": "3. מצב רוח",
  "p-mq": "שאלון מצב רוח",
  "p-mq-sui": "מחשבות אובדניות",
  "p-q4": "4. התמכרויות",
  "p-q4-types": "סוגי ההתמכרות",
  "p-q4-s": "שאלון חומרים",
  "p-q4-g": "שאלון משחקי מחשב",
  "p-q4-b": "שאלון הימורים",
  "p-q4-ctrl": "שליטה בהתנהגות",
  "p-q5": "5. מחשבות וטקסים חוזרים",
  "p-oq": "שאלון מחשבות וטקסים",
  "p-q6": "6. אירוע טראומטי",
  "p-tq": "שאלון טראומה",
  "p-q7": "7. חוויות פנימיות חריגות",
  "p-pq": "שאלון חוויות חריגות",
  "p-q8": "8. דפוסי אכילה",
  "p-eq": "שאלון אכילה",
  "p-q9": "9. ויסות ויחסים",
  "p-bq": "שאלון ויסות רגשות",
  "p-q9-adhd": "שאלון קשב",
  "p-q10": "10. קשיים רגשיים אחרים",
  "p-q10-par": "קשר עם אחד ההורים",
  "p-acad": "התחום הלימודי",
  "p-dev-toilet": "גמילה והתרוקנות",
  "p-dev-sensory": "ויסות חושי",
  "p-beh": "התחום ההתנהגותי",
  "p-soc": "התחום החברתי",
  "p-traits": "מאפייני התלמיד/ה",
  "p-refine": "מה כבר נעשה",
  "p-docs": "מה קיים בתיק",
  "p-result": "הדוח",
};

const VARIANT_NAMES: Record<string, string> = {
  school: "בית ספר", gan: "גן", toddler: "פעוטון",
  ag: "א'-ג'", dv: "ד'-ו'", zh: "ז'-ח'", tyb: "ט'-י\"ב",
  u12: "עד גיל 12", o12: "גיל 12 ומעלה",
  ga: "גן-א'", bv: "ב'-ו'", zy: "ז'-י\"ב",
};

const isToddler = (A: Ans) => A._grade === "פעוט";
const roleOf = (A: Ans): "school" | "gan" => (A.c_role === "gan" ? "gan" : "school");

/**
 * Which version of a screen these answers show, for the screens whose content
 * changes with the age or the role. "" for a screen that has one version.
 */
export function pageVariant(pid: PageId, A: Ans): string {
  switch (pid) {
    case "p-demo":
    case "p-emo-intro":
    case "p-docs":
    case "p-result":
      return roleOf(A);
    case "p-areas":
    case "p-refine":
      return roleOf(A) === "gan" && isToddler(A) ? "toddler" : roleOf(A);
    case "p-acad":
      return acadGg(A);
    case "p-eq":
      return (parseInt(A._age) || 0) < 12 ? "u12" : "o12";
    case "p-traits":
      return gg(A) || "zy";
    default:
      return "";
  }
}

export const pageKey = (pid: PageId, variant: string) => `page:${pid}${variant ? `|${variant}` : ""}`;

/** Every screen version the bank can show. */
export const PAGE_UNIVERSE: { pid: PageId; variants: string[] }[] = PAGES.map(pid => ({
  pid,
  variants:
    pid === "p-demo" || pid === "p-emo-intro" || pid === "p-docs" || pid === "p-result" ? ["school", "gan"]
    : pid === "p-areas" || pid === "p-refine" ? ["school", "gan", "toddler"]
    : pid === "p-acad" ? ["gan", "ag", "dv", "zh", "tyb"]
    : pid === "p-eq" ? ["u12", "o12"]
    : pid === "p-traits" ? ["ga", "bv", "zy"]
    : [""],
}));

// ── Committee tracks ─────────────────────────────────────────────────────────

/** Track cards by role, in the order a map shows them. */
export const TRACK_UNIVERSE: Record<"school" | "gan", { key: SchoolTrack["key"]; name: string }[]> = {
  school: [
    { key: "school_team", name: "צוות רב-מקצועי בית-ספרי" },
    { key: "exhaustion", name: "מיצוי אפשרויות לפני ועדה" },
    { key: "assessment", name: "אבחון קביל" },
    { key: "zakaut", name: "ועדת זכאות ואפיון" },
    { key: "zakaut_appeal", name: "השגה על החלטת ועדת זכאות" },
    { key: "hatamot", name: "התאמות בדרכי היבחנות" },
    { key: "hatamot_appeal", name: "ערעור לוועדת ערעורים עליונה" },
    { key: "attendance", name: "ביקור סדיר - קב\"ס" },
  ],
  gan: [
    { key: "gan_team", name: "צוות רב-מקצועי בגן (מתי\"א)" },
    { key: "dev_center", name: "הערכה במכון להתפתחות הילד" },
    { key: "assessment", name: "אבחנה קבילה - הכיוון הרגשי" },
    { key: "exhaustion", name: "מיצוי אפשרויות לפני ועדה" },
    { key: "zakaut", name: "ועדת זכאות ואפיון" },
    { key: "zakaut_appeal", name: "השגה על החלטת ועדת זכאות" },
    { key: "rehab_daycare", name: "מעון יום שיקומי" },
    { key: "extra_year", name: "השארה בגן חובה שנה נוספת" },
    { key: "first_grade", name: "מעבר לכיתה א'" },
    { key: "btl", name: "קצבת ילד נכה" },
  ],
};
export const trackKey = (role: "school" | "gan", key: string) => `track:${role}:${key}`;
export const tipKey = (role: "school" | "gan", key: string) => `tip:${role}:${key}`;
export const refKey = (key: string) => `ref:${key}`;
export const caseKey = (id: string) => `case:${id}`;
export const atlasKey = (section: string) => `atlas:${section}`;

/**
 * The kinds of referral the bank produces, by the key the questionnaire gives
 * each. Held against the engine by cases.test.ts: a scoring change that adds or
 * drops a referral for some case fails there until this list says the same.
 */
export const REFERRAL_UNIVERSE: { key: string; name: string }[] = [
  { key: "CBT", name: "טיפול CBT" },
  { key: "טיפול דינאמי", name: "טיפול דינאמי" },
  { key: "DBT", name: "טיפול DBT" },
  { key: "EMDR", name: "טיפול EMDR" },
  { key: "CPT", name: "טיפול CPT" },
  { key: "הדרכת הורים", name: "הדרכת הורים" },
  { key: "הדרכת הורים טיפולית", name: "הדרכת הורים טיפולית" },
  { key: "טיפול בהבעה ויצירה", name: "טיפול בהבעה ויצירה" },
  { key: "קבוצה חברתית", name: "קבוצה חברתית" },
  { key: "טיפול COG-FUN לקשיי קשב וריכוז", name: "טיפול COG-FUN" },
  { key: "ריפוי בעיסוק", name: "ריפוי בעיסוק" },
  { key: "קלינאות תקשורת", name: "קלינאית תקשורת" },
  { key: "פיזיותרפיה רצפת אגן", name: "פיזיותרפיה רצפת אגן" },
  { key: "טיפול בהפרעות אכילה", name: "טיפול בהפרעות אכילה" },
  { key: "פסיכו-דידקטי", name: "אבחון פסיכו-דידקטי" },
  { key: "דיאטנ/ית קליני/ת", name: "דיאטנ/ית קליני/ת" },
  { key: "נוירולוג קשב", name: "נוירולוג / רופא ילדים לקשב" },
  { key: "פסיכיאטר ילדים", name: "פסיכיאטר ילדים" },
  { key: "רופא משפחה", name: "רופא משפחה / ילדים" },
  { key: "פסיכולוג מסגרת", name: "פסיכולוג המסגרת" },
  { key: "תוכנית התנהגותית", name: "תוכנית התנהגותית במסגרת" },
  { key: "פנייה לתוכנית ההתנהגותית במסגרת", name: "CBT להתנהגות במקביל לתוכנית במסגרת" },
  { key: "נמצאו סימני קושי בתקשורת - מומלץ להיוועץ עם יועצת/פסיכולוג", name: "סימני קושי בתקשורת - היוועצות" },
  { key: "תוכנית חיזוקים", name: "תוכנית חיזוקים בית-ספרית" },
  { key: "הוראה מתקנת", name: "הוראה מתקנת" },
  { key: "יועצת בית ספר", name: "התייעצות עם יועצת בית הספר" },
];

/** The sections of the committees atlas. */
export const ATLAS_SECTIONS: { id: string; name: string }[] = [
  { id: "school-routes", name: "מתי נפתח כיוון לוועדה - בית ספר" },
  { id: "school-tracks", name: "כרטיסי המסלולים - בית ספר" },
  { id: "school-after-deadline", name: "אחרי 31.3 - בית ספר" },
  { id: "gan-routes", name: "מתי נפתח כיוון לוועדה - גן" },
  { id: "gan-tracks", name: "כרטיסי המסלולים - גן" },
  { id: "schedule", name: "גורמים שאבחנתם קבילה" },
  { id: "tips", name: "כלים והכוונה לצוות" },
  { id: "pending", name: "שאלות פתוחות להכרעה קלינית" },
];

// ── What a state shows ───────────────────────────────────────────────────────

export interface ShownFacts {
  role: "school" | "gan";
  tracks: SchoolTrack[];
  tipKeys: string[];
  referralKeys: string[];
}

/** The map, the tips and the referrals a scored report shows for these answers. */
export function shownOnReport(A: Ans, score: KidsScoreResult, today: string): ShownFacts {
  const role = roleOf(A);
  const input = toTracksInput(A, today);
  const ganInput = toGanTracksInput(A, today);
  const tracks = input ? mapSchoolTracks(input) : ganInput ? ganTracks(ganInput) : [];
  const tips = isGanGrade(A._grade) ? GAN_TIPS : isSchoolGrade(A._grade) ? SCHOOL_TIPS : [];
  const referralKeys = Array.from(new Set(
    DOMAIN_KEYS.flatMap(k => parseKidsBoxes(score[k], k).groups.map(g => g.treatmentKey)).filter(k => k !== "_no_action"),
  ));
  return { role, tracks, tipKeys: tips.filter(t => t.when(A as CounselorFields)).map(t => t.key), referralKeys };
}

/** The coverage keys a state puts in front of the reviewer. */
export function seenKeys(step: string, A: Ans, score: KidsScoreResult | null, today: string): string[] {
  const pid = step as PageId;
  if (!(PAGES as readonly string[]).includes(pid)) return [];
  const keys = [pageKey(pid, pageVariant(pid, A))];
  if (pid === "p-result" && score && A._audience === "counselor") {
    const shown = shownOnReport(A, score, today);
    keys.push(...shown.tracks.map(t => trackKey(shown.role, t.key)));
    keys.push(...shown.tipKeys.map(k => tipKey(shown.role, k)));
    keys.push(...shown.referralKeys.map(refKey));
  }
  return keys;
}

export interface CoverageGroup {
  id: string;
  name: string;
  items: { key: string; name: string; seen: boolean }[];
}

/** Everything there is to see, grouped, with what this reviewer has seen ticked. */
export function coverageGroups(seen: ReadonlySet<string>, cases: { id: string; title: string }[]): CoverageGroup[] {
  const item = (key: string, name: string) => ({ key, name, seen: seen.has(key) });
  return [
    { id: "cases", name: "מקרים", items: cases.map(c => item(caseKey(c.id), c.title)) },
    {
      id: "pages",
      name: "מסכים",
      items: PAGE_UNIVERSE.flatMap(p => p.variants.map(v => item(pageKey(p.pid, v), v ? `${PAGE_NAMES[p.pid]} - ${VARIANT_NAMES[v] ?? v}` : PAGE_NAMES[p.pid]))),
    },
    { id: "tracks-school", name: "מסלולים וועדות - בית ספר", items: TRACK_UNIVERSE.school.map(t => item(trackKey("school", t.key), t.name)) },
    { id: "tracks-gan", name: "מסלולים וועדות - גן", items: TRACK_UNIVERSE.gan.map(t => item(trackKey("gan", t.key), t.name)) },
    { id: "tips-school", name: "כלים לצוות - בית ספר", items: SCHOOL_TIPS.map(t => item(tipKey("school", t.key), t.title)) },
    { id: "tips-gan", name: "כלים לצוות - גן", items: GAN_TIPS.map(t => item(tipKey("gan", t.key), t.title)) },
    { id: "refs", name: "סוגי הפניה", items: REFERRAL_UNIVERSE.map(r => item(refKey(r.key), r.name)) },
    { id: "atlas", name: "אטלס הוועדות", items: ATLAS_SECTIONS.map(s => item(atlasKey(s.id), s.name)) },
  ];
}

export function coverageTotals(groups: CoverageGroup[]): { seen: number; total: number } {
  const all = groups.flatMap(g => g.items);
  return { seen: all.filter(i => i.seen).length, total: all.length };
}
