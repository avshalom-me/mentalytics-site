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
 * The rules. Two are approved and run; anything added here starts as a draft
 * and is listed, tested for shape, and ignored at runtime until it is read.
 *
 * Two proposals were removed on 10/9/2026 rather than approved. The suicidality
 * protocol went because the safety notice on the questionnaire's own screen
 * already does the work a map track would have done, and a second copy of it
 * with placeholder steps was worse than none. The "interventions first" rule
 * went because the attempts floor in school-report.ts replaced it outright: a
 * committee is not named at all until one treatment attempt and one system
 * intervention are recorded, which is stricter than demoting the track.
 */
export const CLINICAL_RULES: ClinicalRule[] = [
  {
    id: "attendance.school_refusal",
    status: "approved",
    reviewedOn: "2026-09-10",
    describe: "סרבנות בית ספר מוסיפה מסלול ביקור סדיר (קב\"ס) לטיפול עכשיו",
    when: input => input.risk?.schoolRefusal === true,
    apply: tracks => [
      ...tracks,
      {
        key: "attendance",
        name: "ביקור סדיר - קב\"ס",
        relevance: "primary",
        why: [
          "דווחה סרבנות בית ספר. חוק לימוד חובה מטיל על המוסד לדווח על היעדרות ממושכת, והטיפול עובר לקצין/ת ביקור סדיר ברשות המקומית",
        ],
        documents: ["תיעוד ההיעדרויות והאיחורים", "תיעוד הפעולות שננקטו מול התלמיד/ה ומול ההורים"],
        steps: [
          "לתעד את ההיעדרויות ואת מה שכבר נעשה מולן",
          "ליידע את ההורים ולזמן אותם לשיחה",
          "לפנות לקצין/ת ביקור סדיר (קב\"ס) ברשות המקומית - הנוהל המדויק נקבע ברשות",
          "לברר במקביל מה מחזיק את ההיעדרות: חרדה, הצקות, או קושי לימודי - הטיפול בסיבה קודם לאכיפה",
        ],
        appeals: [],
        cautions: [],
        officialLinks: [],
        verified: "חוק לימוד חובה, התש\"ט-1949; הנוהל המפורט נקבע ברשות המקומית",
      },
    ],
  },
  {
    id: "hatamot.learning_findings_promote",
    status: "approved",
    reviewedOn: "2026-09-10",
    describe: "ממצאי למידה או קשב מהשאלון בכיתות ח'-ט' מעלים את מסלול ההתאמות ל'לשיקול' כבר עכשיו, כדי שהאבחון ייערך בזמן",
    // ז' is out because the track itself does not exist before ח' - see
    // hatamotApplies. Reads input.findings, which toTracksInput fills from the
    // scoring once the questionnaire has been scored; before that it is absent
    // and the rule simply does not fire.
    when: input =>
      ["ח", "ט"].includes(input.grade) &&
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
  "מדיניות תחומים במילוי-לבד: אילו דומיינים יועצת יכולה למלא בלי הורה, ואילו מסומנים 'לא הוערך'",
  "נוסח תזכורת חובת הדיווח באינדיקציות לפגיעה",
  "מה מוצג ליועצת מתוך המלצות הטיפול של השאלון, ומה עובר להורים בלבד",
  "האם קושי בהבנה אכן שקול לתחום שני בפרופיל הלימודי, או שרק רמת הקריאה נחשבת (COMP_COUNTS ב-school-report.ts)",
];

/** Rules the engine will actually apply. */
export function approvedRules(rules: ClinicalRule[] = CLINICAL_RULES): ClinicalRule[] {
  return rules.filter(r => r.status === "approved");
}
