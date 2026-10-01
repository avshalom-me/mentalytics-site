/**
 * בנק המקרים של מצב הביקורת - ילדים בדויים שהשאלון נטען עליהם, כדי שבודק/ת
 * מקצועי/ת יוכלו לעבור על כל מסך ועל כל פלט בלי למלא את השאלון עשרות פעמים.
 *
 * The cases are chosen by what the code branches on, not by how often such a
 * child walks into a counsellor's room: the three question tracks (גן-א, ב-ו,
 * ז-יב), the five learning bands, every state a committee can be in, a file
 * with an admissible document, one whose signer has to be checked and one with
 * none, the exhaustion floor met and unmet, and the kindergarten map with its
 * own calendar. cases.test.ts scores every one of them with the real engine
 * and fails if a screen, a track or a tip is no longer reached by any case -
 * so when the questionnaire grows a branch, the bank is told to grow one too.
 *
 * Every child here is invented. The names are first names only and belong to
 * nobody; the repo is public and a real case has no place in it.
 *
 * A case states only the answers that make it what it is. completeAnswers
 * (case-builder.ts) fills in the rest of the walk. Years of documents are
 * written relative to the school year of `today`, because what a document is
 * worth to the accommodations committee depends on the cohort and would
 * quietly change under a fixed year every September.
 */

import { schoolYear } from "@/app/lib/school-tracks";
import type { Ans } from "../quiz-logic";
import { ITEM_KEYS as K, adhd, completeAnswers, daysAgo, rate, unknown, yesOn } from "./case-builder";

export type CaseRole = "school" | "gan";

export interface ReviewCase {
  id: string;
  role: CaseRole;
  /** What the reviewer sees in the list. */
  title: string;
  /** Who the child is, in a sentence or two. */
  story: string;
  /** Why the case is in the bank - what is worth looking at on it. */
  focus: string[];
  /** One answer to change on the open case to see a neighbouring branch. */
  tryAlso?: string[];
  /** The answers that make the case. Dates in it are relative to `today`. */
  spec: (today: string) => Ans;
}

type Duration = "this_year" | "over_year" | "years";
const school = (grade: string, age: number, duration: Duration): Ans =>
  ({ _audience: "counselor", c_role: "school", _age: String(age), _grade: grade, c_duration: duration });
const gan = (grade: string, age: number, duration: Duration): Ans =>
  ({ _audience: "counselor", c_role: "gan", _age: String(age), _grade: grade, c_duration: duration });

/** 1 = תמיד, 2 = לפעמים, 3 = אף פעם - the two sensory scales. */
const sensory = (over: number[], under: number[]): Ans => ({ dev_sensory: "כן", ...rate(K.sensOver, over), ...rate(K.sensUnder, under) });
/** The calendar year the current school year started in. */
const syStart = (today: string) => schoolYear(today).start;

export const REVIEW_CASES: ReviewCase[] = [
  // ── בית ספר ────────────────────────────────────────────────────────────────
  {
    id: "noam-8",
    role: "school",
    title: "נועם, כיתה ח'",
    story: "קושי לימודי בולט מזה כמה שנים, עם מתח ברמה נמוכה. בית הספר נתן הוראה מתקנת ותמיכה מסל השילוב, והצוות מתלבט אם להפנות לוועדה.",
    focus: [
      "מסלול לימודי (58) פתוח: רבי מלל ב-5% וסולם המיצוי הושלם",
      "מתח ברמה נמוכה מוביל להפניה לטיפול דינאמי, והכיוון הרגשי (55) נפתח לצד הלימודי",
      "ועדת זכאות במצב 'בהתלבטות' - כרטיס 'שיקולים להכרעה'",
      "אבחון פסיכו-דידקטי מהשנה שעברה: קביל לוועדת זכאות, ולהתאמות צריך לבדוק אם נערך אחרי 1 ביולי",
      "מסלול ההתאמות בכיתה ח', כשהשאלון העלה ממצאי למידה וקשב",
    ],
    tryAlso: [
      "לשנות את 'תמיכה מסל השילוב' ל'בתהליך': המסלול הלימודי נסגר ומופיע 'מיצוי אפשרויות'",
      "לשנות את רבי המלל ל-20%: הפרופיל כבר לא מתאים לוועדה",
    ],
    spec: today => ({
      ...school("ח", 13, "years"),
      a_emo: "מעט", a_aca: "הרבה מאוד",
      q1: 3, ...rate(K.aq, [2, 2, 1, 2, 1, 2, 1, 1, 1, 2]), q2: 2, q3: 1,
      zh_verbal: "5%", zh_math: "20%", zh_eng: "10%", zh_comp: "כן", zh_write: "לא",
      zh_adhd_yn: "כן", ...adhd("zh", [1, 2, 4, 5]),
      c_support: "partial", c_org: 2,
      c_aca_steps: { remedial: "done", inclusion: "done", speech: "not_needed", ot: "not_needed", adhd_doc: "in_progress" },
      c_tried: { talks: "partial", parents: "partial", tachi: "no_help" },
      c_team: "no",
      c_diag: [{ kind: "פסיכו-דידקטי", year: syStart(today) - 1, signedBy: "פסיכולוג חינוכי" }],
      c_zakaut: "considering", c_hatamot: "none",
    }),
  },
  {
    id: "maya-10",
    role: "school",
    title: "מאיה, כיתה י'",
    story: "חרדה גבוהה שהתחילה השנה, כאבי בטן שלא נבדקו רפואית, סרבנות להגיע לבית הספר וקושי מתון בוויסות ביחסים. טיפול רגשי בבית הספר לא הועיל.",
    focus: [
      "חרדה ברמה הגבוהה - הפניה ל-CBT, וכלים להפחתת מתח לנוער",
      "אזהרת הכאבים הכרוניים כשלא נשלל גורם רפואי",
      "קושי ויסות ברמה המתונה (4 פריטים) - ההפניה נקבעת לפי מוטיבציה ויכולת תרגול",
      "כיוון רגשי (55) וכיוון נפשי (57) יחד, כשבתיק רק חוות דעת של פסיכולוג/ית קליני/ת",
      "מסלול ביקור סדיר (קב\"ס) על סרבנות, וההערה על קושי 'מהשנה בלבד'",
      "התאמות בכיתה י' במצב 'בהתלבטות', בלי אבחון בתיק",
    ],
    tryAlso: [
      "במסך המאפיינים, מוטיבציה 1: ההפניה לחרדה הופכת להדרכת הורים טיפולית",
      "יכולת תרגול 2 ומטה: טיפול פסיכודינאמי בשילוב הדרכת הורים",
    ],
    spec: today => ({
      ...school("י", 15, "this_year"),
      a_emo: "הרבה מאוד", a_aca: "מעט",
      q1: 5, c_attend: "refusal", c_change: "כן",
      q1_pain: "כן", q1_med_clear: "לא",
      ...rate(K.aq, [3, 3, 3, 2, 3, 2, 3, 1, 1, 3]), q2: 2, q3: 2,
      q9: "כן", ...yesOn(K.bq, [1, 3, 4, 6]),
      t_motiv: 5, t_prac: 5,
      tyb_verbal: "מעל 20%", tyb_math: "20%",
      c_support: "not_given", c_org: 1,
      c_tried: { therapy_school: "no_help", talks: "partial", parents: "partial" },
      c_fill: "phone_parent", c_team: "yes",
      c_diag: [{ kind: "פסיכולוג קליני", year: syStart(today) - 1 }],
      c_zakaut: "in_process", c_hatamot: "considering",
    }),
  },
  {
    id: "yoav-5",
    role: "school",
    title: "יואב, כיתה ה'",
    story: "קושי בוויסות ובקשב, חוצפה כלפי הצוות, הפרעות בשיעור ומריבות תכופות עם ילדים. חשד למעורבות בהצקות. עדיין לא ניתנה תמיכה לימודית.",
    focus: [
      "בכיתות ב'-ו' קושי בוויסות נבדק דרך שאלון הקשב",
      "התחום ההתנהגותי: התוכנית שמוצעת לפי הרמה הגבוהה שסומנה",
      "חיכוכים ומריבות ברמה גבוהה - קבוצה חברתית וכלים לעבודה בכיתה",
      "כלים לצוות: ויסות בכיתה, חשד למעורבות כפוגע, התארגנות",
      "מה המפה אומרת כשהממצא התנהגותי וקשבי, וחסר ניסיון טיפולי",
    ],
    spec: () => ({
      ...school("ה", 10, "over_year"),
      a_emo: "מעט", a_aca: "מעט", a_beh: "הרבה", a_soc: "הרבה",
      q1: 1, q2: 2, q3: 1,
      q9: "כן", ...adhd("q9", [1, 2, 3, 5], [1, 2, 4]),
      dv_math: "30% מהכי נמוכים בכיתה", dv_write: "כן",
      c_support: "not_given", c_org: 3,
      c_aca_steps: { remedial: "not_done", inclusion: "not_done" },
      beh1: "הרבה", beh2: "הרבה", beh3: "מעט",
      c_regulation: 3, c_bully_perp: "suspected",
      soc2: "כן", soc2_sev: 5,
      t_motiv: 3,
      c_tried: { plan: "no_help", parents: "partial" },
    }),
  },
  {
    id: "noa-3",
    role: "school",
    title: "נועה, כיתה ג'",
    story: "קושי בקריאה מכיתה א', עם רקע של עיכוב שפתי בגן. הוראה מתקנת רק התחילה, ואין עדיין תמיכה מסל השילוב. למשפחה מגבלה כלכלית.",
    focus: [
      "המסך הלימודי של א'-ג': שאלון הרקע ההתפתחותי והפניה לקלינאית תקשורת",
      "פרופיל לימודי שמתאים לוועדה, אבל סולם המיצוי לא הושלם - מסלול 'מיצוי אפשרויות'",
      "שמיעה שלא נבדקה ויש סימנים לקושי",
      "ההערה על אפשרויות ציבוריות כשיש מגבלה כלכלית",
    ],
    tryAlso: ["לסמן 'נעשה' בהוראה מתקנת ובסל השילוב, ו'לא נדרש' בקלינאית: המסלול הלימודי נפתח ומסך 'מה קיים בתיק' מופיע"],
    spec: () => ({
      ...school("ג", 8, "years"),
      a_aca: "הרבה מאוד",
      hearing: "לא", hear_sym: "כן",
      ag_read: "5% מהכי מתקשים בכיתה", ag_h1: "כן", ag_h2: "כן", ag_h5: "כן",
      ag_comp: "כן", ag_math: "10% מהכי מתקשים בכיתה",
      c_support: "partial", c_org: 2,
      c_aca_steps: { remedial: "in_progress", inclusion: "not_done", speech: "not_done" },
      c_tried: { parents: "helped" },
      c_economic: "yes",
    }),
  },
  {
    id: "itai-1",
    role: "school",
    title: "איתי, כיתה א'",
    story: "קושי בפרידה מההורים מתחילת השנה, כאבי בטן, הרטבת לילה שחזרה ורגישות חושית. איתי אוהב לצייר ומוכן לטיפול.",
    focus: [
      "מסלול גן-א': חרדת היפרדות, והפניה לפי הסכמת הילד ותחומי העניין שלו",
      "התחום ההתפתחותי בכיתה א': גמילה וויסות חושי, למילוי עם ההורים",
      "ממצא רגשי בלי שנוסו התערבויות - מסלול 'מיצוי אפשרויות'",
    ],
    tryAlso: [
      "במסך המאפיינים, 'לא' להסכמה לטיפול ו'כן' לטיפול עם הורה: הדרכת הורים טיפולית וטיפול דיאדי",
      "'לא' לשתי השאלות: הדרכת הורים טיפולית בלבד",
    ],
    spec: () => ({
      ...school("א", 6, "this_year"),
      a_emo: "הרבה", a_dev: "הרבה",
      q1: 4, c_attend: "some", c_change: "כן",
      q1_pain: "כן",
      ...rate(K.aq, [2, 2, 1, 2, 2, 1, 2, 3, 3, 2]), q2: 2, q3: 1,
      ga_consent: "כן", ga_int_art: true, ga_int_animal: true,
      dev_toilet: "כן", dev_toilet_past: "כן", dev_toilet_type: "ב", dev_wet_type: "לילה",
      ...sensory([1, 1, 2, 1, 2, 2, 1, 3, 2, 1], [3, 3, 2, 3, 3, 3, 2, 3]),
    }),
  },
  {
    id: "lior-7",
    role: "school",
    title: "ליאור, כיתה ז'",
    story: "ביישנות וחשש חברתי בולט, דימוי עצמי נמוך, טקסים קלים, ואירוע חרם ידוע בכיתה. שיחות עם היועצת וטיפול רגשי בבית הספר הועילו.",
    focus: [
      "התחום החברתי: שאלון החרדה החברתית וההפניה שעולה ממנו",
      "מריבות ברמה מתונה - קבוצה חברתית וכלים לעבודה בכיתה",
      "קושי בתקשורת שלא התחיל בגיל צעיר - לאן הוא מפנה",
      "התנהגויות אובססיביות-קומפולסיביות ברמה הקלה-בינונית",
      "כלים לצוות: בידוד חברתי, ונפגע/ת מחרם באירוע ידוע",
      "כל מה שנוסה סומן 'הועיל' - ההסבר שמיצוי פירושו ניסיון שלא הספיק",
      "כיתה ז': אין אזכור של התאמות בבגרויות",
    ],
    spec: () => ({
      ...school("ז", 12, "over_year"),
      a_emo: "מעט", a_soc: "הרבה מאוד",
      q1: 2, q2: 4, q3: 2,
      q5: "כן", ...rate(K.oq, [2, 2, 2, 2, 1, 2]),
      soc1: "כן", ...rate(K.lsas, [3, 2, 3, 2, 1, 2, 3, 1]),
      soc2: "כן", soc2_sev: 3,
      soc3: "כן", soc3_early: "לא",
      c_isolation: 3, c_bully_victim: "known",
      t_verbal: 2, int_art: true, int_animal: true,
      c_tried: { talks: "helped", therapy_school: "helped" },
      c_team: "unknown", c_economic: "unknown",
    }),
  },
  {
    id: "dana-11",
    role: "school",
    title: "דנה, כיתה י\"א",
    story: "מצב רוח ירוד מובהק, מחשבות אובדניות, הגבלת אכילה ומשקל נמוך. בטיפול פסיכיאטרי. התקבלו לאחרונה החלטת ועדת זכאות ותשובת הוועדה המחוזית להתאמות.",
    focus: [
      "הודעת הבטיחות כשדווחו מחשבות אובדניות - במסך ובדוח",
      "מצב רוח ברמה המובהקת, הפרעות אכילה ו-BMI חריג",
      "השגה על החלטת ועדת זכאות: חלון 21 הימים פתוח",
      "ערעור על תשובת הוועדה המחוזית להתאמות: 14 או 21 יום",
      "היעדרויות תכופות - מסלול ביקור סדיר 'לשיקול'",
    ],
    tryAlso: ["במסך 'מה קיים בתיק', להקדים את תאריך ההחלטה בחודש: חלון ההשגה נסגר והכרטיס משתנה"],
    spec: today => ({
      ...school("יא", 16, "over_year"),
      a_emo: "הרבה מאוד",
      q1: 2, c_attend: "frequent", c_change: "כן",
      q2: 3, q3: 5, ...yesOn(K.mq, [1, 2, 3, 4, 6, 7, 9]), q3_sui: "כן",
      q8: "כן", ...yesOn(K.ebOver12, [1, 2, 3]), _h: "165", _w: "45", _bmi: 45 / 1.65 ** 2,
      c_tried: { shach: "partial", external: "partial", parents: "no_help" },
      c_team: "yes",
      c_diag: [{ kind: "פסיכיאטר ילדים", year: syStart(today) }],
      c_zakaut: "decided", c_zakaut_on: daysAgo(today, 9),
      c_hatamot: "district_decided", c_hatamot_on: daysAgo(today, 5),
    }),
  },
  {
    id: "omer-9",
    role: "school",
    title: "עומר, כיתה ט'",
    story: "שימוש בחומרים, משחקי מחשב והימורים מעבר לשליטה, קושי בוויסות רגשי ביחסים, ואלימות כלפי חברים. דיווח שהוא שומע קולות. תוכנית התנהגותית ומעורבות שפ\"ח לא הועילו.",
    focus: [
      "התמכרויות בגיל הנעורים: חומרים, משחקי מחשב והימורים",
      "קושי ויסות ברמה שמפנה ל-DBT",
      "דיווח על ראייה או שמיעה של דברים שאינם - הפניה להערכה בלי פריטים נוספים",
      "אלימות - התוכנית ההתנהגותית ברמה הגבוהה",
      "כלים לצוות: מעורבות כפוגע באירוע ידוע",
      "כיוון רגשי ונפשי פתוח בלי שום מסמך בתיק - 'אבחון קודם, ועדה אחר כך'",
      "התאמות בכיתה ט': הזמן להסדיר אבחון",
    ],
    spec: () => ({
      ...school("ט", 14, "over_year"),
      a_emo: "הרבה", a_beh: "הרבה מאוד",
      q1: 2, c_attend: "frequent", q2: 2, q3: 2,
      q4: "כן", ad_s: true, ad_g: true, ad_b: true,
      ...yesOn(K.as, [1, 2, 4]), ...yesOn(K.ag, [1, 2, 3, 5, 6]), ...yesOn(K.ab, [1, 2, 4, 6]),
      q7a: "כן",
      q9: "כן", ...yesOn(K.bq, [1, 2, 3, 5, 7]),
      beh1: "הרבה", beh2: "מעט", beh3: "הרבה",
      c_regulation: 3, c_bully_perp: "known",
      c_tried: { plan: "no_help", shach: "no_help" },
      c_team: "yes",
      c_diag: [],
      c_zakaut: "none", c_hatamot: "none",
    }),
  },
  {
    id: "shira-4",
    role: "school",
    title: "שירה, כיתה ד'",
    story: "חרדה, דימוי עצמי נמוך ומצב רוח ירוד יחד, עם טקסים חוזרים. היועצת מילאה לבד, בלי ההורים, וסימנה 'לא ידוע' על חלק מהפריטים.",
    focus: [
      "כיתות ב'-ו': שלושה ממצאים רגשיים שמתאחדים להפניה משולבת",
      "התנהגויות אובססיביות-קומפולסיביות ברמה המשמעותית",
      "ההודעה על פריטים שסומנו 'לא ידוע', וההערה על מילוי בלי ההורים",
      "שני כיוונים לוועדה שממתינים למיצוי - מה כתוב על מה שחסר",
    ],
    tryAlso: [
      "במסך המאפיינים, ורבאליות 2 ומטה: ההפניה לחרדה הופכת להדרכת הורים עם תרפיה בהבעה ויצירה",
      "מוטיבציה 2: הדרכת הורים טיפולית יחד עם תרפיה בהבעה ויצירה",
    ],
    spec: () => ({
      ...school("ד", 9, "over_year"),
      a_emo: "הרבה",
      q1: 4, ...rate(K.aq, [2, 2, 2, 2, 2, 2, 2, 1, 1, 2]),
      q2: 4, q3: 4, ...yesOn(K.mq, [1, 2, 4, 5]), ...unknown("mq7", "לא"), ...unknown("mq8", "לא"),
      ...unknown("q4", "לא"),
      q5: "כן", ...rate(K.oq, [3, 3, 2, 3, 3, 2]),
      ...unknown("q8", "לא"),
      t_motiv: 5, t_verbal: 4,
      c_fill: "counselor_alone",
    }),
  },
  {
    id: "adam-2",
    role: "school",
    title: "אדם, כיתה ב'",
    story: "שינוי חד אחרי תאונת דרכים לפני כמה חודשים: סיוטים, הימנעות והרטבת לילה שחזרה. הצוות הרב-מקצועי כבר התכנס.",
    focus: [
      "שאלון הטראומה ושלוש חלופות הטיפול שמוצעות",
      "הכלי 'שינוי חד השנה'",
      "גמילה והרטבה בכיתה ב' - המסך ההתפתחותי בלי ויסות חושי",
      "הצוות הרב-מקצועי התכנס - התחנה הראשונה מסומנת 'מידע'",
    ],
    spec: () => ({
      ...school("ב", 7, "this_year"),
      a_emo: "הרבה", a_dev: "מעט",
      q1: 2, c_change: "כן", q2: 1, q3: 2,
      q6: "כן", ...rate(K.tq, [3, 3, 2, 3, 2, 1, 2, 3, 2, 2]),
      dev_toilet: "כן", dev_toilet_past: "כן", dev_toilet_type: "ב", dev_wet_type: "לילה",
      c_tried: { talks: "partial", shach: "partial" },
      c_team: "yes",
      c_zakaut: "none",
    }),
  },
  {
    id: "ella-2",
    role: "school",
    title: "אלה, כיתה ב'",
    story: "קושי חמור בחשבון וקושי בקריאה, עם רקע התפתחותי עשיר מהגן. בית הספר מיצה את מה שיכול לתת, ופסיכולוגית בית הספר כתבה חוות דעת השנה.",
    focus: [
      "א'-ג' עם ארבעה סימני רקע ומעלה - לאן מפנה קושי הקריאה",
      "פרופיל לוועדה כשהעוגן אינו קריאה: חשבון ב-5% יחד עם קריאה ב-10%",
      "ועדת זכאות כשיש בתיק מסמך קביל ועוד לא הופנתה",
      "כתב יד אחרי ריפוי בעיסוק",
    ],
    spec: today => ({
      ...school("ב", 7, "over_year"),
      a_aca: "הרבה מאוד",
      ag_read: "10% מהכי מתקשים בכיתה", ag_h1: "כן", ag_h2: "כן", ag_h3: "כן", ag_h4: "כן",
      ag_write: "כן", ag_write_ot: "כן", ag_comp: "כן", ag_math: "5% מהכי מתקשים בכיתה",
      c_support: "none", c_org: 1,
      c_aca_steps: { remedial: "done", inclusion: "done", speech: "done", ot: "done", adhd_doc: "not_needed" },
      c_tried: { tachi: "partial", parents: "partial" },
      c_team: "yes",
      c_diag: [{ kind: "פסיכולוג חינוכי", year: syStart(today) }],
      c_zakaut: "none",
    }),
  },
  {
    id: "mika-6",
    role: "school",
    title: "מיקה, כיתה ו'",
    story: "חרדה גבוהה מאוד עם קושי להיפרד מההורים, שעות ארוכות מול משחקי מחשב בלי שליטה, ואכילה מוגזמת. קשה לה לתרגל כלים לבד. הפניה לגורם חוץ לא הועילה.",
    focus: [
      "כיתות ב'-ו', חרדה ברמה הגבוהה: ההפניה נקבעת לפי יכולת התרגול",
      "חרדת היפרדות בגיל בית הספר - CBT ממוקד בשילוב הדרכת הורים",
      "התמכרות למשחקי מחשב ב-ב'-ו': שאלת השליטה, והפניה להדרכת הורים",
      "שאלון האכילה עד גיל 12",
      "המסך הלימודי של ד'-ו' עם רקע התפתחותי ואחרי קלינאית תקשורת",
      "כיוון רגשי ונפשי, ובתיק חוות דעת של פסיכולוג/ית חינוכי/ת",
    ],
    tryAlso: ["במסך המאפיינים, יכולת תרגול 3 ומעלה: ההפניה לחרדה הופכת ל-CBT בשילוב הדרכת הורים"],
    spec: today => ({
      ...school("ו", 11, "over_year"),
      a_emo: "הרבה מאוד", a_aca: "מעט",
      q1: 5, c_attend: "some",
      ...rate(K.aq, [3, 2, 3, 2, 2, 2, 2, 3, 3, 2]), q2: 2, q3: 2,
      q4: "כן", ad_g: true, ...yesOn(K.ag, [1, 2, 3, 4, 6]), q4_ctrl: 1,
      q8: "כן", ...yesOn(K.eaUnder12, [5, 7, 8]),
      t_motiv: 4, t_prac: 2,
      dv_read: "כן", dv_h2: "כן", dv_read_speech: "כן", dv_speech_motiv: "כן",
      dv_math: "10% מהכי נמוכים בכיתה",
      c_support: "partial",
      c_tried: { external: "no_help", parents: "partial" },
      c_team: "yes",
      c_diag: [{ kind: "פסיכולוג חינוכי", year: syStart(today) - 1 }],
      c_zakaut: "none",
    }),
  },
  {
    id: "tal-6",
    role: "school",
    title: "טל, כיתה ו'",
    story: "קושי בחשבון ובהבנה, קושי בקריאה עם מוטיבציה נמוכה, סימני קשב וכתב יד. הסולם הלימודי מוצה, ובתיק הערכה פסיכולוגית ישנה בלי פירוט החותם.",
    focus: [
      "המסך הלימודי של ד'-ו': שאלון המוטיבציה בקריאה, קשב וכתב יד",
      "פרופיל לוועדה בכיתות ד'-ו': חשבון ב-5% יחד עם קושי בהבנה",
      "מסמך שהקבילות שלו תלויה בהתמחות החותם - 'לבדוק מי חתום'",
      "כיוון רגשי וכיוון לימודי יחד באותו כרטיס",
    ],
    tryAlso: ["במסך 'מה קיים בתיק', להוסיף למסמך חותם 'פסיכולוג חינוכי': המסמך הופך לקביל, וכיוון שהוא ישן מופיעה ההערה לוודא מול המפקח/ת"],
    spec: today => ({
      ...school("ו", 11, "years"),
      a_emo: "מעט", a_aca: "הרבה מאוד",
      q1: 2, q2: 3, q3: 1, t_motiv: 4,
      dv_read: "כן", dv_read_motiv: "לא", dv_mot1: 3, dv_mot2: 2, dv_mot3: 3,
      dv_adhd_yn: "כן", ...adhd("dv", [1, 3, 4]),
      dv_write: "כן", dv_write_ot: "כן", dv_comp: "כן", dv_math: "5% מהכי נמוכים בכיתה",
      c_support: "none", c_org: 2,
      c_aca_steps: { remedial: "done", inclusion: "done", speech: "not_needed", ot: "done", adhd_doc: "done" },
      c_tried: { tachi: "no_help", external: "partial" },
      c_team: "yes",
      c_diag: [{ kind: "הערכה פסיכולוגית", year: syStart(today) - 7 }],
      c_zakaut: "none",
    }),
  },
  {
    id: "yael-12",
    role: "school",
    title: "יעל, כיתה י\"ב",
    story: "חשדות ואמונות יוצאות דופן שהופיעו לאחרונה, לצד קשיי קשב ולמידה מוכרים. הבקשה להתאמות הוגשה לוועדה המחוזית. למשפחה מגבלה כלכלית.",
    focus: [
      "חוויות חריגות: השער והפריטים, וההפניה להערכה",
      "כיוון נפשי (57), וההערה שרק פסיכיאטר/ית קביל/ה",
      "התאמות אחרי הגשה לוועדה המחוזית: ממתינים לתשובה",
      "אבחון פסיכו-דידקטי תקף להתאמות, ואבחנת קשב מנוירולוג/ית",
    ],
    spec: today => ({
      ...school("יב", 17, "years"),
      a_emo: "מעט", a_aca: "הרבה",
      q1: 2, q2: 2, q3: 2,
      q7b: "כן", ...yesOn(K.pq, [1, 3]),
      tyb_verbal: "20%", tyb_math: "10%", tyb_eng: "20%",
      tyb_adhd_yn: "כן", ...adhd("tyb", [1, 2, 3, 6], [2]),
      c_support: "improves", c_org: 1,
      c_aca_steps: { remedial: "done", inclusion: "in_progress" },
      c_tried: { shach: "partial", parents: "partial" },
      c_team: "yes", c_economic: "yes",
      c_diag: [{ kind: "פסיכו-דידקטי", year: syStart(today) - 3 }, { kind: "נוירולוג קשב", year: syStart(today) - 2 }],
      c_zakaut: "none", c_hatamot: "district_submitted",
    }),
  },
  {
    id: "roni-8",
    role: "school",
    title: "רוני, כיתה ח' - בלי ממצאים",
    story: "המחנכת ביקשה לבדוק תלמיד שקט שנראה מעט מופנם, ויש חשד שמציקים לו. היועצת מילאה לבד, ועל חלק מהשאלות לא היה לה מידע.",
    focus: [
      "דוח שבו לא עלה ממצא: מה נכתב, ומה מוצע",
      "ההודעה ש'לא ידוע' נספר כאילו הקושי אינו קיים",
      "כלי לצוות על חשד להצקות, גם כשהשאלון לא העלה ממצא",
      "המפה כשאין שום כיוון - התחנה הבית-ספרית בלבד, והתאמות כמידע",
    ],
    spec: () => ({
      ...school("ח", 13, "this_year"),
      a_emo: "מעט", a_soc: "מעט",
      q1: 2, c_attend: "unknown", q2: 2, q3: 1,
      ...unknown("q5", "לא"), ...unknown("q6", "לא"),
      c_isolation: 1, c_bully_victim: "suspected",
      c_fill: "counselor_alone",
    }),
  },
  {
    id: "gili-5",
    role: "school",
    title: "גילי, כיתה ה'",
    story: "משהו השתנה השנה, אבל אף אחד מהסימנים המוכרים לא עולה. הקושי קשור לקשר עם אחד ההורים. גילי לא מרבה לדבר, ומתקשה בתקשורת עם ילדים מגיל צעיר.",
    focus: [
      "שאלה 10: קשיים רגשיים אחרים, והקשר עם אחד ההורים",
      "מאפייני התלמיד/ה: מוטיבציה ורבאליות, וההפניה שנגזרת מהם",
      "שלושת סימני התקשורת בלי הסימנים הנלווים - הפניה לטיפול ולא להערכה",
      "חסר ניסיון טיפולי אחד - מה נכתב במסך 'מה כבר נעשה' ובמפה",
    ],
    tryAlso: ["במסך החברתי, לסמן 'כן' באחד מארבעת הסימנים הנלווים: מופיעה ההמלצה להערכה מקיפה"],
    spec: () => ({
      ...school("ה", 10, "this_year"),
      a_emo: "מעט", a_soc: "מעט",
      q1: 2, c_change: "כן", q2: 2, q3: 2,
      q10: "כן", q10_par: "כן",
      soc3: "כן", soc3_early: "כן", comm1: "כן", comm2: "כן", comm3: "כן",
      t_motiv: 4, t_verbal: 2,
      c_tried: { parents: "partial", talks: "helped" },
      c_team: "yes",
    }),
  },
  {
    id: "amit-10",
    role: "school",
    title: "עמית, כיתה י'",
    story: "לקות למידה מוכרת מהיסודי. משתפר בתמיכה הנוכחית. אושרו התאמות בסמכות בית הספר, והאבחון שבתיק נערך לפני שש שנים.",
    focus: [
      "התאמות בכיתה י', שנת ההגשה, אחרי אישור בסמכות בית הספר",
      "אבחון ישן: מעל חמש שנים לוועדת זכאות, ולפני תאריך הרצפה להתאמות",
      "דווח שיפור בתמיכה הלימודית - ההערה לשקול להמשיך בה לפני ועדה",
      "מסלול 'אבחון קביל' כשהאבחון הקיים אינו שמיש",
    ],
    spec: today => ({
      ...school("י", 15, "years"),
      a_aca: "הרבה מאוד",
      tyb_verbal: "5%", tyb_math: "20%", tyb_eng: "10%", tyb_write: "כן", tyb_comp: "כן",
      c_support: "improves", c_org: 1,
      c_aca_steps: { remedial: "done", inclusion: "done", speech: "not_needed", ot: "not_needed", adhd_doc: "not_needed" },
      c_tried: { tachi: "partial" },
      c_team: "yes",
      c_diag: [{ kind: "פסיכו-דידקטי", year: syStart(today) - 6, signedBy: "פסיכולוג חינוכי" }],
      c_zakaut: "considering", c_hatamot: "school_level",
    }),
  },
  {
    id: "ben-3",
    role: "school",
    title: "בן, כיתה ג'",
    story: "קושי קל בקריאה בלי רקע התפתחותי, מוטיבציה נמוכה לתרגול, סימני קשב וכתב יד קשה לקריאה. לא נעשתה בדיקת ראייה.",
    focus: [
      "א'-ג' בלי רקע התפתחותי: שאלון המוטיבציה ושאלון הקשב שנפתח אחריו",
      "ראייה שלא נבדקה ויש סימנים לקושי",
      "כתב יד והפניה לריפוי בעיסוק",
      "קושי לימודי שאינו מגיע לפרופיל של ועדה - המפה שותקת על ועדות",
    ],
    spec: () => ({
      ...school("ג", 8, "this_year"),
      a_aca: "הרבה",
      vision: "לא", vis_sym: "כן",
      ag_read: "30% מהכי מתקשים בכיתה", ag_read_motiv: "לא", ag_mot1: 1, ag_mot2: 2, ag_mot3: 1,
      ag_adhd_yn: "כן", ...adhd("ag", [1, 2, 3], [1, 2, 3, 4]),
      ag_write: "כן",
      c_support: "unknown", c_org: 3,
      c_aca_steps: { remedial: "in_progress" },
    }),
  },

  // ── גן ─────────────────────────────────────────────────────────────────────
  {
    id: "gan-toddler",
    role: "gan",
    title: "פעוט בן שנתיים, במעון",
    story: "עיכוב התפתחותי בולט ורגישות חושית, ונסיגה בגמילה. נושך ילדים אחרים לפעמים. ההורים עוד לא פנו למכון להתפתחות הילד, ושוקלים מעון יום שיקומי.",
    focus: [
      "גיל שנה-שנתיים: רק התחום ההתפתחותי וההתנהגותי נשאלים",
      "גמילה עד גיל 3 אחרי שכבר הייתה גמילה מלאה - ההמלצות להורים",
      "הערכה במכון להתפתחות הילד כתחנה ראשונה, וזמני ההמתנה",
      "מעון יום שיקומי, וקצבת ילד נכה עד גיל 3",
      "ועדת זכאות לקראת הכניסה לגן: ילידי איזו שנה, ועד מתי מפנים",
    ],
    spec: () => ({
      ...gan("פעוט", 2, "over_year"),
      a_dev: "הרבה מאוד", a_beh: "מעט",
      dev_toilet: "כן", dev_toilet_past: "כן", dev_toilet_type: "ב", dev_wet_type: "יום",
      ...sensory([1, 2, 1, 1, 2, 3, 1, 2, 2, 1], [2, 3, 3, 2, 3, 3, 3, 3]),
      beh1: "מעט", beh3: "מעט",
      c_regulation: 2, c_bully_perp: "suspected",
      c_gan_tried: { parents: "partial" },
      c_daycare: "considering",
      c_zakaut: "none",
    }),
  },
  {
    id: "gan-language",
    role: "gan",
    title: "ילדה בגן גיל 3",
    story: "קושי בביטוי, באוצר מילים ובזיהוי אותיות, וקושי בתקשורת עם ילדים. ילד אחר בגן פוגע בה. ממתינים לתור במכון להתפתחות הילד, ובתיק הערכה של קלינאית תקשורת פרטית.",
    focus: [
      "השאלות הלימודיות בגן, וההפניה לקלינאית תקשורת",
      "כיוון שפתי: רק קלינאי/ת תקשורת במכון להתפתחות הילד קביל/ה",
      "ועדת זכאות 'בהתלבטות' בלוח הזמנים של הגנים",
      "הצוות הרב-מקצועי בגן (מתי\"א) כתחנה ראשונה",
      "סימני תקשורת חלקיים - המלצה להיוועץ",
    ],
    spec: today => ({
      ...gan("גן3", 3, "this_year"),
      a_aca: "הרבה", a_soc: "מעט",
      hearing: "לא",
      gan_q1: "כן", gan_q1_speech: "כן", gan_q3: "כן", gan_q4: "כן",
      soc1: "כן", ...rate(K.lsas, [1, 1, 0, 1, 0, 1, 0, 0]),
      soc3: "כן", soc3_early: "כן", comm1: "כן",
      c_isolation: 1, c_bully_victim: "known",
      c_gan_tried: { gan_plan: "partial", parents: "partial" },
      c_devcenter: "waiting",
      c_diag: [{ kind: "קלינאית תקשורת", year: syStart(today) }],
      c_zakaut: "considering",
    }),
  },
  {
    id: "gan-autism",
    role: "gan",
    title: "ילד בגן טרום חובה",
    story: "קשיים בתקשורת מגיל צעיר, התנהגות חזרתית והיצמדות לשגרה, רגישות חושית, וקשיים לימודיים בכמה תחומים. בהערכה במכון להתפתחות הילד, עם תמיכה מסל השילוב.",
    focus: [
      "התחום החברתי: שאלות התקשורת וארבעת הסימנים הנלווים",
      "כיוון של רצף האוטיזם, ומי רשאי לחתום על האבחנה",
      "ארבעה קשיים לימודיים בגן ומעלה - ההמלצה להיוועץ על התאמת המסגרת",
      "סיכום מכון שהחותם עליו לא ידוע - 'לבדוק מי חתום'",
      "קצבת ילד נכה בעילת אוטיזם",
      "כלים לצוות הגן: ויסות, בידוד חברתי וחשד לפגיעה",
    ],
    spec: today => ({
      ...gan("גן-טרום", 4, "over_year"),
      a_aca: "הרבה", a_dev: "הרבה", a_beh: "מעט", a_soc: "הרבה מאוד",
      gan_q1: "כן", gan_q2: "כן", gan_q3: "כן", gan_q4: "כן",
      ...sensory([1, 1, 1, 2, 1, 2, 1, 2, 1, 1], [3, 2, 3, 3, 2, 3, 3, 3]),
      beh1: "מעט",
      c_regulation: 2,
      soc3: "כן", soc3_early: "כן", comm1: "כן", comm2: "כן", comm3: "כן",
      comm_rep: "כן", comm_rigid: "כן", comm_sens: "כן",
      c_isolation: 3, c_bully_victim: "suspected",
      c_gan_tried: { inclusion: "partial", paramedical: "partial" },
      c_setting: "regular_support", c_devcenter: "in_process", c_team: "yes",
      c_diag: [{ kind: "סיכום מכון התפתחות הילד", year: syStart(today) }],
      c_zakaut: "in_process",
    }),
  },
  {
    id: "gan-chova-emotional",
    role: "gan",
    title: "ילדה בגן חובה",
    story: "חרדה גבוהה ודימוי עצמי נמוך, סירוב להגיע לגן. תוכנית בגן וייעוץ של פסיכולוגית שפ\"ח לא הספיקו. הגננת שוקלת השארה בגן שנה נוספת.",
    focus: [
      "רמת קושי 'הרבה מאוד' בגן: טיפול פסיכודינאמי בשילוב הדרכת הורים",
      "כיוון רגשי-התנהגותי (55) בגן אחרי מיצוי, ומי רשאי לאבחן",
      "השארה בגן חובה שנה נוספת: התנאים, המועדים והערעור",
      "גן חובה: הזכאות שתיקבע תחול בכיתה א'",
    ],
    spec: () => ({
      ...gan("גן", 5, "over_year"),
      a_emo: "הרבה מאוד",
      q1: 4, c_attend: "refusal",
      ...rate(K.aq, [2, 2, 2, 2, 2, 1, 2, 3, 3, 2]), q2: 3, q3: 2,
      ga_consent: "כן",
      c_gan_tried: { shach: "partial", gan_plan: "no_help", parents: "partial" },
      c_team: "yes",
      c_extra_year: "considering",
      c_zakaut: "none",
    }),
  },
  {
    id: "gan-chova-eligible",
    role: "gan",
    title: "ילד בגן חובה, כבר זכאי",
    story: "לומד בגן רגיל עם סל אישי מוועדה. קושי במוטוריקה עדינה ובזכירת צורות, עצירות, וחיפוש מתמיד של תנועה ומגע. ההורים ביקשו השארה בגן, והשנה צריך לדון במעבר לכיתה א'.",
    focus: [
      "מעבר לכיתה א' של ילד שכבר זכאי - דיון מחדש בוועדה",
      "עיכוב תפקודי שנשען על שני מסמכים: פסיכולוג/ית התפתחותי/ת ומרפא/ה בעיסוק",
      "השגה על החלטה ישנה - חלון 21 הימים נסגר",
      "השארה בגן אחרי שהבקשה הוגשה",
      "עצירות, ותת-תגובתיות תחושתית",
    ],
    spec: today => ({
      ...gan("גן", 6, "years"),
      a_aca: "הרבה", a_dev: "מעט",
      gan_q2: "כן", gan_q5: "כן", gan_q5_ot: "כן",
      dev_toilet: "כן", dev_toilet_type: "א",
      ...sensory([3, 3, 2, 3, 3, 3, 3, 2, 3, 3], [1, 1, 2, 1, 1, 2, 1, 1]),
      c_gan_tried: { inclusion: "partial", paramedical: "helped" },
      c_setting: "personal_basket", c_devcenter: "done", c_team: "yes",
      c_diag: [{ kind: "פסיכולוג התפתחותי", year: syStart(today) - 2 }, { kind: "ריפוי בעיסוק", year: syStart(today) - 1 }],
      c_zakaut: "decided", c_zakaut_on: daysAgo(today, 200),
      c_extra_year: "requested",
    }),
  },
  {
    id: "gan-behavior",
    role: "gan",
    title: "ילד בגן טרום חובה - התנהגות",
    story: "נשיכות ודחיפות של ילדים אחרים, התפרצויות בחצר ובמעברים, ומריבות תכופות. שיחות עם ההורים הועילו בבית.",
    focus: [
      "התחום ההתנהגותי בגן, והתוכנית שמוצעת",
      "מריבות ברמה גבוהה בלי ממצא רגשי - ההפניה נקבעת לפי המוטיבציה",
      "כלים לצוות הגן: ויסות, ופגיעה בילדים אחרים באירוע ידוע",
      "ממצא התנהגותי וחברתי בלבד - המפה מציגה את התחנה הראשונה בלבד",
    ],
    spec: () => ({
      ...gan("גן-טרום", 4, "this_year"),
      a_beh: "הרבה מאוד", a_soc: "הרבה",
      beh1: "מעט", beh2: "הרבה", beh3: "הרבה",
      c_regulation: 3, c_bully_perp: "known",
      soc2: "כן", soc2_sev: 5,
      t_motiv: 2,
      c_gan_tried: { parents: "helped" },
    }),
  },
  {
    id: "gan-pending",
    role: "gan",
    title: "ילדה בגן טרום חובה - חרדה",
    story: "חרדה ובכי בפרידה, בריחת צואה שהתחילה לאחרונה, ושינוי חד מאז לידת אח. היא לא מוכנה לטיפול, גם לא עם הורה. עוד לא נוסה טיפול.",
    focus: [
      "הפניה בגיל הגן כשהילד/ה לא מסכים/ה לטיפול גם עם הורה",
      "בריחת צואה - ההפניות בתחום הגמילה",
      "כיוון רגשי בגן שממתין למיצוי, וההסבר על התערבות ש'הועילה'",
      "'לא ידוע' על המכון ועל הצוות הרב-מקצועי",
    ],
    spec: () => ({
      ...gan("גן-טרום", 4, "this_year"),
      a_emo: "הרבה", a_dev: "מעט",
      q1: 3, c_attend: "some", c_change: "כן",
      ...rate(K.aq, [2, 2, 1, 2, 2, 1, 1, 3, 2, 2]), q2: 2, q3: 1,
      ga_consent: "לא", ga_consent_parent: "לא",
      dev_toilet: "כן", dev_toilet_type: "ג",
      c_gan_tried: { parents: "helped" },
      c_devcenter: "unknown", c_team: "unknown",
    }),
  },
  {
    id: "gan-rehab",
    role: "gan",
    title: "פעוטה בת שנתיים, במעון יום שיקומי",
    story: "מוגבלות שכלית התפתחותית שנקבעה בוועדת אבחון. משובצת במעון יום שיקומי, וההליך מול ועדת זכאות לקראת הגן כבר התחיל.",
    focus: [
      "כיוון שמגיע מהתיק ולא מהשאלון: החלטת ועדת אבחון",
      "מעון יום שיקומי כשהפעוטה כבר משובצת בו",
      "ועדת זכאות לקראת הכניסה לגן, כשההליך בעיצומו",
      "מה נשאל בגיל הזה במסך 'מה כבר נעשה'",
    ],
    spec: today => ({
      ...gan("פעוט", 2, "years"),
      a_dev: "הרבה מאוד",
      c_gan_tried: { paramedical: "partial", emotional: "partial" },
      c_setting: "rehab_daycare", c_devcenter: "done",
      c_diag: [{ kind: "ועדת אבחון - חוק הסעד", year: syStart(today) }, { kind: "נוירולוג ילדים והתפתחות", year: syStart(today) - 1 }],
      c_daycare: "attends",
      c_zakaut: "in_process",
    }),
  },
];

/** The full answers of a case, as a counsellor who clicked it through would have left them. */
export function caseAnswers(c: ReviewCase, today: string): Ans {
  return completeAnswers(c.spec(today));
}

export function findCase(id: string | null | undefined): ReviewCase | undefined {
  return REVIEW_CASES.find(c => c.id === id);
}
