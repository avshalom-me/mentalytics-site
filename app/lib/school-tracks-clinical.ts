/**
 * הכללים הקליניים של מפת המסלולים - החלק שנכתב יחד, לא לבד.
 *
 * school-tracks.ts knows dates, grades and documents. It does not know whether
 * a child with these findings should be pushed toward a committee, told to
 * wait for the school team, or flagged for the psychologist today. Those are
 * clinical judgements, and this file is where they live so that they can be
 * read, argued with and approved one by one.
 *
 * The contract:
 *   - Every rule carries `status`. The engine applies "approved" rules only.
 *     A "draft" rule is a proposal: it is listed, tested for shape, and
 *     ignored at runtime. Nothing here reaches a counsellor by accident.
 *   - Approving a rule means setting status: "approved" and reviewedOn, in the
 *     same commit, after the wording was read by the clinician of record.
 *   - A rule may promote, demote, add or remove tracks. It may not invent a
 *     date or a document - those come from the sourced engine.
 *
 * PENDING_CLINICAL_DECISIONS below is the agenda for the joint session. It is
 * exported so the report can say, honestly, which parts of the map are not yet
 * clinically reviewed.
 */

import type { SchoolTrack, SchoolTracksInput, Relevance } from "./school-tracks";

export type RuleStatus = "draft" | "approved";

export interface ClinicalRule {
  id: string;
  status: RuleStatus;
  /** ISO date the clinician of record approved the wording. Required when approved. */
  reviewedOn?: string;
  /** What the rule does, in the language the report will use to explain itself. */
  describe: string;
  when: (input: SchoolTracksInput) => boolean;
  apply: (tracks: SchoolTrack[], input: SchoolTracksInput) => SchoolTrack[];
}

function setRelevance(tracks: SchoolTrack[], key: SchoolTrack["key"], relevance: Relevance, why?: string): SchoolTrack[] {
  return tracks.map(t => (t.key === key ? { ...t, relevance, why: why ? [why, ...t.why] : t.why } : t));
}

/**
 * Proposals. Each one is a question for the joint session, phrased as code so
 * that approving it is a one-word change and the tests already cover it.
 */
export const CLINICAL_RULES: ClinicalRule[] = [
  {
    id: "risk.suicidality",
    status: "draft",
    describe: "דיווח על מחשבות אובדניות מוסיף מסלול נוהל סיכון בעדיפות ראשונה - הניסוח ייכתב מול חוזר מנכ\"ל התנהגות אובדנית",
    when: input => input.risk?.suicidality === true,
    apply: tracks => [
      {
        key: "risk_protocol",
        name: "נוהל סיכון - התנהגות אובדנית",
        relevance: "primary",
        why: ["דווח על מחשבות אובדניות"],
        documents: [],
        steps: ["[טיוטה - הצעדים ייכתבו יחד מול חוזר המנכ\"ל: יידוע פסיכולוג/ית ביה\"ס והמנהל/ת, אי-השארת התלמיד/ה לבד, תיעוד]"],
        appeals: [],
        cautions: ["טיוטה שטרם אושרה קלינית"],
        officialLinks: [],
        verified: "טרם",
      },
      ...tracks,
    ],
  },
  {
    id: "attendance.school_refusal",
    status: "draft",
    describe: "סימני סרבנות בית ספר מוסיפים מסלול ביקור סדיר (קב\"ס) לשיקול",
    when: input => input.risk?.schoolRefusal === true,
    apply: tracks => [
      ...tracks,
      {
        key: "attendance",
        name: "ביקור סדיר - קב\"ס",
        relevance: "consider",
        why: ["דווחו סימנים של סרבנות בית ספר"],
        documents: ["תיעוד היעדרויות ואיחורים"],
        steps: ["[טיוטה - מתי מערבים קב\"ס ומה קודם לכך, ייקבע יחד]"],
        appeals: [],
        cautions: ["טיוטה שטרם אושרה קלינית"],
        officialLinks: [],
        verified: "טרם",
      },
    ],
  },
  {
    id: "zakaut.interventions_first",
    status: "draft",
    describe: "כשאף התערבות בית-ספרית לא נוסתה והצוות הרב-מקצועי לא התכנס, ועדת זכאות יורדת ל'מידע' גם אם קיימת אבחנה קבילה",
    when: input => (input.interventionsTried ?? 0) === 0 && input.schoolTeam?.convened !== true,
    apply: tracks => setRelevance(tracks, "zakaut", "info", "לפני ועדה: התערבות בבית הספר ודיון בצוות הרב-מקצועי - הוועדה מצפה לראות סיכום התערבויות"),
  },
  {
    id: "hatamot.learning_findings_promote",
    status: "draft",
    describe: "ממצאי למידה או קשב מהשאלון בכיתות ז'-ט' מעלים את מסלול ההתאמות ל'לשיקול' כבר עכשיו, כדי שהאבחון ייערך בזמן",
    when: input =>
      ["ז", "ח", "ט"].includes(input.grade) &&
      !!input.findings &&
      (input.findings.assessmentKeys.some(k => k === "פסיכו-דידקטי") ||
        input.findings.externalKeys.some(k => k === "נוירולוג קשב" || k === "הוראה מתקנת")),
    apply: tracks => setRelevance(tracks, "hatamot", "consider", "השאלון העלה ממצאי למידה או קשב - כדאי להסדיר אבחון תקף לפני כיתה י'"),
  },
];

/**
 * The agenda. Each line is a decision that changes what a counsellor is told,
 * and none of them is technical.
 */
export const PENDING_CLINICAL_DECISIONS: string[] = [
  "אילו ממצאים מהשאלון מצדיקים הפניה לוועדת זכאות ואפיון, ובאיזו עוצמה - ואילו נשארים בטיפול בית-ספרי",
  "מיפוי ממצאי השאלון למוגבלות המשוערת לפי התוספת הראשונה (הפרעות התנהגותיות ורגשיות, הפרעות נפשיות, לקות למידה, AD(H)D, ASD) - ולכן לאיזה אבחון קביל להפנות",
  "מה נחשב 'התערבות שנוסתה מספיק' לפני הסלמה לוועדה: כמה זמן, אילו סוגי התערבות",
  "מדיניות תחומים במילוי-לבד: אילו דומיינים יועצת יכולה למלא בלי הורה, ואילו מסומנים 'לא הוערך'",
  "נוסח נוהל הסיכון האובדני במצב בית-ספרי, מול חוזר מנכ\"ל התנהגות אובדנית",
  "נוסח תזכורת חובת הדיווח באינדיקציות לפגיעה",
  "מתי סרבנות בית ספר מערבת קב\"ס ומה קודם לכך",
  "האם מגבלה כלכלית משנה את סדר המסלולים (ציבורי לפני פרטי) ואיך זה מנוסח",
  "מה מוצג ליועצת מתוך המלצות הטיפול של השאלון, ומה עובר להורים בלבד",
];

/** Rules the engine will actually apply. */
export function approvedRules(rules: ClinicalRule[] = CLINICAL_RULES): ClinicalRule[] {
  return rules.filter(r => r.status === "approved");
}
