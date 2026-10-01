"use client";

/**
 * אטלס הוועדות - כל מה שהמפה יודעת לומר על בירוקרטיה, במקום אחד.
 *
 * A case shows a reviewer one child's map. That is the right way to read the
 * map in context and the wrong way to check it for completeness: a committee
 * card has a dozen wordings that depend on the state of the file, and nobody
 * should have to hunt for the child that produces each one. So the atlas lays
 * the whole thing flat - the rule that opens each route, every card with every
 * wording it takes and the condition that produces it, who may sign what, the
 * tips for the team, and the decisions the code itself lists as waiting for a
 * clinician.
 *
 * Everything here is produced by the real engines from explicit inputs
 * (mapSchoolTracks, ganTracks, diagnosisGate), so the atlas cannot describe a
 * card the map would not show. The one thing written by hand is the wording of
 * the route rules in RULES below - it is a description of eligibilityRoutes
 * and ganRoutes, to be kept true to them.
 *
 * Rendered by ReviewLayer only. Notes are taken on it exactly as on a screen:
 * the data-review-* attributes are the anchors.
 */

import { useEffect, useMemo, useRef } from "react";
import { TrackCard } from "../counselor";
import { mapSchoolTracks } from "@/app/lib/school-tracks-engine";
import { CLINICAL_RULES, PENDING_CLINICAL_DECISIONS } from "@/app/lib/school-tracks-clinical";
import {
  ACCEPTABLE_BY_CATEGORY, DIRECTION_CATEGORIES, DIRECTION_LABELS, diagnosisGate, formatDateHe, hatamotAssessmentFloor, schoolYear,
  type Diagnosis, type DiagnosisKind, type DisabilityCategory, type GateResult, type SchoolGrade, type SchoolTrack, type SchoolTracksInput,
} from "@/app/lib/school-tracks";
import {
  GAN_DIRECTION_CATEGORIES, GAN_DIRECTION_LABELS, GAN_GRADE_LABELS, ganTracks, type GanGrade, type GanTracksInput,
} from "@/app/lib/gan-tracks";
import {
  ACA_STEPS, DIAGNOSIS_KIND_LABELS, GAN_DIAGNOSIS_KINDS, INTERVENTIONS, RELEVANCE_LABELS, SCHOOL_DIAGNOSIS_KINDS, SCHOOL_TIPS,
  exhaustionMessage,
} from "@/app/lib/school-report";
import { GAN_INTERVENTIONS, GAN_PENDING_DECISIONS, GAN_TIPS, ganExhaustionMessage } from "@/app/lib/gan-report";
import { SURFACE_ATTR, UI_ATTR } from "./anchor";
import { daysAgo } from "./case-builder";
import { ATLAS_SECTIONS, TRACK_UNIVERSE } from "./coverage";

// ── The route rules, in words ────────────────────────────────────────────────
// A description of eligibilityRoutes (school-report.ts) and ganRoutes
// (gan-report.ts). Each line states what the code does, including what follows
// from the answer options a screen offers - a reviewer cannot read the code,
// and these are the decisions most worth a second pair of eyes.

interface Rule { id: string; title: string; lines: string[] }

const SCHOOL_RULES: Rule[] = [
  {
    id: "emotional",
    title: "כיוון רגשי/התנהגותי (לקות 55)",
    lines: [
      "עולה כשהשאלון הפיק הפניה כלשהי בתחום הרגשי: טיפול, אבחון או פנייה לאיש מקצוע.",
      "כולל גם הפניה לטיפול דינאמי שנובעת ממתח ברמה נמוכה, וגם ממצא קשב שעלה דרך שאלה 9 בכיתות ב'-ו', משום ששניהם רשומים בתחום הרגשי.",
      "ממצא התנהגותי או חברתי לבדו אינו פותח כיוון לוועדה. הוא מוביל לטיפול ולצוות הבית-ספרי בלבד.",
    ],
  },
  {
    id: "psychiatric",
    title: "כיוון נפשי (לקות 57)",
    lines: [
      "עולה כשהתחום הרגשי סומן 'מעט' ומעלה, ובנוסף אחד מאלה:",
      "דווחו מחשבות אובדניות;",
      "דווח על ראייה או שמיעה של דברים שאינם, או על אמונות וחשדות יוצאי דופן;",
      "ציון שאלון החרדה מעל 20 (מתוך 30);",
      "מצב רוח ירוד בדירוג 3 ומעלה יחד עם 4 פריטים ומעלה בשאלון מצב הרוח.",
    ],
  },
  {
    id: "learning",
    title: "כיוון לימודי/קשב (לקות 58)",
    lines: [
      "עולה רק כששני תנאים מתקיימים יחד: פרופיל לימודי, וסולם מיצוי שהושלם.",
      "פרופיל לימודי: קריאה ב-5% התחתונים של הכיתה; או מקצוע אחר ב-5% יחד עם תחום שני - קריאה ב-10%, או קושי בהבנה. בפועל המקצוע האחר הוא חשבון בכיתות א'-ו', כי רק הוא מדורג כך (ראו הכרטיס הבא).",
      "סולם המיצוי: הוראה מתקנת ותמיכה מסל השילוב סומנו 'נעשה', ואף אחת משלוש השורות הנוספות (קלינאי/ת תקשורת, ריפוי בעיסוק, בירור קשב אצל רופא/ה) לא סומנה 'טרם נעשה'.",
      "כשהפרופיל מתקיים והסולם לא הושלם, מופיע במקום הוועדה מסלול 'מיצוי אפשרויות לפני ועדה'.",
    ],
  },
  {
    id: "learning-by-grade",
    title: "מה פותח את הכיוון הלימודי בכל שכבת גיל",
    lines: [
      "א'-ג': קריאה וחשבון מדורגים באחוזונים (5%, 10%, 30%); כתב יד והבנה נשאלים בכן/לא. הכיוון נפתח בקריאה ב-5%, או בחשבון ב-5% יחד עם קריאה ב-10% או קושי בהבנה.",
      "ד'-ו': קריאה וכתב יד נשאלים בכן/לא, ורק חשבון מדורג באחוזונים. לכן הכיוון נפתח רק בחשבון ב-5% יחד עם קושי בהבנה. קושי בקריאה, חמור ככל שיהיה, אינו פותח אותו.",
      "ז'-י\"ב: רבי מלל מדורג 5%, 20% או מעל 20%; מתמטיקה ואנגלית מדורגות 10%, 20% או מעל 20%, בלי אפשרות של 5%. לכן הכיוון נפתח רק ברבי מלל ב-5%.",
    ],
  },
  {
    id: "floor",
    title: "רצפת המיצוי: מתי הוועדה מופיעה במפה",
    lines: [
      "גם כשכיוון עולה, המפה מציגה את ועדת הזכאות רק אחרי שנרשמו שני ניסיונות שלא הספיקו.",
      "ניסיון טיפולי אחד: טיפול רגשי בבית הספר, מעורבות שפ\"ח או פסיכולוג/ית בית הספר, או הפניה קודמת לגורם חוץ.",
      "התערבות מערכתית אחת: שיחות פרטניות, תוכנית התנהגותית או רגשית, תוכנית אישית, או תיווך ושיחות עם ההורים.",
      "התערבות שסומנה 'הועיל' אינה נספרת - מיצוי פירושו ניסיון שלא הספיק.",
      "בכיוון הלימודי, הוראה מתקנת ותמיכה מסל השילוב שסומנו 'נעשה' נחשבות לניסיון הטיפולי.",
      "כשחסר ניסיון, מופיע מסלול 'מיצוי אפשרויות לפני ועדה' במקום הוועדה.",
    ],
  },
  {
    id: "docs-screen",
    title: "מתי נשאלת היועצת מה קיים בתיק",
    lines: [
      "מסך 'מה קיים בתיק' - אבחונים, מצב ועדת הזכאות ומצב ההתאמות - מוצג רק כשכיוון לוועדת זכאות פתוח.",
      "בלי כיוון פתוח השאלון אינו שואל על אבחונים קיימים ואינו שואל על מצב ההתאמות, והמפה מתייחסת לתיק כאל ריק.",
    ],
  },
  {
    id: "hatamot",
    title: "התאמות בדרכי היבחנות",
    lines: [
      "המסלול מוזכר רק מכיתה ח' ומעלה.",
      "בכיתות ח'-ט' הוא עולה ל'לשיקול' כשהשאלון המליץ על אבחון פסיכו-דידקטי, על פנייה לנוירולוג/ית לקשב, או על הוראה מתקנת.",
      "בכיתה י' ומעלה הוא 'לשיקול', עד שמתקבלת תשובת הוועדה המחוזית - ואז מופיע במקומו מסלול הערעור.",
    ],
  },
  {
    id: "attendance",
    title: "ביקור סדיר",
    lines: [
      "סרבנות בית ספר מוסיפה מסלול קב\"ס 'לטיפול עכשיו'.",
      "היעדרויות תכופות מוסיפות אותו 'לשיקול', עם בדיקה של סף הדיווח ברשות.",
    ],
  },
  {
    id: "old-and-duration",
    title: "אבחון ישן ומשך הקושי",
    lines: [
      "אבחון שנערך לפני יותר מחמש שנים נחשב קביל לפי סוגו וחותמו, אבל מסומן לבדיקה מול המפקח/ת או פסיכולוג/ית המסגרת.",
      "קושי שדווח 'מהשנה' מוסיף אזהרה שהוועדה מצפה לרוב לקושי מתמשך של 2-3 שנים; 'מעל שנה' מוסיף את אותה ציפייה כמידע. משך הקושי אינו חוסם את המסלול.",
    ],
  },
];

const GAN_RULES: Rule[] = [
  {
    id: "gan-language",
    title: "עיכוב התפתחותי בתחום השפה",
    lines: [
      "עולה כשסומן 'כן' באחד משלושה פריטים בגן: זיהוי אותיות ומספרים, זכירת צורות וצבעים, או ביטוי עצמי ואוצר מילים.",
      "קושי בחריזה או בזיהוי צליל פותח לבדו אינו פותח את הכיוון.",
    ],
  },
  {
    id: "gan-functional",
    title: "עיכוב התפתחותי בתחום התפקודי",
    lines: [
      "עולה באחד מאלה: קושי באחיזת עיפרון או באיכות ציור; הפניה לריפוי בעיסוק שעלתה מהשאלון; שלושה פריטים לימודיים בגן ומעלה; או, אצל פעוט/ה, סימון 'הרבה' ומעלה בתחום ההתפתחותי.",
    ],
  },
  {
    id: "gan-autism",
    title: "מוגבלות על רצף האוטיזם",
    lines: [
      "עולה כשסומנו שלושת סימני התקשורת יחד עם לפחות אחד מארבעת הסימנים הנלווים: התנהגות חזרתית, היצמדות לשגרה, תחומי עניין מצומצמים, או תגובתיות חושית חריגה.",
      "עולה גם כשבתיק רשום אבחון תקשורת / ASD.",
    ],
  },
  {
    id: "gan-intellectual",
    title: "מוגבלות שכלית התפתחותית",
    lines: ["עולה רק מהתיק: החלטה של ועדת אבחון לפי חוק הסעד. השאלון אינו בודק אותה."],
  },
  {
    id: "gan-emotional",
    title: "הפרעות התנהגותיות ורגשיות (55) בגן",
    lines: [
      "עולה כשהשאלון הפיק הפניה בתחום הרגשי, ונשען על אותה רצפת מיצוי כמו בבית הספר.",
      "ניסיון טיפולי אחד: ייעוץ או תצפית של פסיכולוג/ית שפ\"ח, או טיפול רגשי, דיאדי או הדרכת הורים טיפולית.",
      "התערבות אחת בגן: תוכנית התערבות, תמיכה מסל השילוב, או שיחות והדרכה להורים.",
      "טיפול פרא-רפואי נרשם ומדווח, אבל אינו נספר כניסיון הטיפולי של הכיוון הרגשי.",
    ],
  },
  {
    id: "gan-no-floor",
    title: "הכיוונים ההתפתחותיים נפתחים בלי מיצוי",
    lines: [
      "שפה, תפקודי ורצף האוטיזם נפתחים על הממצא לבדו, בלי לדרוש שהגן ינסה התערבויות קודם.",
      "בגן מסך 'מה קיים בתיק' מוצג תמיד, גם בלי כיוון פתוח.",
      "ממצא התנהגותי או חברתי לבדו אינו פותח כיוון לוועדה, כמו בבית הספר.",
    ],
  },
];

/** When each tip is shown - the `when` of SCHOOL_TIPS and GAN_TIPS, in words. */
const TIP_CONDITIONS: Record<string, string> = {
  regulation: "קושי בוויסות סומן 'הרבה' ומעלה",
  isolation: "בידוד או דחייה חברתית סומנו 'הרבה' ומעלה",
  bully_victim: "נפגע/ת מהצקות: 'חשד'",
  bully_victim_known: "נפגע/ת מהצקות: 'ידוע'",
  bully_perp: "מעורבות כפוגע/ת: 'חשד'",
  bully_perp_known: "מעורבות כפוגע/ת: 'ידוע'",
  change: "שינוי חד בהתנהגות או במצב הרוח השנה: 'כן'",
  org: "קושי בהתארגנות סומן 'הרבה' ומעלה",
};

// ── Scenarios ────────────────────────────────────────────────────────────────

interface Scenario { label: string; tracks: SchoolTrack[] }

const doc = (kind: DiagnosisKind, year: number, signedBy?: Diagnosis["signedBy"]): Diagnosis => ({ kind, year, ...(signedBy ? { signedBy } : {}) });

function schoolScenarios(today: string): Scenario[] {
  const sy = schoolYear(today).start;
  const floorYear = (g: SchoolGrade) => Number(hatamotAssessmentFloor(g, today).slice(0, 4));
  const at = (grade: SchoolGrade, extra: Partial<SchoolTracksInput>): SchoolTracksInput => ({ grade, today, diagnoses: [], ...extra });
  const list: [string, SchoolTracksInput][] = [
    ["כיתה ה' · כיוון רגשי פתוח, אין מסמך בתיק, הצוות לא התכנס",
      at("ה", { directions: ["emotional"], schoolTeam: { convened: false }, zakaut: { status: "none" }, duration: "years" })],
    ["כיתה ה' · כיוון רגשי, חוות דעת של פסיכולוג/ית חינוכי/ת בתיק, הצוות התכנס, קושי מעל שנה",
      at("ה", { directions: ["emotional"], schoolTeam: { convened: true }, diagnoses: [doc("פסיכולוג חינוכי", sy)], zakaut: { status: "none" }, duration: "over_year" })],
    ["כיתה ה' · כיוון רגשי ונפשי, הערכה פסיכולוגית בלי פירוט החותם, ההליך בתהליך, קושי מהשנה",
      at("ה", { directions: ["emotional", "psychiatric"], diagnoses: [doc("הערכה פסיכולוגית", sy - 1)], zakaut: { status: "in_process" }, duration: "this_year" })],
    ["כיתה ה' · כיוון לימודי, אבחון פסיכו-דידקטי חתום בידי פסיכולוג/ית חינוכי/ת, בהתלבטות, שיפור חלקי בתמיכה",
      at("ה", { directions: ["learning"], schoolTeam: { convened: true }, diagnoses: [doc("פסיכו-דידקטי", sy - 1, "פסיכולוג חינוכי")], zakaut: { status: "considering" }, duration: "years", academicSupport: "partial" })],
    ["כיתה ה' · כיוון לימודי, אבחון מלפני יותר מחמש שנים, בהתלבטות, משתפר/ת בתמיכה",
      at("ה", { directions: ["learning"], diagnoses: [doc("פסיכו-דידקטי", sy - 7, "פסיכולוג חינוכי")], zakaut: { status: "considering" }, duration: "over_year", academicSupport: "improves" })],
    ["כיתה ה' · כיוון לימודי, אין מסמך, בהתלבטות, דווח שלא ניתנה תמיכה, קושי מהשנה, הצוות לא התכנס",
      at("ה", { directions: ["learning"], schoolTeam: { convened: false }, zakaut: { status: "considering" }, duration: "this_year", academicSupport: "not_given" })],
    ["כיתה ה' · ממצא רגשי שממתין למיצוי: חסרים ניסיון טיפולי והתערבות מערכתית",
      at("ה", { pendingDirections: ["emotional"], duration: "this_year", exhaustionNote: exhaustionMessage({ missing: ["treatment", "system"], helpedOnly: [], ladderPending: false }) })],
    ["כיתה ה' · כל מה שנוסה סומן 'הועיל'",
      at("ה", { pendingDirections: ["emotional"], exhaustionNote: exhaustionMessage({ missing: ["treatment", "system"], helpedOnly: ["treatment", "system"], ladderPending: false }) })],
    ["כיתה ה' · פרופיל לימודי שממתין להשלמת סולם המיצוי",
      at("ה", { pendingDirections: ["learning"], duration: "over_year", exhaustionNote: exhaustionMessage({ missing: [], helpedOnly: [], ladderPending: true }) })],
    ["כיתה ה' · החלטת ועדת זכאות התקבלה לפני שבוע",
      at("ה", { directions: ["emotional"], zakaut: { status: "decided", decisionReceivedOn: daysAgo(today, 7) } })],
    ["כיתה ה' · החלטת ועדת זכאות התקבלה לפני חודשיים",
      at("ה", { directions: ["emotional"], zakaut: { status: "decided", decisionReceivedOn: daysAgo(today, 60) } })],
    ["כיתה ח' · בלי כיוון לוועדה, התאמות לא נדונו",
      at("ח", { hatamot: { status: "none" } })],
    ["כיתה ט' · השאלון העלה ממצאי למידה, ובתיק אבחון שנערך בשנת הרצפה",
      at("ט", { hatamot: { status: "none" }, findings: { assessmentKeys: ["פסיכו-דידקטי"], treatmentKeys: [], externalKeys: [] }, diagnoses: [doc("פסיכו-דידקטי", floorYear("ט"))] })],
    ["כיתה י' · התאמות בהתלבטות, אין אבחון בתיק",
      at("י", { hatamot: { status: "considering" } })],
    ["כיתה י' · התאמות בהתלבטות, אבחון תקף בתיק",
      at("י", { hatamot: { status: "considering" }, diagnoses: [doc("פסיכו-דידקטי", sy - 1)] })],
    ["כיתה י' · אושרו התאמות בסמכות בית הספר, האבחון קדם לתאריך הרצפה",
      at("י", { hatamot: { status: "school_level" }, diagnoses: [doc("פסיכו-דידקטי", floorYear("י") - 2)] })],
    ["כיתה י\"א · הבקשה הוגשה לוועדה המחוזית",
      at("יא", { hatamot: { status: "district_submitted" } })],
    ["כיתה י\"א · תשובת הוועדה המחוזית התקבלה לפני חמישה ימים",
      at("יא", { hatamot: { status: "district_decided", districtAnswerReceivedOn: daysAgo(today, 5) } })],
    ["כיתה י\"ב · תשובת הוועדה המחוזית התקבלה לפני חודשיים",
      at("יב", { hatamot: { status: "district_decided", districtAnswerReceivedOn: daysAgo(today, 60) } })],
    ["כיתה ז' · סרבנות בית ספר",
      at("ז", { risk: { schoolRefusal: true } })],
    ["כיתה ז' · היעדרויות תכופות",
      at("ז", { risk: { frequentAbsence: true } })],
  ];
  return list.map(([label, input]) => ({ label, tracks: mapSchoolTracks(input) }));
}

/** The same committee card as the calendar moves: a month before the deadline, and past it. */
function deadlineScenarios(today: string): Scenario[] {
  const y = schoolYear(today).start + 1;
  const near = `${y}-03-20`;
  const late = `${y}-04-15`;
  const school = (label: string, t: string, status: "none" | "considering"): Scenario => ({
    label,
    tracks: mapSchoolTracks({ grade: "ה", today: t, diagnoses: [], directions: ["emotional"], zakaut: { status }, duration: "years" }).filter(x => x.key === "zakaut"),
  });
  const kg = (label: string, t: string, status: "none" | "considering"): Scenario => ({
    label,
    tracks: ganTracks({ grade: "גן-טרום", today: t, age: 4, diagnoses: [], directions: ["language"], setting: "regular", devCenter: "waiting", zakaut: { status } }).filter(x => x.key === "zakaut" || x.key === "dev_center"),
  });
  return [
    school(`בית ספר · בתאריך ${formatDateHe(near)}, פחות מחודש למועד, בהתלבטות`, near, "considering"),
    school(`בית ספר · בתאריך ${formatDateHe(late)}, אחרי המועד, לא הופנה`, late, "none"),
    school(`בית ספר · בתאריך ${formatDateHe(late)}, אחרי המועד, בהתלבטות`, late, "considering"),
    kg(`גן · בתאריך ${formatDateHe(near)}, פחות מחודש למועד, בהתלבטות`, near, "considering"),
    kg(`גן · בתאריך ${formatDateHe(late)}, אחרי המועד, לא הופנה`, late, "none"),
  ];
}

function ganScenarios(today: string): Scenario[] {
  const sy = schoolYear(today).start;
  const at = (grade: GanGrade, age: number, extra: Partial<GanTracksInput>): [string, GanTracksInput] =>
    [GAN_GRADE_LABELS[grade], { grade, today, age, diagnoses: [], ...extra }];
  const list: [string, [string, GanTracksInput]][] = [
    ["גן רגיל, בלי כיוון לוועדה, הצוות טרם דן",
      at("גן-טרום", 4, { setting: "regular", team: { convened: false } })],
    ["כיוון שפתי, לא פנו למכון להתפתחות הילד, הצוות טרם דן",
      at("גן3", 3, { directions: ["language"], setting: "regular", devCenter: "none", team: { convened: false }, zakaut: { status: "none" } })],
    ["כיוון תפקודי, ממתינים לתור במכון, תמיכה מסל השילוב, בהתלבטות",
      at("גן-טרום", 4, { directions: ["functional"], setting: "regular_support", devCenter: "waiting", team: { convened: true }, zakaut: { status: "considering" } })],
    ["רצף האוטיזם, ההערכה במכון הסתיימה, סיכום מכון בלי פירוט החותם, ההליך בתהליך",
      at("גן-טרום", 4, { directions: ["autism"], setting: "regular_support", devCenter: "done", team: { convened: true }, diagnoses: [doc("סיכום מכון התפתחות הילד", sy)], zakaut: { status: "in_process" } })],
    ["כיוון שפתי עם הערכת קלינאי/ת תקשורת במכון, ההערכה בתהליך",
      at("גן", 5, { directions: ["language"], setting: "regular", devCenter: "in_process", team: { convened: true }, diagnoses: [doc("קלינאית תקשורת - מכון התפתחות", sy)], zakaut: { status: "none" } })],
    ["כיוון רגשי אחרי מיצוי, אין מסמך בתיק",
      at("גן", 5, { directions: ["emotional"], setting: "regular", team: { convened: true }, zakaut: { status: "none" } })],
    ["כיוון רגשי שממתין למיצוי",
      at("גן-טרום", 4, { pendingDirections: ["emotional"], setting: "regular", team: { convened: false }, exhaustionNote: ganExhaustionMessage({ missing: ["treatment", "system"], helpedOnly: [] }) })],
    ["ילד/ה עם סל אישי מוועדה - מעבר לכיתה א'",
      at("גן", 6, { directions: ["functional"], setting: "personal_basket", devCenter: "done", team: { convened: true }, zakaut: { status: "none" } })],
    ["השארה שנה נוספת - בהתלבטות",
      at("גן", 5, { setting: "regular", team: { convened: true }, extraYear: "considering" })],
    ["השארה שנה נוספת - הוגשה בקשה",
      at("גן", 5, { setting: "regular", team: { convened: true }, extraYear: "requested" })],
    ["השארה שנה נוספת - התקבלה החלטה",
      at("גן", 5, { setting: "regular", team: { convened: true }, extraYear: "decided" })],
    ["גן חינוך מיוחד, החלטת ועדה התקבלה לפני שבוע",
      at("גן-טרום", 4, { directions: ["functional"], setting: "special_gan", zakaut: { status: "decided", decisionReceivedOn: daysAgo(today, 7) } })],
    ["במעון, עיכוב תפקודי, לא פנו למכון",
      at("פעוט", 2, { directions: ["functional"], setting: "daycare", devCenter: "none", rehabDaycare: "none", zakaut: { status: "none" } })],
    ["במעון, הוגשה בקשה למעון יום שיקומי, ההערכה במכון בתהליך",
      at("פעוט", 2, { directions: ["functional"], setting: "daycare", devCenter: "in_process", rehabDaycare: "applied" })],
    ["במעון יום שיקומי, מוגבלות שכלית התפתחותית בתיק, ההליך בתהליך",
      at("פעוט", 2, { directions: ["intellectual"], setting: "rehab_daycare", devCenter: "done", rehabDaycare: "attends", diagnoses: [doc("ועדת אבחון - חוק הסעד", sy)], zakaut: { status: "in_process" } })],
  ];
  return list.map(([label, [grade, input]]) => ({ label: `${grade} · ${label}`, tracks: ganTracks(input) }));
}

/** One wording of a card, and every state that produces exactly it. */
interface Wording { labels: string[]; t: SchoolTrack }

/** What makes two renderings of a card the same wording: everything on it that depends on the state. */
const wordingOf = (t: SchoolTrack) =>
  JSON.stringify([t.relevance, t.why, t.deadline?.label, t.deadline?.note, t.cautions, t.decision?.headline, t.decision?.items, t.decision?.decideBy, t.steps]);

/** The same card under many states is usually the same text; a reviewer should read each wording once. */
function distinct(hits: { label: string; t: SchoolTrack }[]): Wording[] {
  const out: Wording[] = [];
  for (const h of hits) {
    const same = out.find(w => wordingOf(w.t) === wordingOf(h.t));
    if (same) same.labels.push(h.label);
    else out.push({ labels: [h.label], t: h.t });
  }
  const rank = { primary: 0, consider: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.t.relevance] - rank[b.t.relevance]);
}

/** Per card: the state that shows it most fully, and every distinct wording it takes. */
function byTrack(scenarios: Scenario[], order: { key: SchoolTrack["key"]; name: string }[]) {
  return order
    .map(({ key, name }) => {
      const wordings = distinct(scenarios.flatMap(s => s.tracks.filter(t => t.key === key).map(t => ({ label: s.label, t }))));
      return { key, name, wordings, rep: wordings[0] };
    })
    .filter(x => x.rep);
}

// ── Pieces ───────────────────────────────────────────────────────────────────

const REL_TONE: Record<SchoolTrack["relevance"], { bg: string; fg: string }> = {
  primary: { bg: "var(--gold-pale)", fg: "var(--gold-dark)" },
  consider: { bg: "var(--teal-pale)", fg: "var(--teal-dark)" },
  info: { bg: "var(--surface-2)", fg: "var(--muted)" },
};

function SectionHead({ id, hint }: { id: string; hint: string }) {
  const s = ATLAS_SECTIONS.find(x => x.id === id)!;
  return (
    <div className="mb-4">
      <h2 className="text-2xl font-black" style={{ color: "var(--text)" }}>{s.name}</h2>
      <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{hint}</p>
    </div>
  );
}

function RuleCard({ rule }: { rule: Rule }) {
  return (
    <div data-review-id={`rule:${rule.id}`} data-review-label={`כלל: ${rule.title}`} className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--line)" }}>
      <h3 className="mb-2 text-base font-extrabold" style={{ color: "var(--text)" }}>{rule.title}</h3>
      <ul className="space-y-1.5 text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
        {rule.lines.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
    </div>
  );
}

/** One wording a card takes, with the states that produce it. */
function Variant({ labels, t, repSteps }: { labels: string[]; t: SchoolTrack; repSteps?: string[] }) {
  const tone = REL_TONE[t.relevance];
  const mark = (ok: boolean | null) => (ok === true ? "✓" : ok === false ? "✗" : "?");
  const ownSteps = repSteps && JSON.stringify(repSteps) !== JSON.stringify(t.steps) ? t.steps : null;
  return (
    <div data-review-scenario={labels[0]} data-review-id={`track:${t.key}`} data-review-label={`מסלול: ${t.name}`} className="rounded-xl border bg-white p-3" style={{ borderColor: "var(--line)" }}>
      <div className="mb-2">
        <span className="me-2 rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: tone.bg, color: tone.fg }}>{RELEVANCE_LABELS[t.relevance]}</span>
        <span className="text-xs font-bold" style={{ color: "var(--text)" }}>{labels[0]}</span>
        {labels.length > 1 && (
          <div className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
            אותו נוסח גם ב: {labels.slice(1, 4).join(" / ")}{labels.length > 4 ? ` ועוד ${labels.length - 4} מצבים` : ""}
          </div>
        )}
      </div>
      {t.decision && (
        <div data-review-part="decision" className="mb-2 rounded-lg p-2 text-sm" style={{ background: "var(--surface)" }}>
          <p className="font-bold" style={{ color: "var(--text)" }}>{t.decision.headline}</p>
          <ul className="mt-1 space-y-0.5" style={{ color: "var(--text-2)" }}>
            {t.decision.items.map((it, i) => <li key={i}>{mark(it.ok)} {it.label}</li>)}
          </ul>
          {t.decision.decideBy && <p className="mt-1 text-xs font-semibold" style={{ color: "var(--gold-dark)" }}>{t.decision.decideBy}</p>}
        </div>
      )}
      <ul data-review-part="why" className="space-y-1 text-sm" style={{ color: "var(--text-2)" }}>{t.why.map((w, i) => <li key={i}>{w}</li>)}</ul>
      {t.deadline && (
        <div data-review-part="deadline" className="mt-2 text-sm">
          <span className="font-bold" style={{ color: tone.fg }}>📅 {t.deadline.label}</span>
          {t.deadline.note && <span className="block text-xs" style={{ color: "var(--text-2)" }}>{t.deadline.note}</span>}
        </div>
      )}
      {t.cautions.length > 0 && (
        <ul data-review-part="cautions" className="mt-2 space-y-1 text-sm" style={{ color: "#A83B22" }}>{t.cautions.map((c, i) => <li key={i}>⚠️ {c}</li>)}</ul>
      )}
      {ownSteps && (
        <div data-review-part="steps" className="mt-2 text-sm" style={{ color: "var(--text-2)" }}>
          <div className="text-xs font-bold" style={{ color: "var(--text)" }}>הצעדים במצב הזה</div>
          <ol className="list-decimal space-y-1 ps-5">{ownSteps.map((x, i) => <li key={i}>{x}</li>)}</ol>
        </div>
      )}
    </div>
  );
}

function TrackBlock({ name, rep, wordings }: { name: string; rep: Wording; wordings: Wording[] }) {
  const others = wordings.slice(1);
  return (
    <div className="mb-8">
      <h3 className="mb-2 text-lg font-extrabold" style={{ color: "var(--teal-dark)" }}>{name}</h3>
      <p className="mb-2 text-xs" style={{ color: "var(--muted)" }}>הכרטיס המלא, כפי שהוא מופיע במפה במצב: {rep.labels[0]}</p>
      <div data-review-scenario={rep.labels[0]}><TrackCard t={rep.t} /></div>
      {others.length > 0 && (
        <>
          <p className="mb-2 mt-4 text-xs font-bold" style={{ color: "var(--text)" }}>
            {others.length === 1 ? "נוסח נוסף של הכרטיס, במצב אחר" : `${others.length} נוסחים נוספים של הכרטיס, לפי המצב`}
          </p>
          <div className="space-y-2">
            {others.map((w, i) => <div key={i} data-review-part="variant"><Variant labels={w.labels} t={w.t} repSteps={rep.t.steps} /></div>)}
          </div>
        </>
      )}
    </div>
  );
}

const GATE_LABEL: Record<GateResult, { text: string; color: string }> = {
  acceptable: { text: "קביל", color: "var(--teal-dark)" },
  verify_signer: { text: "לבדוק מי חתום", color: "var(--gold-dark)" },
  not_acceptable: { text: "לא", color: "var(--faint)" },
};

/** How the map reads each kind of document against the categories a route is checked on. */
function GateTable({ title, kinds, columns }: { title: string; kinds: DiagnosisKind[]; columns: { label: string; categories: DisabilityCategory[] }[] }) {
  const best = (kind: DiagnosisKind, categories: DisabilityCategory[]): GateResult => {
    const results = categories.map(c => diagnosisGate({ kind, year: 2026 }, c));
    return results.includes("acceptable") ? "acceptable" : results.includes("verify_signer") ? "verify_signer" : "not_acceptable";
  };
  return (
    <div data-review-id={`schedule:table:${title}`} data-review-label={title} className="mb-6 overflow-x-auto rounded-2xl border bg-white" style={{ borderColor: "var(--line)" }}>
      <div className="px-4 pt-3 text-sm font-extrabold" style={{ color: "var(--text)" }}>{title}</div>
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr style={{ color: "var(--muted)" }}>
            <th className="px-4 py-2 text-start font-bold">המסמך שבתיק, כשלא צוין מי חתום</th>
            {columns.map(c => <th key={c.label} className="px-3 py-2 text-start font-bold">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {kinds.map(k => (
            <tr key={k} className="border-t" style={{ borderColor: "var(--line)" }}>
              <td className="px-4 py-2" style={{ color: "var(--text)" }}>{DIAGNOSIS_KIND_LABELS[k]}</td>
              {columns.map(c => {
                const g = GATE_LABEL[best(k, c.categories)];
                return <td key={c.label} className="px-3 py-2 font-semibold" style={{ color: g.color }}>{g.text}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TipList({ title, tips, role }: { title: string; role: "school" | "gan"; tips: { key: string; title: string; lines: [string, string] }[] }) {
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-lg font-extrabold" style={{ color: "var(--teal-dark)" }}>{title}</h3>
      <div className="space-y-2">
        {tips.map(t => (
          <div key={t.key} data-review-id={`tip:${role}:${t.key}`} data-review-label={`כלי לצוות: ${t.title}`} className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--line)" }}>
            <div className="mb-1 flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-extrabold" style={{ color: "var(--text)" }}>{t.title}</span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>מופיע כש: {TIP_CONDITIONS[t.key] ?? "-"}</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>{t.lines[0]}</p>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>{t.lines[1]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlainList({ id, title, items }: { id: string; title: string; items: string[] }) {
  return (
    <div data-review-id={`pending:${id}`} data-review-label={title} className="mb-4 rounded-2xl border bg-white p-4" style={{ borderColor: "var(--line)" }}>
      <h3 className="mb-2 text-base font-extrabold" style={{ color: "var(--text)" }}>{title}</h3>
      <ul className="list-disc space-y-1.5 ps-5 text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
        {items.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    </div>
  );
}

// ── The atlas ────────────────────────────────────────────────────────────────

export default function Atlas({ today, section, onClose, onSeen }: {
  today: string;
  /** A section to open on, when the atlas is opened from a note or from the coverage list. */
  section?: string | null;
  onClose: () => void;
  onSeen: (sectionId: string) => void;
}) {
  const school = useMemo(() => byTrack(schoolScenarios(today), TRACK_UNIVERSE.school), [today]);
  const kindergarten = useMemo(() => byTrack(ganScenarios(today), TRACK_UNIVERSE.gan), [today]);
  const afterDeadline = useMemo(() => deadlineScenarios(today), [today]);
  const root = useRef<HTMLDivElement>(null);

  // Every folded part open: a note cannot be put on text that is not on screen,
  // and note mode does not let a click unfold anything.
  useEffect(() => {
    root.current?.querySelectorAll("details").forEach(d => { d.open = true; });
  }, [school, kindergarten]);

  useEffect(() => {
    if (!section) return;
    root.current?.querySelector(`[data-atlas-section="${section}"]`)?.scrollIntoView({ block: "start" });
  }, [section]);

  // A section counts as seen once it has been scrolled to.
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) onSeen((e.target as HTMLElement).dataset.atlasSection!);
    }, { root: el, threshold: 0.05 });
    el.querySelectorAll("[data-atlas-section]").forEach(s => io.observe(s));
    return () => io.disconnect();
  }, [onSeen]);

  const go = (id: string) => root.current?.querySelector(`[data-atlas-section="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const schoolColumns = (["emotional", "psychiatric", "learning"] as const).map(d => ({ label: DIRECTION_LABELS[d], categories: DIRECTION_CATEGORIES[d] }));
  const ganColumns = (["language", "functional", "autism", "emotional", "intellectual"] as const).map(d => ({ label: GAN_DIRECTION_LABELS[d], categories: GAN_DIRECTION_CATEGORIES[d] }));

  return (
    <div {...{ [UI_ATTR]: "" }} ref={root} dir="rtl" className="fixed inset-0 z-[155] overflow-y-auto" style={{ background: "var(--surface)", fontFamily: "'Heebo', sans-serif" }}>
      <div className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur" style={{ borderColor: "var(--line)" }}>
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-lg font-black" style={{ color: "var(--text)" }}>אטלס הוועדות והבירוקרטיה</div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>מחושב לתאריך {formatDateHe(today)}. כל כרטיס כאן הוא מה שהמפה מציגה ליועצת או לגננת במצב שמצוין לידו.</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border-2 px-4 py-2 text-sm font-bold" style={{ borderColor: "var(--teal)", color: "var(--teal-dark)" }}>חזרה לשאלון</button>
        </div>
        <div className="mx-auto flex max-w-4xl gap-2 overflow-x-auto px-4 pb-3">
          {ATLAS_SECTIONS.map(s => (
            <button key={s.id} type="button" onClick={() => go(s.id)} className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold" style={{ background: "var(--teal-pale)", color: "var(--teal-dark)" }}>{s.name}</button>
          ))}
        </div>
      </div>

      <div {...{ [SURFACE_ATTR]: "" }} className="mx-auto max-w-4xl space-y-14 px-4 pb-40 pt-8">
        <section data-atlas-section="school-routes">
          <SectionHead id="school-routes" hint="הכללים שקובעים אם המפה תזכיר ועדה בכלל. אלה הכרעות קליניות, והן המקום שבו הערה שלך שווה הכי הרבה." />
          <div className="space-y-3">{SCHOOL_RULES.map(r => <RuleCard key={r.id} rule={r} />)}</div>
        </section>

        <section data-atlas-section="school-tracks">
          <SectionHead id="school-tracks" hint="כל תחנה במפה של בית הספר: הכרטיס המלא עם הצעדים, המסמכים והערר, ואחריו כל הנוסחים שמתחלפים לפי מצב התיק." />
          {school.map(x => <TrackBlock key={x.key} name={x.name} rep={x.rep} wordings={x.wordings} />)}
        </section>

        <section data-atlas-section="school-after-deadline">
          <SectionHead id="school-after-deadline" hint="אותם כרטיסים בתאריכים אחרים בשנה: כשהמועד מתקרב, וכשהוא חלף. כולל את הגן." />
          <div className="space-y-2">
            {afterDeadline.flatMap(s => s.tracks.map((t, i) => <Variant key={`${s.label}-${i}`} labels={[s.label]} t={t} />))}
          </div>
        </section>

        <section data-atlas-section="gan-routes">
          <SectionHead id="gan-routes" hint="מה פותח כל כיוון בגיל הרך. הכללים האלה כתובים כברירת מחדל שממתינה לקריאה קלינית." />
          <div className="space-y-3">{GAN_RULES.map(r => <RuleCard key={r.id} rule={r} />)}</div>
        </section>

        <section data-atlas-section="gan-tracks">
          <SectionHead id="gan-tracks" hint="כל תחנה במפה של הגן, מהפעוטון ועד המעבר לכיתה א'." />
          {kindergarten.map(x => <TrackBlock key={x.key} name={x.name} rep={x.rep} wordings={x.wordings} />)}
        </section>

        <section data-atlas-section="schedule">
          <SectionHead id="schedule" hint="התוספת הראשונה כפי שהיא רשומה במערכת, ואיך המפה קוראת כל סוג מסמך שיועצת או גננת יכולות לסמן." />
          <div className="mb-6 overflow-x-auto rounded-2xl border bg-white" style={{ borderColor: "var(--line)" }}>
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr style={{ color: "var(--muted)" }}>
                  <th className="px-4 py-2 text-start font-bold">מוגבלות</th>
                  <th className="px-4 py-2 text-start font-bold">גורם שאבחנתו קבילה</th>
                </tr>
              </thead>
              <tbody>
                {(Object.entries(ACCEPTABLE_BY_CATEGORY) as [DisabilityCategory, (typeof ACCEPTABLE_BY_CATEGORY)[DisabilityCategory]][]).map(([cat, rule]) => (
                  <tr key={cat} data-review-id={`schedule:${cat}`} data-review-label={`תוספת ראשונה: ${cat}`} className="border-t align-top" style={{ borderColor: "var(--line)" }}>
                    <td className="px-4 py-2 font-bold" style={{ color: "var(--text)" }}>{cat}</td>
                    <td className="px-4 py-2" style={{ color: "var(--text-2)" }}>
                      <div>{rule.bodies.join(" · ")}</div>
                      {rule.combos?.map((c, i) => <div key={i}>או יחד: {c.join(" + ")}</div>)}
                      {rule.note && <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{rule.note}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <GateTable title="בית ספר: איך כל מסמך נקרא מול כל כיוון" kinds={SCHOOL_DIAGNOSIS_KINDS} columns={schoolColumns} />
          <GateTable title="גן: איך כל מסמך נקרא מול כל כיוון" kinds={GAN_DIAGNOSIS_KINDS} columns={ganColumns} />
        </section>

        <section data-atlas-section="tips">
          <SectionHead id="tips" hint="שתי השורות שמופיעות ליד כל תצפית של הצוות, ומתי כל אחת מופיעה." />
          <TipList title="בית ספר" role="school" tips={SCHOOL_TIPS} />
          <TipList title="גן" role="gan" tips={GAN_TIPS} />
        </section>

        <section data-atlas-section="pending">
          <SectionHead id="pending" hint="מה שהקוד עצמו מסמן כממתין להכרעה של איש/אשת מקצוע, והרשימות שהיועצת והגננת בוחרות מהן." />
          <PlainList id="school" title="החלטות קליניות פתוחות - בית ספר" items={PENDING_CLINICAL_DECISIONS} />
          <PlainList id="gan" title="החלטות קליניות פתוחות - גן" items={GAN_PENDING_DECISIONS} />
          <PlainList id="rules" title="כללים קליניים שכבר פועלים במפה" items={CLINICAL_RULES.filter(r => r.status === "approved").map(r => `${r.describe} (אושר ב-${r.reviewedOn ? formatDateHe(r.reviewedOn) : "-"})`)} />
          <PlainList id="interventions" title="מה כבר נוסה בבית הספר - הרשימה שהיועצת מסמנת ממנה" items={INTERVENTIONS.map(i => `${i.label} (${i.kind === "treatment" ? "ניסיון טיפולי" : "התערבות מערכתית"})`)} />
          <PlainList id="ladder" title="סולם המיצוי הלימודי" items={ACA_STEPS.map(s => `${s.label}${s.core ? " (שורת חובה)" : " (אם נדרש)"}`)} />
          <PlainList id="gan-interventions" title="מה כבר נוסה בגן - הרשימה שהגננת מסמנת ממנה" items={GAN_INTERVENTIONS.map(i => `${i.label} (${i.kind === "treatment" ? "ניסיון טיפולי" : i.kind === "system" ? "התערבות בגן" : "טיפול התפתחותי"}${i.toddler ? "" : ", לא מוצע בפעוטון"})`)} />
        </section>
      </div>
    </div>
  );
}
