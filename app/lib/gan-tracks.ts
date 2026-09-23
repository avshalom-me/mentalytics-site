/**
 * מפת המסלולים לגיל הרך: הצוות הרב-מקצועי בגן, ההערכה במכון להתפתחות הילד,
 * ועדת זכאות ואפיון בלוח הזמנים של הגנים, מעון יום שיקומי לפעוטות, השארה
 * בגן חובה והמעבר לכיתה א', וקצבת ילד נכה כזכות שההורים צריכים להכיר.
 *
 * The same contract as school-tracks.ts, and the same card: pure, `today`
 * injected, and every date, window and list here was read in an official
 * document and carries its source tag. Where a source states no number, the
 * card says so and sends the reader to the one who does know, rather than
 * guessing.
 *
 * What is clinical - which findings point at which disability - is not here.
 * gan-report.ts decides the directions from the questionnaire's answers and
 * this engine takes them as input, exactly as school-tracks.ts takes its own.
 *
 * What differs from the school map, and why the file exists at all:
 *  - The calendar. Referral by 31.3 as at school, but kindergarten hearings run
 *    to 31.5 (school: 15.5), a hearing may be continued to 15.7 once an
 *    assessment in progress is done - explicitly including children bound for
 *    the age-3 kindergarten - and a kindergarten child may be heard outside the
 *    dates for every kind of disability [G1][G2][M1].
 *  - The gateway. In early childhood the diagnosis usually comes out of a child
 *    development institute, reached through the paediatrician, with waiting
 *    times the Ministry of Health caps by age [H1]. That is a track here.
 *  - Toddlers. Under 3 there is no committee under the Special Education Law;
 *    there is a rehabilitative day-care centre under its own law, and the
 *    committee for the year the child enters kindergarten, which goes by civil
 *    year of birth [W1][G9][M1].
 *  - גן חובה. The move to first grade is a point at which eligibility is heard
 *    again, and keeping a child another year is its own procedure, which the
 *    committee has no power over [G5][M1][M2].
 *
 * Sources (read 23.9.2026):
 *  [A]  תוספת ראשונה - גורמים שאבחנתם קבילה (as in school-tracks.ts)
 *  [G1] פורטל הורים - ועדת זכאות ואפיון
 *       https://parents.education.gov.il/special-education/committees/entitelment-committee1
 *  [G2] פורטל הורים - בקשה לדיון שלא במועד (ועדה חריגה)
 *       https://parents.education.gov.il/special-education/committees/entitelment-committee3/
 *  [G3] פורטל הורים - הצוות הרב-מקצועי
 *       https://parents.education.gov.il/special-education/committees/entitelment-committee2
 *  [G4] חוק חינוך מיוחד, התשמ"ח-1988, נוסח עדכני - הגדרות, ס' 6-8 (הרכב, הפניה, בחירת
 *       מסגרת), ס' 13 (השגה על ועדת זכאות), ס' 20ה (השגה על הצוות הרב-מקצועי)
 *  [G5] משרד החינוך, אגף א' חינוך מיוחד - יישום תיקון 11: מידע להורים (תשפ"א)
 *       https://meyda.education.gov.il/files/special/lows/parentsinformationtashaf.pdf
 *  [G6] פורטל מוסדות חינוך - שאלונים להפניה לוועדת זכאות ואפיון בגני ילדים
 *       https://mosdot.education.gov.il/students/special-edu/appeal-questionnaire-kg/
 *  [G7] פורטל הורים - גני ילדים לחינוך מיוחד
 *       https://parents.education.gov.il/special-education/frameworks/cluster-special-kg
 *  [G8] פורטל הורים - מעבר מגן לכיתה א', ובשלות ומוכנות לכיתה א'
 *  [G9] הודעת מנכ"ל - הרישום לגני ילדים ולבתי ספר יסודיים לשנת הלימודים תשפ"ז (1.1.2026)
 *       https://apps.education.gov.il/Mankal/Hodaa.aspx?siduri=361
 *  [M1] חוזר מנכ"ל, הוראת קבע 0287 "יישום חוק החינוך המיוחד - ועדות מתוקף חוק" (28.3.2022)
 *       https://apps.education.gov.il/Mankal/Horaa.aspx?siduri=385
 *  [M2] חוזר מנכ"ל, הוראת קבע 0448 "מעברים - רצף חינוכי מהגן לבית הספר" (1.9.2025)
 *       https://apps.education.gov.il/Mankal/Horaa.aspx?siduri=558
 *  [H1] משרד הבריאות - אבחון עיכוב התפתחותי (עודכן 13.3.2025)
 *  [H2] משרד הבריאות - עיכוב התפתחותי: זכאות לאבחון ולטיפול (עודכן 4.11.2025)
 *  [W1] חוק מעונות יום שיקומיים, התש"ס-2000; מרכז המחקר והמידע של הכנסת, "מעונות יום
 *       שיקומיים לילדים עד גיל שלוש: נתונים ועלויות הפעלה" (26.11.2020)
 *  [B1] ביטוח לאומי - קצבת ילד נכה: עיכוב התפתחותי; [B2] בעיות בדיבור; [B3] אוטיזם
 */

import {
  ACCEPTABLE_BY_CATEGORY,
  DISABILITY_CATEGORIES,
  CONSENT_ITEM,
  decisionOf,
  eligibilityByCategory,
  exactSigners,
  formatDateHe,
  isoAddDays,
  isoDiffDays,
  schoolYear,
  zakautAppealTrack,
  type DecisionItem,
  type Diagnosis,
  type DisabilityCategory,
  type GateResult,
  type Relevance,
  type SchoolTrack,
  type TrackDecision,
} from "./school-tracks";

// ── Grades ───────────────────────────────────────────────────────────────────

/** The kindergarten years the questionnaire knows, oldest first. Same literals as its grade tracks. */
export const GAN_GRADES = ["גן", "גן-טרום", "גן3", "פעוט"] as const;
export type GanGrade = (typeof GAN_GRADES)[number];
export const GAN_GRADE_LABELS: Record<GanGrade, string> = { "גן": "גן חובה", "גן-טרום": "גן טרום חובה", "גן3": "גן גיל 3", "פעוט": "פעוטון" };
export function isGanGrade(g: unknown): g is GanGrade {
  return typeof g === "string" && (GAN_GRADES as readonly string[]).includes(g);
}

// ── Directions ───────────────────────────────────────────────────────────────

/**
 * The First Schedule categories a kindergarten map may name, by what the
 * questionnaire or the file points to. gan-report.ts decides which apply.
 *
 * "intellectual" never comes from the questionnaire - nothing in it screens
 * for it - only from a diagnosis committee's determination in the file.
 */
export type GanDirection = "language" | "functional" | "autism" | "emotional" | "intellectual";
export const GAN_DIRECTION_LABELS: Record<GanDirection, string> = {
  language: "עיכוב התפתחותי בתחום השפה",
  functional: "עיכוב התפתחותי בתחום התפקודי",
  autism: "מוגבלות על רצף האוטיזם",
  emotional: "הפרעות התנהגותיות ורגשיות",
  intellectual: "מוגבלות שכלית התפתחותית",
};
export const GAN_DIRECTION_CATEGORIES: Record<GanDirection, DisabilityCategory[]> = {
  language: ["עיכוב התפתחותי בתחום השפה"],
  functional: ["עיכוב התפתחותי בתחום התפקודי"],
  autism: ["מוגבלות על רצף האוטיזם"],
  emotional: ["הפרעות התנהגותיות ורגשיות"],
  intellectual: ["מוגבלות שכלית התפתחותית"],
};
/** Who may sign each, in the Schedule's own terms [A] - said on the card, where the teacher is looking. */
export const GAN_DIRECTION_SIGNERS: Record<GanDirection, string> = {
  language: "קלינאי/ת תקשורת במכון להתפתחות הילד",
  functional: "נוירולוג/ית ילדים והתפתחות הילד, או פסיכולוג/ית חינוכי/ת או התפתחותי/ת יחד עם קלינאי/ת תקשורת או מרפא/ה בעיסוק",
  autism: "פסיכיאטר/ית ילדים ונוער, רופא/ת ילדים עם שלוש שנות ניסיון לפחות במכון מוכר להתפתחות הילד, או נוירולוג/ית ילדים והתפתחות הילד - ובאבחון הראשון גם אבחון של פסיכולוג/ית קליני/ת, התפתחותי/ת, או שיקומי/ת או חינוכי/ת עם הכשרה מוכחת באוטיזם",
  emotional: "פסיכולוג/ית חינוכי/ת, התפתחותי/ת או קליני/ת, או פסיכיאטר/ית ילדים ונוער",
  intellectual: "ועדת האבחון לפי חוק הסעד (טיפול באנשים עם מוגבלות שכלית-התפתחותית)",
};
/** The directions whose diagnosis comes out of a child development institute. */
export const DEVELOPMENTAL_DIRECTIONS: GanDirection[] = ["language", "functional", "autism"];

/**
 * The file's standing per category, with one thing the per-document gate
 * cannot see: a combination the Schedule allows across two documents. The
 * functional-delay entry reads "פסיכולוג חינוכי או התפתחותי - יחד עם קלינאי
 * תקשורת או מרפא בעיסוק" [A], and in a kindergarten file those are usually two
 * reports - the psychologist's and the therapist's [M1, נספח 8].
 */
export function ganCategoryStates(diagnoses: Diagnosis[]): Record<DisabilityCategory, GateResult> {
  const out = { ...eligibilityByCategory(diagnoses) };
  const all = diagnoses.flatMap(exactSigners);
  for (const c of DISABILITY_CATEGORIES) {
    if (out[c] === "acceptable") continue;
    if (ACCEPTABLE_BY_CATEGORY[c].combos?.some(combo => combo.every(b => all.includes(b)))) out[c] = "acceptable";
  }
  return out;
}

// ── Statuses the teacher reports ─────────────────────────────────────────────

export type GanSetting = "regular" | "regular_support" | "personal_basket" | "special_gan" | "daycare" | "rehab_daycare" | "home";
export type DevCenterStatus = "none" | "waiting" | "in_process" | "done";
export type RehabDaycareStatus = "none" | "considering" | "applied" | "attends";
export type ExtraYearStatus = "none" | "considering" | "requested" | "decided";

export interface GanTracksInput {
  grade: GanGrade;
  /** ISO date. Pass israelToday() at call sites. */
  today: string;
  /** Age in whole years, as given. Read for the National Insurance grounds only. */
  age?: number;
  diagnoses: Diagnosis[];
  /** What the findings or the file point to. Empty means the map names no committee. */
  directions?: GanDirection[];
  /** Directions waiting on nothing but attempts not yet made - the emotional route only. */
  pendingDirections?: GanDirection[];
  exhaustionNote?: string;
  /** The kindergarten's multi-professional team, chaired by the מתי"א [G3]. */
  team?: { convened: boolean };
  devCenter?: DevCenterStatus;
  setting?: GanSetting;
  zakaut?: {
    status: "none" | "considering" | "in_process" | "decided";
    /** ISO date the parents received the decision - the objection clock runs from here [G4]. */
    decisionReceivedOn?: string;
  };
  rehabDaycare?: RehabDaycareStatus;
  extraYear?: ExtraYearStatus;
}

// ── Dates ────────────────────────────────────────────────────────────────────

export interface GanWindow {
  open: boolean;
  /** Referral deadline for the following school year: 31 March [G1][M1 §3.6.1]. */
  deadline: string;
  daysLeft: number | null;
  /** The kindergarten team's hearings open on 1 March [G3][M1 §2.7.2]. */
  teamFrom: string;
  /** Kindergarten and first-grade hearings - the committee's and the team's - end by 31 May [G1][M1]. */
  committeesFinishBy: string;
  /** A hearing continued once an assessment in progress is done: 15 July, "לרבות ילדים המיועדים לגן לגילאי שלוש" [M1 §3.6.1(ה)]. */
  followUpBy: string;
  /** Extra year in גן חובה: the teacher's and the parents' questionnaires reach the psychological service by 1 March [M2]. */
  extraYearFormsBy: string;
  /** The authority decides "עד אמצע מאי" [M2]. Placed on 15.5, labelled as the circular words it. */
  extraYearDecisionBy: string;
  /** The decision reaches the parents "לא יאוחר מסוף חודש מאי" [M2]. */
  extraYearNoticeBy: string;
  nextOpens: string;
  /** The school year a referral made now would apply to. */
  placementYear: string;
  /** The calendar year that school year starts in. */
  placementStart: number;
}

export function ganWindow(todayIso: string): GanWindow {
  const sy = schoolYear(todayIso);
  const y = sy.start + 1;
  const deadline = `${y}-03-31`;
  const open = todayIso <= deadline;
  return {
    open,
    deadline,
    daysLeft: open ? isoDiffDays(todayIso, deadline) : null,
    teamFrom: `${y}-03-01`,
    committeesFinishBy: `${y}-05-31`,
    followUpBy: `${y}-07-15`,
    extraYearFormsBy: `${y}-03-01`,
    extraYearDecisionBy: `${y}-05-15`,
    extraYearNoticeBy: `${y}-05-31`,
    nextOpens: `${y}-09-01`,
    placementYear: schoolYear(`${y}-09-01`).label,
    placementStart: y,
  };
}

/**
 * Kindergarten age goes by civil year of birth [G9], and so does the right to
 * start a special-education kindergarten: a child who turns 3 by 31 December
 * may start it in that school year [M1 §3.4.3]. So the age-3 kindergarten of
 * the year that starts in September Y takes the children born in Y-3.
 */
export function ganEntryCohort(placementStart: number): number {
  return placementStart - 3;
}

/** The maximum waits the Ministry of Health sets for a developmental assessment [H1]. */
export const DEV_CENTER_MAX_WAIT =
  "זמני ההמתנה המרביים שקבע משרד הבריאות לאבחון התפתחותי: עד גיל שנה - 3 חודשים; מעל גיל שנה - 4 חודשים; מעל גיל 4 או עם עיכוב התפתחותי - 5 חודשים";
/** The longest of them, in days - an assessment started later than this before 31.3 may not be in the file by then. */
const DEV_CENTER_LONGEST_WAIT_DAYS = 150;

// ── Documents and links ──────────────────────────────────────────────────────

export const GAN_ZAKAUT_DOCUMENTS = [
  "טופס ויתור סודיות (בהורים פרודים - חתימת שני ההורים)",
  "מסמך קביל על אבחנת המוגבלות, מגורם שאבחנתו קבילה לפי התוספת הראשונה - או אישור שהאבחון בתהליך",
  "בדיקות שמיעה וראייה עדכניות - בהפניה ראשונה",
  "שאלון הפניה - ממלאת מנהלת הגן; המפקח/ת חותם/ת, והחתימה אינה תנאי לדיון",
  "מסמך מיצוי אפשרויות על תוכניות התמיכה שיושמו בגן - חובה בהפניה ראשונה מגן רגיל, בחתימת המפקח/ת הכולל/ת; ההפניה והדיון מתקיימים גם בלי המלצתו/ה",
  "שאלון רמת תפקוד (ראמ\"ה) - אינו חובה מאז תשפ\"ג",
  "שאלון להורים (רשות) וכל מסמך שההורים רוצים להציג, למשל סיכום המכון להתפתחות הילד ודוחות טיפול",
];

const GAN_LINKS = {
  zakaut: { label: "ועדת זכאות ואפיון - פורטל הורים", href: "https://parents.education.gov.il/special-education/committees/entitelment-committee1" },
  exceptional: { label: "דיון שלא במועד (ועדה חריגה) - פורטל הורים", href: "https://parents.education.gov.il/special-education/committees/entitelment-committee3/" },
  team: { label: "הצוות הרב-מקצועי - פורטל הורים", href: "https://parents.education.gov.il/special-education/committees/entitelment-committee2" },
  forms: { label: "שאלונים להפניה בגני ילדים - פורטל מוסדות חינוך", href: "https://mosdot.education.gov.il/students/special-edu/appeal-questionnaire-kg/" },
  specialKg: { label: "גני ילדים לחינוך מיוחד - פורטל הורים", href: "https://parents.education.gov.il/special-education/frameworks/cluster-special-kg" },
  admissible: { label: "גורמים שאבחנתם קבילה - תוספת ראשונה (משרד החינוך)", href: "http://meyda.education.gov.il/files/PortalBaaluyot/POB/admissible-functionary.pdf" },
  circular0287: { label: "חוזר מנכ\"ל 0287 - ועדות מתוקף חוק החינוך המיוחד", href: "https://apps.education.gov.il/Mankal/Horaa.aspx?siduri=385" },
  circular0448: { label: "חוזר מנכ\"ל 0448 - מעברים מהגן לבית הספר", href: "https://apps.education.gov.il/Mankal/Horaa.aspx?siduri=558" },
  transition: { label: "מעבר מגן לכיתה א' - פורטל הורים", href: "https://parents.education.gov.il/gov-education/kindergarten/first-grade/transitiona" },
  devDiagnosis: { label: "אבחון עיכוב התפתחותי - משרד הבריאות", href: "https://me.health.gov.il/parenting/raising-children/testing-and-diagnoses-in-children/developmental-delays/developmental-delay-diagnosis/" },
  rehabLaw: { label: "חוק מעונות יום שיקומיים, התש\"ס-2000", href: "https://fs.knesset.gov.il/15/law/15_lsr_300202.pdf" },
  rehabMmm: { label: "מעונות יום שיקומיים - מרכז המחקר והמידע של הכנסת (2020)", href: "https://fs.knesset.gov.il/globaldocs/MMM/593199a7-e5c0-ea11-8107-00155d0aee38/2_593199a7-e5c0-ea11-8107-00155d0aee38_11_17843.pdf" },
  btlDev: { label: "קצבת ילד נכה - עיכוב התפתחותי (ביטוח לאומי)", href: "https://www.btl.gov.il/benefits/Disabled_Child/likuilist/Pages/developmentaldisability.aspx" },
  btlSpeech: { label: "קצבת ילד נכה - בעיות בדיבור (ביטוח לאומי)", href: "https://www.btl.gov.il/benefits/Disabled_Child/likuilist/Pages/speakingproblems.aspx" },
  btlAutism: { label: "קצבת ילד נכה - אוטיזם (ביטוח לאומי)", href: "https://www.btl.gov.il/benefits/Disabled_Child/likuilist/Pages/autism.aspx" },
} as const;

const REL_RANK: Record<Relevance, number> = { primary: 0, consider: 1, info: 2 };
const labelsOf = (ds: GanDirection[]) => ds.map(d => GAN_DIRECTION_LABELS[d]).join(", ");
const OBJECTION_TO_COMMITTEE = { against: "החלטת ועדת זכאות ואפיון", window: "21 יום מקבלת ההחלטה", to: "ועדת השגה, שמחליטה תוך 21 יום; לאחריה - עתירה מנהלית" };

// ── The map ──────────────────────────────────────────────────────────────────

export function ganTracks(input: GanTracksInput): SchoolTrack[] {
  const { grade, today, diagnoses } = input;
  const tracks: SchoolTrack[] = [];
  const win = ganWindow(today);
  const directions = input.directions ?? [];
  const pending = input.pendingDirections ?? [];
  const developmental = directions.filter(d => DEVELOPMENTAL_DIRECTIONS.includes(d));
  const toddler = grade === "פעוט";
  const chova = grade === "גן";
  const setting = input.setting;
  const zStatus = input.zakaut?.status ?? "none";
  const alreadyEligible = setting === "special_gan" || setting === "personal_basket" || zStatus === "decided";
  const states = ganCategoryStates(diagnoses);
  const dirCategories = Array.from(new Set(directions.flatMap(d => GAN_DIRECTION_CATEGORIES[d])));
  const acceptable = dirCategories.filter(c => states[c] === "acceptable");
  const verify = dirCategories.filter(c => states[c] === "verify_signer");
  const devStatus = input.devCenter;

  // ── צוות רב-מקצועי בגן: the first station in a regular kindergarten ──
  // A toddler is not yet in the Ministry's system, and a special-education
  // kindergarten has its own team - neither is sent to the מתי"א.
  if (!toddler && setting !== "special_gan") {
    const convened = input.team?.convened === true;
    const onRoute = directions.length > 0 || pending.length > 0;
    tracks.push({
      key: "gan_team",
      name: "צוות רב-מקצועי בגן (מתי\"א)",
      relevance: convened ? "info" : "primary",
      why: convened
        ? ["הצוות הרב-מקצועי כבר דן בילד/ה - התחנה הראשונה מאחוריכם"]
        : ["התחנה הראשונה בגן: צוות רב-מקצועי בראשות נציג/ת המתי\"א, עם מנהלת הגן ופסיכולוג/ית המסגרת, שדן בתמיכות מסל השילוב וההכלה - גם לילדים בני 3 ו-4"],
      documents: [
        "סיכום מה שנוסה בגן ותוצאותיו",
        "מסמך קביל על אבחנת המוגבלות, אם קיים",
        "בפנייה ראשונה - בדיקות שמיעה וראייה עדכניות",
      ],
      steps: [
        "לתאם עם המתי\"א ועם גננת השילוב דיון בצוות הרב-מקצועי, בשיתוף ההורים",
        `הדיונים בגנים מתקיימים מ-${formatDateHe(win.teamFrom)} ועד ${formatDateHe(win.committeesFinishBy)}, וההחלטות מיושמות בשנת הלימודים הבאה`,
        "ילד/ה בשנה הראשונה במערכת החינוך עם עיכוב התפתחותי משמעותי, שפתי או תפקודי: הצוות דן במימוש זכאות כבר בשנה הנוכחית",
        "בדיון בצוות, המלצת פסיכולוג/ית המסגרת (נספח 8) משמשת מסמך קביל מגורם אחד. לעיכוב תפקודי נדרש גם גורם שני - קלינאי/ת תקשורת או מרפא/ה בעיסוק - ואפשר להשלים אותו עד 15.7",
        "בדיון על הרכב הסל האישי ועל התוכנית האישית ההורים חברים בצוות",
        ...(onRoute ? ["אם התמיכה מסל השילוב אינה מספיקה - זו נקודת היציאה לוועדת זכאות ואפיון"] : []),
      ],
      appeals: [{ against: "החלטת הצוות הרב-מקצועי", window: "21 יום מקבלת ההחלטה בכתב", to: "ועדת זכאות ואפיון, שמחליטה תוך 21 יום" }],
      cautions: [],
      officialLinks: [GAN_LINKS.team, GAN_LINKS.circular0287],
      verified: "פורטל הורים [G3], חוזר 0287 §2.7 ונספח 8 [M1], חוק החינוך המיוחד ס' 20ה [G4], 23.9.2026",
    });
  }

  // ── הערכה במכון להתפתחות הילד: where an early-childhood diagnosis comes from ──
  if (developmental.length) {
    const why: string[] = [];
    const cautions: string[] = [];
    let relevance: Relevance = "primary";
    if (devStatus === "done") {
      relevance = "info";
      why.push("ההערכה במכון להתפתחות הילד נערכה. הסיכום שלה הוא לרוב המסמך שהוועדה צריכה - לבדוק מי חתום/ה עליו");
    } else if (devStatus === "in_process") {
      relevance = "info";
      why.push("ההערכה במכון להתפתחות הילד בעיצומה");
    } else if (devStatus === "waiting") {
      relevance = "consider";
      why.push("הופנו למכון להתפתחות הילד וממתינים לתור");
      cautions.push(DEV_CENTER_MAX_WAIT);
    } else {
      why.push(`הממצאים מצביעים על ${labelsOf(developmental)}. הבירור מתחיל ברופא/ת הילדים או באחות טיפת חלב, שמפנים למכון או ליחידה להתפתחות הילד המוכרים על ידי משרד הבריאות`);
      cautions.push(DEV_CENTER_MAX_WAIT);
    }
    // A committee needs the assessment in the file. When the longest wait
    // would carry it past the referral date, the circular's own way through is
    // worth saying now: refer on time with proof the assessment is under way.
    if (win.open && devStatus !== "done" && isoAddDays(today, DEV_CENTER_LONGEST_WAIT_DAYS) > win.deadline) {
      cautions.push(`הערכה שתתחיל עכשיו עשויה להסתיים אחרי ${formatDateHe(win.deadline)}. אפשר להפנות לוועדה במועד עם אישור שהאבחון בתהליך - גם לילדים המיועדים לגן גיל 3 - ולהשלים את המסמך בדיון המשך עד ${formatDateHe(win.followUpBy)}`);
    }
    tracks.push({
      key: "dev_center",
      name: "הערכה במכון להתפתחות הילד",
      relevance,
      why,
      documents: ["הפניה מרופא/ת הילדים", "מידע מהמסגרת על התפקוד - בהסכמת ההורים"],
      steps: [
        "לשתף את ההורים בתצפיות ולהמליץ על פנייה לרופא/ת הילדים או לאחות טיפת חלב",
        "ההערכה רב-מקצועית: רפואה התפתחותית, פסיכולוגיה התפתחותית, נוירולוגיית ילדים, קלינאות תקשורת, ריפוי בעיסוק, פיזיותרפיה ועבודה סוציאלית",
        ...developmental.map(d => `לוועדה, ${GAN_DIRECTION_LABELS[d]}: ${GAN_DIRECTION_SIGNERS[d]}`),
        "אבחון וטיפול בתחום התפתחות הילד ניתנים בסל הבריאות עד גיל 9",
      ],
      appeals: [],
      cautions,
      officialLinks: [GAN_LINKS.devDiagnosis, GAN_LINKS.admissible],
      verified: "משרד הבריאות [H1] 13.3.2025 ו-[H2] 4.11.2025, תוספת ראשונה [A], חוזר 0287 §3.6.1 [M1], 23.9.2026",
    });
  }

  // ── אבחנה קבילה לכיוון הרגשי: a psychologist's, not the institute's ──
  if (directions.includes("emotional") && states["הפרעות התנהגותיות ורגשיות"] !== "acceptable" && zStatus !== "decided") {
    tracks.push({
      key: "assessment",
      name: "אבחנה קבילה - הכיוון הרגשי-התנהגותי",
      relevance: zStatus === "in_process" ? "consider" : "info",
      why: ["ועדת זכאות ואפיון דורשת אבחנה קבילה של הפרעות התנהגותיות ורגשיות, ובתיק אין כרגע מסמך כזה"],
      documents: ["מידע מהגן על התפקוד - בהסכמת ההורים", "ויתור סודיות להעברת האבחון לוועדה"],
      steps: [
        `גורמים שאבחנתם קבילה: ${GAN_DIRECTION_SIGNERS.emotional}`,
        "פסיכולוג/ית המסגרת מהשירות הפסיכולוגי-חינוכי (שפ\"ח) היא לרוב הכתובת הראשונה",
      ],
      appeals: [],
      cautions: [],
      officialLinks: [GAN_LINKS.admissible],
      verified: "תוספת ראשונה [A], 23.9.2026",
    });
  }

  // ── ועדת זכאות ואפיון, on the kindergarten calendar ──
  // A child already eligible in גן חובה is heard again for first grade - the
  // first_grade track below - rather than referred anew.
  const committeeInPlay = directions.length > 0 || zStatus === "considering" || zStatus === "in_process";
  if (committeeInPlay && zStatus !== "decided" && !(chova && alreadyEligible)) {
    const why: string[] = [];
    const cautions: string[] = [];
    let relevance: Relevance = "info";
    if (zStatus !== "considering" && directions.length) why.push(`הכיוון שעלה: ${labelsOf(directions)}`);
    if (acceptable.length) {
      relevance = "consider";
      why.push(`בתיק מסמך מגורם שאבחנתו קבילה לצורך: ${acceptable.join(", ")} - בתנאי שהאבחנה עצמה כתובה בו`);
    } else if (verify.length) {
      relevance = "consider";
      why.push(`ייתכן שקיימת אבחנה קבילה עבור: ${verify.join(", ")} - תלוי בהתמחות החותם/ת על המסמך`);
      cautions.push("לבדוק מי חתום/ה על המסמך ולהשוות לתוספת הראשונה: היא קובעת התמחות ומקום, לא רק מקצוע");
    } else if (dirCategories.length) {
      why.push(`בהיעדר מסמך קביל על אבחנת המוגבלות לא תתאפשר קביעת זכאות - ובתיק אין כרגע מסמך שמתאים לכיוון הזה (${dirCategories.join(", ")}). אבחון שבתהליך: אפשר להפנות עד ${formatDateHe(win.deadline)} עם אישור, ולהשלים בדיון המשך עד ${formatDateHe(win.followUpBy)}`);
    }
    if (zStatus === "in_process") why.push("ההליך כבר בעיצומו לפי הדיווח");
    if (toddler) {
      const cohort = ganEntryCohort(win.placementStart);
      why.push(win.open
        ? `ועדת זכאות ואפיון דנה בילדים מגיל 3: מי שימלאו לו/ה 3 עד 31 בדצמבר רשאי/ת להתחיל גן חינוך מיוחד באותה שנת לימודים. ילידי ${cohort} נכנסים לגן בספטמבר ${win.placementStart}, וההפניה לקראת אותה שנה - עד ${formatDateHe(win.deadline)}`
        : `ועדת זכאות ואפיון דנה בילדים מגיל 3: מי שימלאו לו/ה 3 עד 31 בדצמבר רשאי/ת להתחיל גן חינוך מיוחד באותה שנת לימודים. לילידי ${cohort} (גן בספטמבר ${win.placementStart}) מועד ההפניה חלף; לילידי ${cohort + 1} - הפניה עד 31.3.${win.placementStart + 1}`);
    }
    if (chova) why.push(`בגן חובה הזכאות שתיקבע תחול בכיתה א'. דיוני העולים לכיתה א' מסתיימים עד ${formatDateHe(win.committeesFinishBy)}`);

    let decision: TrackDecision | undefined;
    if (zStatus === "considering") {
      if (relevance === "info") relevance = "consider";
      const items: DecisionItem[] = [];
      if (directions.length) items.push({ label: `כיוון שעלה: ${labelsOf(directions)}`, ok: true });
      for (const d of directions) {
        const st = GAN_DIRECTION_CATEGORIES[d].map(c => states[c]);
        const label = `אבחנה קבילה ל${GAN_DIRECTION_LABELS[d]}`;
        items.push(st.includes("acceptable") ? { label, ok: true }
          : st.includes("verify_signer") ? { label: `${label} - לבדוק את התמחות החותם/ת`, ok: null }
          : { label, ok: false });
      }
      if (developmental.length) {
        items.push(devStatus === "done" ? { label: "הערכה במכון להתפתחות הילד", ok: true }
          : devStatus === "in_process" || devStatus === "waiting" ? { label: "הערכה במכון להתפתחות הילד - טרם הסתיימה (אפשר להפנות עם אישור ולהשלים עד 15.7)", ok: null }
          : { label: "הערכה במכון להתפתחות הילד", ok: false });
      }
      if (!toddler && setting !== "special_gan") {
        const team = input.team;
        items.push({ label: "דיון בצוות הרב-מקצועי בגן (מתי\"א)", ok: team ? team.convened : null });
        items.push({ label: "שאלון הפניה ומסמך מיצוי אפשרויות מהגן - עד סוף מרץ", ok: null });
      }
      items.push(CONSENT_ITEM);
      const by = isoAddDays(win.deadline, -30);
      const decideBy = !win.open
        ? undefined
        : today <= by
          ? `מומלץ להכריע עד ${formatDateHe(by)} - חודש לפני המועד האחרון, כדי להספיק לאסוף מסמכים וחתימות`
          : `מומלץ להכריע בהקדם - נותרו ${win.daysLeft} ימים למועד האחרון`;
      decision = decisionOf(items, { decideBy, deadline: win.open ? win.deadline : undefined });
    }

    tracks.push({
      key: "zakaut",
      name: toddler ? "ועדת זכאות ואפיון - לקראת הכניסה לגן" : "ועדת זכאות ואפיון",
      relevance,
      why,
      deadline: win.open
        ? { date: win.deadline, label: `הפניה עד ${formatDateHe(win.deadline)} לזכאות בשנת הלימודים ${win.placementYear}`, note: `נותרו ${win.daysLeft} ימים. שאלון ההפניה ממולא עד סוף מרץ; לרשות המקומית עשוי להיות מועד פנימי מוקדם יותר` }
        : { date: win.nextOpens, label: `חלף מועד ההפניה (31.3) לשנת הלימודים ${win.placementYear}`, note: "בגני ילדים אפשר לבקש דיון שלא במועד (ועדה חריגה) לכל סוגי המוגבלויות, באישור מנהל/ת המחוז ובכפוף למקום פנוי במסגרות החינוך המיוחד. עדכון מסמך או מסמך חדש כשלעצמם אינם נסיבה חריגה" },
      documents: GAN_ZAKAUT_DOCUMENTS,
      steps: [
        "לוודא שקיימת אבחנה קבילה של המוגבלות מגורם המופיע בתוספת הראשונה",
        "רשאים להפנות: ההורים, מוסד החינוך, נציג רשות החינוך המקומית, ארגון ציבורי, או מי שהוסמך בידי שר החינוך, שר העבודה והרווחה או שר הבריאות",
        "לילד/ה ממעון (פרטי או שיקומי) או ממסגרת פרטית אפשר להפנות בלי שאלון הפניה; מסמכים שבידי המעון מועברים לוועדה בהסכמת ההורים",
        `דיוני הגנים מתחילים בנובמבר ומסתיימים עד ${formatDateHe(win.committeesFinishBy)}; דיון המשך עם מסמך שהושלם - עד ${formatDateHe(win.followUpBy)}. הזימון נשלח לפחות 14 יום מראש, והמסמכים מועברים להורים לפחות 14 יום לפני הדיון`,
        "הזכאות מיושמת בשנת הלימודים שאחרי ההחלטה ותקפה לשלוש שנים",
        "ההורים בוחרים סוג מסגרת תוך 14 יום: גן רגיל עם סל אישי, או גן חינוך מיוחד. כשנקבעה זכאות למענה פרטני או קבוצתי בלבד - אין בחירת מסגרת. שינוי הבחירה למסגרת רגילה - עד 25.6",
        "גני החינוך המיוחד מאופיינים לפי המוגבלות: עיכוב התפתחותי תפקודי או שפתי, הפרעות התנהגותיות או רגשיות, מוגבלות שכלית התפתחותית, אוטיזם, מוגבלות פיזית, שמיעה או ראייה",
        "הוועדה אינה משבצת לגן מסוים - השיבוץ בסמכות צוות השיבוץ ברשות המקומית",
      ],
      appeals: [OBJECTION_TO_COMMITTEE],
      cautions,
      officialLinks: [GAN_LINKS.zakaut, GAN_LINKS.forms, GAN_LINKS.exceptional, GAN_LINKS.specialKg, GAN_LINKS.admissible, GAN_LINKS.circular0287],
      verified: "פורטל הורים [G1][G2][G7], פורטל מוסדות [G6], חוק החינוך המיוחד [G4], חוזר 0287 [M1], הודעת הרישום [G9], 23.9.2026",
      ...(decision ? { decision } : {}),
    });
  }

  // ── השגה ──
  if (zStatus === "decided" && input.zakaut?.decisionReceivedOn) {
    tracks.push(zakautAppealTrack(input.zakaut.decisionReceivedOn, today, "הילד/ה"));
  }

  // ── מיצוי אפשרויות: the emotional route, waiting on attempts ──
  if (pending.length) {
    tracks.push({
      key: "exhaustion",
      name: "מיצוי אפשרויות לפני ועדה",
      relevance: "primary",
      why: [
        `הממצאים מצביעים על כיוון אפשרי (${labelsOf(pending)}), אך טרם נרשם המיצוי שהוועדה מצפה לראות`,
        ...(input.exhaustionNote ? [input.exhaustionNote] : []),
      ],
      documents: ["מסמך מיצוי אפשרויות - סיכום תוכניות התמיכה שיושמו בגן ותוצאותיהן"],
      steps: [
        "לקבוע מי אחראי/ת על כל התערבות ומתי נבדקת מחדש",
        "לתעד תוצאה לכל התערבות - זה הבסיס למסמך מיצוי האפשרויות שהוועדה דורשת בהפניה ראשונה מגן רגיל",
        "לשוב ולמלא את השאלון לאחר תקופת ההתערבות",
      ],
      appeals: [],
      cautions: [],
      officialLinks: [],
      verified: "החלטת הצוות הקליני של טיפול חכם (10.9.2026), מיושמת גם בגן; חוזר 0287 §3.8.3(יב) [M1]",
    });
  }

  // ── מעון יום שיקומי: under 3, under its own law ──
  const daycare = input.rehabDaycare;
  if (toddler && (developmental.length > 0 || setting === "rehab_daycare" || (daycare && daycare !== "none"))) {
    const attends = daycare === "attends" || setting === "rehab_daycare";
    const why = attends
      ? ["הפעוט/ה במעון יום שיקומי. המעון אינו מחליף את ועדת הזכאות לקראת הגן"]
      : daycare === "applied"
        ? ["הוגשה בקשה למעון יום שיקומי לפי הדיווח"]
        : ["מעון יום שיקומי הוא מסגרת חינוכית-טיפולית לפעוטות עם מוגבלות, קרוב ככל האפשר למקום המגורים, עם טיפולים התפתחותיים ופרא-רפואיים, הסעה וליווי"];
    why.push("גיל: מחצי שנה ועד 3 למקבלי קצבת ילד נכה, ומשנה ועד 3 לפי אחת העילות שבחוק. מי שמלאו לו/ה 3 במהלך שנת הלימודים - עד סוף אותה שנה");
    tracks.push({
      key: "rehab_daycare",
      name: "מעון יום שיקומי",
      relevance: attends || daycare === "applied" ? "info" : "consider",
      why,
      documents: [
        "אחת העילות: קצבת ילד נכה מביטוח לאומי; קביעת ועדת אבחון (מוגבלות שכלית התפתחותית); קביעת מכון להתפתחות הילד על עיכוב התפתחותי ניכר; לקות ראייה בשתי העיניים או לקות שמיעה בשתי האוזניים; פגיעה נוירולוגית עם לקות מוטורית קשה בשתי גפיים לפחות",
      ],
      steps: [
        "\"עיכוב התפתחותי ניכר\" מוגדר בחוק כממוצע תפקוד כללי ברמה של DQ 55 ומטה, על פני התחומים המוטורי, השפתי-תקשורתי, הקוגניטיבי, החברתי והרגשי-הסתגלותי",
        "הפנייה נעשית דרך המחלקה לשירותים חברתיים ברשות המקומית, שבה גם מחושבת השתתפות ההורים לפי ההכנסה לנפש",
        "אפשר להפנות במשך כל השנה. המעון פועל מתחילת שנת הלימודים ועד אוגוסט, בשעות 7:30-15:30",
        "טיפולים פרא-רפואיים (ארבע שעות שבועיות) ניתנים במעון, במימון קופת החולים",
        `לקראת הכניסה לגן: הפניה לוועדת זכאות ואפיון עד ${formatDateHe(win.deadline)} - המעון אינו מחליף את הוועדה, והוועדה רשאית להסתמך על מידע בכתב מהמעון`,
      ],
      appeals: [],
      cautions: ["נתוני התפעול (שעות, טיפולים, השתתפות) לקוחים ממסמך הכנסת משנת 2020, ודרך הפנייה נמסרה במקורות משניים - לוודא מול המחלקה לשירותים חברתיים"],
      officialLinks: [GAN_LINKS.rehabLaw, GAN_LINKS.rehabMmm],
      verified: "חוק מעונות יום שיקומיים, התש\"ס-2000, ומרכז המחקר והמידע של הכנסת (26.11.2020) [W1], 23.9.2026",
    });
  }

  // ── השארה בגן חובה שנה נוספת: only when the teacher raised it ──
  const extra = input.extraYear;
  if (chova && extra && extra !== "none") {
    const deadline = extra === "decided"
      ? undefined
      : today <= win.extraYearFormsBy
        ? { date: win.extraYearFormsBy, label: `שאלון גננת ושאלון הורים לשפ"ח - עד ${formatDateHe(win.extraYearFormsBy)}`, note: "ההחלטה ברשות - עד אמצע מאי; ההודעה להורים - לא יאוחר מסוף מאי" }
        : today <= win.extraYearNoticeBy
          ? { date: win.extraYearNoticeBy, label: "ההודעה להורים - לא יאוחר מסוף מאי", note: "ההחלטה ברשות - עד אמצע מאי. אם השאלונים לא הועברו לשפ\"ח עד 1.3 - לברר מול הרשות" }
          : undefined;
    tracks.push({
      key: "extra_year",
      name: "השארה בגן חובה שנה נוספת",
      relevance: extra === "considering" ? "consider" : "info",
      why: [
        "דחיית המעבר לכיתה א' נבחנת רק בגיל 5, בשנת הגן האחרונה, ובמקרים חריגים: ילידי ספטמבר-דצמבר עם פערים רגשיים או תפקודיים שלא התקדמו למרות התערבות; ילידי ינואר-אוגוסט רק בנסיבות מיוחדות, כמו מחלה קשה, אשפוז, טראומה, עלייה או מעבר מחינוך מיוחד לגן רגיל בגיל 5",
        ...(extra === "requested" ? ["השאלונים הועברו לפי הדיווח"] : extra === "decided" ? ["התקבלה החלטה לפי הדיווח"] : []),
      ],
      ...(deadline ? { deadline } : {}),
      documents: [
        "שאלון גננת (נספח 6 לחוזר 0448), חתום בידי המפקחת וההורים",
        "שאלון הורים (נספח 5)",
        "חוות דעת של גורמים טיפוליים, אם יש; חוות דעת של פסיכולוג/ית פרטי/ת - עד אמצע אפריל",
      ],
      steps: [
        "הרישום לכיתה א' נעשה בינואר בכל מקרה",
        "ההחלטה ברשות: ועדה בין-מקצועית (מנהל/ת הגנים, המפקחת ופסיכולוג/ית שפ\"ח) או פסיכולוג/ית שפ\"ח; לילידי ינואר-אוגוסט - ועדה בלבד",
        "לילד/ה שצפוי/ה לבקש זכאות לחינוך מיוחד מומלץ להכריע בהשארה לפני ועדת הזכאות",
        "ועדת הזכאות והאפיון עצמה אינה דנה בהשארה בגן חובה - זה הליך נפרד",
      ],
      appeals: [
        { against: "החלטת הרשות - ילידי ספטמבר-דצמבר", window: "14 יום (עד אמצע יוני)", to: "ערעור ברשות, ואחריו ערעור למחוז תוך שבוע - לא יאוחר מאמצע יולי" },
        { against: "החלטת הרשות - ילידי ינואר-אוגוסט", window: "14 יום (עד אמצע יוני)", to: "ישירות למחוז" },
      ],
      cautions: [],
      officialLinks: [GAN_LINKS.circular0448, GAN_LINKS.transition],
      verified: "חוזר מנכ\"ל 0448 \"מעברים\" (1.9.2025) [M2], חוזר 0287 §3.3.2 [M1], פורטל הורים [G8], 23.9.2026",
    });
  }

  // ── המעבר לכיתה א' של ילד/ה שכבר זכאי/ת ──
  if (chova && alreadyEligible) {
    tracks.push({
      key: "first_grade",
      name: "מעבר לכיתה א' - דיון בוועדת זכאות ואפיון",
      relevance: win.open ? "primary" : "info",
      why: [
        "המעבר מגן לכיתה א' הוא נקודה שבה הזכאות נדונה מחדש, בנוכחות ההורים",
        "אפיון \"עיכוב התפתחותי\" אפשר לציין עד גיל 9. בחידוש הזכאות רשאי/ת פסיכולוג/ית המסגרת להמליץ לשנות אותו ללקות למידה בלי מסמך קביל חדש - אך ההמלצה אינה אבחנה של לקות למידה",
      ],
      deadline: win.open
        ? { date: win.deadline, label: `הפניה עד ${formatDateHe(win.deadline)}; דיוני העולים לכיתה א' עד ${formatDateHe(win.committeesFinishBy)}`, note: `נותרו ${win.daysLeft} ימים למועד ההפניה` }
        : { date: win.committeesFinishBy, label: `מועד ההפניה לשנת הלימודים ${win.placementYear} חלף`, note: "לברר מול הרשות והמחוז את האפשרות לדיון שלא במועד" },
      documents: GAN_ZAKAUT_DOCUMENTS,
      steps: [
        "לתאם עם הגן והמתי\"א את ההפניה לדיון לקראת כיתה א'",
        "ההורים בוחרים סוג מסגרת לכיתה א' תוך 14 יום מההחלטה",
        "הרישום לכיתה א' נעשה בתקופת הרישום השנתית (בתשפ\"ז: 19.1-8.2.2026) - לוודא שנעשה",
      ],
      appeals: [OBJECTION_TO_COMMITTEE],
      cautions: [],
      officialLinks: [GAN_LINKS.zakaut, GAN_LINKS.circular0287, GAN_LINKS.transition],
      verified: "חוברת ההורים [G5], חוזר 0287 נספחים 8 ו-6.12 [M1], פורטל הורים [G1], הודעת הרישום [G9], 23.9.2026",
    });
  }

  // ── קצבת ילד נכה: the parents' right, beside the educational route ──
  const grounds: string[] = [];
  const links: { label: string; href: string }[] = [];
  const age = input.age;
  if (directions.includes("autism")) {
    grounds.push("אוטיזם: מגיל 91 יום ועד 18 ו-3 חודשים. נדרשות אבחנה של פסיכיאטר/ית, רופא/ה התפתחותי/ת או נוירולוג/ית ילדים, והערכה פסיכולוגית");
    links.push(GAN_LINKS.btlAutism);
  }
  if ((directions.includes("functional") || directions.includes("language") || directions.includes("intellectual")) && (age === undefined || age < 3)) {
    grounds.push("עיכוב התפתחותי: מגיל 91 יום ועד 3, כשהעיכוב חורג במידה ניכרת מבני הגיל; מסמך רפואי מהחצי שנה האחרונה. אחרי גיל 3 - בדיקה לפי עילת תלות בעזרת הזולת");
    links.push(GAN_LINKS.btlDev);
  }
  if (directions.includes("language") && (age === undefined || age >= 3)) {
    grounds.push("בעיות בדיבור (סיוע בתקשורת): מגיל 3 ועד 18 ו-3 חודשים; דוח קלינאי/ת תקשורת מששת החודשים שקדמו לתביעה, מכתב רפואי ודוח מהמסגרת החינוכית");
    links.push(GAN_LINKS.btlSpeech);
  }
  if (grounds.length) {
    tracks.push({
      key: "btl",
      name: "קצבת ילד נכה - ביטוח לאומי",
      relevance: "info",
      why: ["זכות של ההורים, נפרדת מהמסלול החינוכי: זכאות בביטוח לאומי אינה יוצרת זכאות בוועדה, ולהפך", ...grounds],
      documents: ["תביעה לקצבת ילד נכה", "מסמכים רפואיים עדכניים לפי העילה"],
      steps: ["ההורים מגישים את התביעה לביטוח לאומי; הזכאות נקבעת לרוב אחרי בדיקה בוועדה"],
      appeals: [],
      cautions: [],
      officialLinks: links,
      verified: "ביטוח לאומי [B1][B2][B3], 23.9.2026",
    });
  }

  return tracks.sort((a, b) => REL_RANK[a.relevance] - REL_RANK[b.relevance]);
}

// ── The year, drawn ──────────────────────────────────────────────────────────

export interface TimelineMark { iso: string; label: string; tone: "gold" | "teal" }

/**
 * The dates on the kindergarten year line: the committee's calendar, as on the
 * school line - referral, the end of the kindergarten hearings, the follow-up -
 * and the objection's end while it runs.
 *
 * The team's opening and the extra year's dates (1.3, mid-May) are on their
 * own cards and on the diagram's nodes, not here: five marks between March and
 * July put the labels on top of one another on a phone, and a line nobody can
 * read tells nobody anything. Pure, so the picture is tested with the map.
 */
export function ganTimelineMarks(grade: GanGrade, tracks: SchoolTrack[], today: string): TimelineMark[] {
  const win = ganWindow(today);
  // Short labels, as on the school line: the full wording is on the cards.
  const marks: TimelineMark[] = [
    { iso: win.deadline, label: "הפניה לוועדה", tone: "teal" },
    { iso: win.committeesFinishBy, label: "סיום דיוני הגנים", tone: "teal" },
    { iso: win.followUpBy, label: "דיון המשך", tone: "teal" },
  ];
  const appeal = tracks.find(t => t.key === "zakaut_appeal");
  if (appeal?.deadline && appeal.relevance === "primary") marks.push({ iso: appeal.deadline.date, label: "סוף חלון ההשגה", tone: "gold" });
  return marks.sort((a, b) => (a.iso < b.iso ? -1 : 1));
}
