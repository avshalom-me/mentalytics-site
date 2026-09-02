/**
 * שאלון היועצות: התשובות, התוויות, ההמרה לקלט המנוע, וטיוטת הסיכום להפניה.
 *
 * Pure, and the only place that knows both the answer keys the screens write
 * and the vocabulary the tracks engine reads. The screens in app/school render
 * these labels; the summary below is what a counsellor pastes into her own
 * referral document. No answer here is free text - that is how the rubric
 * stays anonymous by construction rather than by warning.
 */

import {
  DIAGNOSIS_KINDS,
  formatDateHe,
  type Diagnosis,
  type DiagnosisKind,
  type SchoolGrade,
  type SchoolTrack,
  type SchoolTracksInput,
} from "./school-tracks";

export type Role = "counselor" | "psychologist" | "teacher" | "other";
export type FillMode = "counselor_alone" | "with_parent" | "phone_parent";
export type Parents = "aware_consent" | "aware_no_consent" | "not_aware";
export type Initiator = "teacher" | "parents" | "student" | "counselor" | "external";
export type Duration = "this_year" | "over_year" | "years";
/** כלל לא / מעט / הרבה / הרבה מאוד - the four-point scale the kids questionnaire uses for its areas. */
export type Level = 0 | 1 | 2 | 3;
export type Outcome = "not_tried" | "helped" | "partial" | "no_help";

export const INTERVENTIONS = [
  { key: "talks", label: "שיחות פרטניות עם מחנכ/ת או יועצת" },
  { key: "plan", label: "תוכנית התנהגותית או רגשית בית-ספרית" },
  { key: "tachi", label: "תוכנית אישית (תח\"י)" },
  { key: "therapy_school", label: "טיפול רגשי בבית הספר (סל שילוב, טיפול באמנויות)" },
  { key: "shach", label: "מעורבות שפ\"ח או פסיכולוג/ית בית הספר" },
  { key: "remedial", label: "הוראה מתקנת או תגבור לימודי" },
  { key: "parents", label: "תיווך ושיחות עם ההורים" },
  { key: "external", label: "הפניה קודמת לגורם חוץ" },
] as const;
export type InterventionKey = (typeof INTERVENTIONS)[number]["key"];

export interface SchoolAnswers {
  // S1
  role?: Role;
  fillMode?: FillMode;
  parents?: Parents;
  initiator?: Initiator;
  grade?: SchoolGrade;
  gender?: "זכר" | "נקבה";
  duration?: Duration;
  // S2
  attendance?: "regular" | "some" | "frequent";
  lateness?: "no" | "some" | "frequent";
  refusal?: "no" | "signs" | "clear";
  cls_attention?: Level;
  cls_org?: Level;
  cls_authority?: Level;
  cls_regulation?: Level;
  soc_isolation?: Level;
  soc_conflict?: Level;
  bully_victim?: "no" | "suspected" | "known";
  bully_perp?: "no" | "suspected" | "known";
  emo_internal?: Level;
  emo_external?: Level;
  emo_change?: "no" | "yes";
  acad_gap?: Level;
  acad_response?: "improves" | "partial" | "none" | "not_given";
  safety?: "no" | "yes" | "unknown";
  // S3
  interventions?: Partial<Record<InterventionKey, Outcome>>;
  // S4
  diagnoses?: Diagnosis[];
  schoolTeam?: "yes" | "no" | "unknown";
  zakautStatus?: "none" | "in_process" | "decided";
  zakautDecisionOn?: string;
  hatamotStatus?: "none" | "school_level" | "district_submitted" | "district_decided";
  hatamotAnswerOn?: string;
  supports?: string[];
  health?: string[];
  fam_cooperation?: "good" | "partial" | "poor" | "unknown";
  fam_economic?: "no" | "yes" | "unknown";
  fam_welfare?: "no" | "yes" | "unknown";
}

// ── Labels ───────────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<Role, string> = {
  counselor: "יועצת חינוכית", psychologist: "פסיכולוג/ית חינוכי/ת", teacher: "מחנכ/ת", other: "איש/אשת צוות חינוכי",
};
export const FILL_MODE_LABELS: Record<FillMode, string> = {
  counselor_alone: "מילוי עצמאי, ללא ההורים", with_parent: "מילוי יחד עם ההורים", phone_parent: "מילוי בשיחת טלפון עם הורה",
};
export const PARENTS_LABELS: Record<Parents, string> = {
  aware_consent: "ההורים מודעים לפנייה והסכימו לתהליך",
  aware_no_consent: "ההורים מודעים, טרם התקבלה הסכמה",
  not_aware: "ההורים טרם יודעו",
};
export const INITIATOR_LABELS: Record<Initiator, string> = {
  teacher: "המחנכ/ת", parents: "ההורים", student: "התלמיד/ה", counselor: "היועצת", external: "גורם חיצוני",
};
export const DURATION_LABELS: Record<Duration, string> = { this_year: "מהשנה", over_year: "מעל שנה", years: "מספר שנים" };
export const LEVEL_LABELS = ["כלל לא", "מעט", "הרבה", "הרבה מאוד"] as const;
export const ATTENDANCE_LABELS = { regular: "סדיר", some: "היעדרויות מדי פעם", frequent: "היעדרויות תכופות" } as const;
export const LATENESS_LABELS = { no: "אין", some: "מדי פעם", frequent: "תכופים" } as const;
export const REFUSAL_LABELS = { no: "אין", signs: "סימנים", clear: "מובהקת" } as const;
export const BULLY_LABELS = { no: "לא", suspected: "חשד", known: "ידוע" } as const;
export const CHANGE_LABELS = { no: "לא", yes: "כן" } as const;
export const RESPONSE_LABELS = { improves: "משתפר/ת", partial: "שיפור חלקי", none: "ללא שיפור", not_given: "לא ניתנה תמיכה" } as const;
export const SAFETY_LABELS = { no: "לא", yes: "כן", unknown: "לא ידוע" } as const;
export const OUTCOME_LABELS: Record<Outcome, string> = { not_tried: "לא נוסה", helped: "הועיל", partial: "הועיל חלקית", no_help: "לא הועיל" };
export const TEAM_LABELS = { yes: "התכנס", no: "לא התכנס", unknown: "לא ידוע" } as const;
export const ZAKAUT_LABELS = { none: "לא הופנה/תה", in_process: "בתהליך", decided: "התקבלה החלטה" } as const;
export const HATAMOT_LABELS = {
  none: "לא נדון", school_level: "אושרו התאמות בסמכות בית הספר", district_submitted: "הוגש לוועדה המחוזית", district_decided: "התקבלה תשובת הוועדה המחוזית",
} as const;
export const COOPERATION_LABELS = { good: "טוב", partial: "חלקי", poor: "מועט", unknown: "לא ידוע" } as const;
export const YES_NO_UNKNOWN_LABELS = { no: "לא", yes: "כן", unknown: "לא ידוע" } as const;
export const SUPPORT_OPTIONS = ["סייעת", "שילוב / מתי\"א", "הוראה מתקנת", "מלווה אישי/ת"] as const;
export const HEALTH_OPTIONS = ["מעקב נוירולוג/ית", "מעקב פסיכיאטר/ית", "טיפול תרופתי", "טיפול בבריאות הנפש בקופת החולים", "טיפול רגשי פרטי"] as const;

/** What a counsellor may say the student already has - the questionnaire's own keys, minus the two with no school meaning. */
export const SCHOOL_DIAGNOSIS_KINDS: DiagnosisKind[] = DIAGNOSIS_KINDS.filter(k => k !== "אבחון תעסוקתי" && k !== "הערכת בשלות לגן");

export const DIAGNOSIS_KIND_LABELS: Record<DiagnosisKind, string> = {
  "פסיכו-דידקטי": "אבחון פסיכו-דידקטי",
  "פסיכו-דיאגנוסטי": "אבחון פסיכו-דיאגנוסטי",
  "נוירו-פסיכולוגי": "אבחון נוירו-פסיכולוגי",
  "אבחון תעסוקתי": "אבחון תעסוקתי",
  "הערכה פסיכולוגית": "הערכה פסיכולוגית",
  "הערכת בשלות לגן": "הערכת בשלות לגן",
  "אבחון קשיי תקשורת ASD": "אבחון תקשורת / ASD",
  "נוירולוג קשב": "אבחנה של נוירולוג/ית ילדים (קשב)",
  "פסיכיאטר ילדים": "אבחנה של פסיכיאטר/ית ילדים ונוער",
  "פסיכולוג חינוכי": "חוות דעת של פסיכולוג/ית חינוכי/ת או התפתחותי/ת",
  "פסיכולוג קליני": "חוות דעת של פסיכולוג/ית קליני/ת",
};

export const RELEVANCE_LABELS = { primary: "לטיפול עכשיו", consider: "לשיקול", info: "מידע" } as const;

// ── Engine input ─────────────────────────────────────────────────────────────

/** Count of interventions the counsellor reported as tried, whatever their outcome. */
export function interventionsTried(A: SchoolAnswers): number {
  return Object.values(A.interventions ?? {}).filter(o => o && o !== "not_tried").length;
}

export function toTracksInput(A: SchoolAnswers, today: string): SchoolTracksInput | null {
  if (!A.grade) return null;
  return {
    grade: A.grade,
    today,
    diagnoses: A.diagnoses ?? [],
    schoolTeam: A.schoolTeam ? { convened: A.schoolTeam === "yes" } : undefined,
    zakaut: A.zakautStatus
      ? { status: A.zakautStatus, decisionReceivedOn: A.zakautDecisionOn || undefined }
      : undefined,
    hatamot: A.hatamotStatus
      ? { status: A.hatamotStatus, districtAnswerReceivedOn: A.hatamotAnswerOn || undefined }
      : undefined,
    interventionsTried: interventionsTried(A),
    economicConstraint: A.fam_economic === "yes",
    risk: {
      suicidality: A.safety === "yes",
      schoolRefusal: A.refusal === "signs" || A.refusal === "clear",
    },
  };
}

// ── The summary a counsellor pastes ──────────────────────────────────────────

export interface SchoolSummary {
  /** Plain text with line breaks - what lands in a plain editor. */
  text: string;
  /** The same content as simple HTML - what lands in Word or Google Docs. */
  html: string;
}

type Section = { title: string; lines: string[] };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function studentWord(A: SchoolAnswers): string {
  return A.gender === "זכר" ? "התלמיד" : A.gender === "נקבה" ? "התלמידה" : "התלמיד/ה";
}

function levelLine(label: string, v: Level | undefined): string | null {
  return v === undefined || v === 0 ? null : `${label}: ${LEVEL_LABELS[v]}`;
}

export function buildSchoolSummary(A: SchoolAnswers, tracks: SchoolTrack[], today: string): SchoolSummary {
  const S = studentWord(A);
  const sections: Section[] = [];

  // רקע
  const bg: string[] = [];
  if (A.grade) bg.push(`כיתה ${A.grade}${A.gender ? `, ${A.gender === "זכר" ? "בן" : "בת"}` : ""}`);
  if (A.duration) bg.push(`משך הקושי: ${DURATION_LABELS[A.duration]}`);
  if (A.initiator) bg.push(`הפנייה נפתחה ביוזמת ${INITIATOR_LABELS[A.initiator]}`);
  if (A.parents) bg.push(PARENTS_LABELS[A.parents]);
  if (bg.length) sections.push({ title: "רקע", lines: bg });

  // תפקוד בבית הספר
  const school: string[] = [];
  const att: string[] = [];
  if (A.attendance && A.attendance !== "regular") att.push(ATTENDANCE_LABELS[A.attendance]);
  if (A.lateness && A.lateness !== "no") att.push(`איחורים ${LATENESS_LABELS[A.lateness]}`);
  if (A.refusal && A.refusal !== "no") att.push(`סרבנות בית ספר ${A.refusal === "clear" ? "מובהקת" : "- סימנים"}`);
  if (att.length) school.push(`ביקור סדיר: ${att.join("; ")}`);
  else if (A.attendance === "regular") school.push("ביקור סדיר: תקין");

  const cls = [
    levelLine("קשב והתמדה בשיעור", A.cls_attention),
    levelLine("התארגנות", A.cls_org),
    levelLine("התנהלות מול סמכות", A.cls_authority),
    levelLine("ויסות רגשי בכיתה ובהפסקות", A.cls_regulation),
  ].filter((x): x is string => !!x);
  if (cls.length) school.push(`בכיתה - ${cls.join("; ")}`);

  const soc = [levelLine("בידוד או דחייה חברתית", A.soc_isolation), levelLine("חיכוכים עם בני הגיל", A.soc_conflict)].filter((x): x is string => !!x);
  if (A.bully_victim && A.bully_victim !== "no") soc.push(`נפגע/ת מהצקות או חרם: ${BULLY_LABELS[A.bully_victim]}`);
  if (A.bully_perp && A.bully_perp !== "no") soc.push(`מעורבות כפוגע/ת: ${BULLY_LABELS[A.bully_perp]}`);
  if (soc.length) school.push(`חברתי - ${soc.join("; ")}`);

  const emo = [levelLine("מופנמות, עצב או חרדה נצפית", A.emo_internal), levelLine("החצנה והתפרצויות", A.emo_external)].filter((x): x is string => !!x);
  if (A.emo_change === "yes") emo.push("שינוי חד בהתנהגות או במצב הרוח השנה");
  if (emo.length) school.push(`רגשי, כפי שנצפה בבית הספר - ${emo.join("; ")}`);

  const acad: string[] = [];
  const gap = levelLine("פער לימודי ביחס לכיתה", A.acad_gap);
  if (gap) acad.push(gap);
  if (A.acad_response) acad.push(`תגובה לתמיכה שניתנה: ${RESPONSE_LABELS[A.acad_response]}`);
  if (acad.length) school.push(`לימודי - ${acad.join("; ")}`);

  if (A.safety === "yes") school.push(`עלה חשש לפגיעה עצמית או אמירות אובדניות - דווח לגורמים המוסמכים בבית הספר לפי הנוהל`);
  if (school.length) sections.push({ title: "תפקוד בבית הספר", lines: school });

  // התערבויות
  const tried: string[] = [];
  const notTried: string[] = [];
  for (const it of INTERVENTIONS) {
    const o = A.interventions?.[it.key];
    if (!o || o === "not_tried") notTried.push(it.label);
    else tried.push(`${it.label}: ${OUTCOME_LABELS[o]}`);
  }
  if (tried.length || A.interventions) {
    const lines = [...tried];
    if (notTried.length && tried.length) lines.push(`טרם נוסו: ${notTried.join(", ")}`);
    if (!tried.length) lines.push("טרם נוסו התערבויות בית-ספריות");
    sections.push({ title: "התערבויות שנוסו בבית הספר", lines });
  }

  // אבחונים, ועדות, תמיכות
  const docs: string[] = [];
  for (const d of A.diagnoses ?? []) {
    docs.push(`${DIAGNOSIS_KIND_LABELS[d.kind]} (${d.year})${d.signedBy ? `, חתום/ה: ${d.signedBy}` : ""}`);
  }
  if (!docs.length && A.diagnoses) docs.push("אין אבחונים או חוות דעת בתיק");
  if (A.schoolTeam) docs.push(`צוות רב-מקצועי: ${TEAM_LABELS[A.schoolTeam]}`);
  if (A.zakautStatus) docs.push(`ועדת זכאות ואפיון: ${ZAKAUT_LABELS[A.zakautStatus]}${A.zakautStatus === "decided" && A.zakautDecisionOn ? ` (${formatDateHe(A.zakautDecisionOn)})` : ""}`);
  if (A.hatamotStatus) docs.push(`התאמות בדרכי היבחנות: ${HATAMOT_LABELS[A.hatamotStatus]}`);
  if (A.supports?.length) docs.push(`תמיכות פעילות: ${A.supports.join(", ")}`);
  if (A.health?.length) docs.push(`מעקב וטיפול מחוץ לבית הספר: ${A.health.join(", ")}`);
  if (docs.length) sections.push({ title: "אבחונים, ועדות ותמיכות", lines: docs });

  // משפחה
  const fam: string[] = [];
  if (A.fam_cooperation && A.fam_cooperation !== "unknown") fam.push(`שיתוף פעולה הורי: ${COOPERATION_LABELS[A.fam_cooperation]}`);
  if (A.fam_welfare === "yes") fam.push("המשפחה מוכרת לרווחה");
  if (A.fam_economic === "yes") fam.push("קיימת מגבלה כלכלית מוכרת");
  if (fam.length) sections.push({ title: "המשפחה", lines: fam });

  // מסלולים
  const active = tracks.filter(t => t.relevance !== "info");
  if (active.length) {
    sections.push({
      title: "מסלולים לבדיקה",
      lines: active.map(t => `${t.name} (${RELEVANCE_LABELS[t.relevance]})${t.deadline ? ` - ${t.deadline.label}` : ""}`),
    });
  }

  const head = `סיכום לקראת הפניה - ${S}`;
  const meta = `נוצר בעזרת "טיפול חכם" ב-${formatDateHe(today)}${A.role ? `, על סמך דיווח של ${ROLE_LABELS[A.role]}` : ""}${A.fillMode ? ` (${FILL_MODE_LABELS[A.fillMode]})` : ""}.`;
  const foot = "הסיכום מבוסס על דיווח הממלא/ת בלבד. הוא אינו אבחון, אינו קובע זכאות ואינו מחליף הערכה מקצועית או החלטת ועדה. אינו מכיל פרטים מזהים.";

  const text = [
    head, meta, "",
    ...sections.flatMap(s => [s.title, ...s.lines.map(l => `- ${l}`), ""]),
    foot,
  ].join("\n");

  const html = [
    `<h2>${esc(head)}</h2>`,
    `<p><em>${esc(meta)}</em></p>`,
    ...sections.map(s => `<h3>${esc(s.title)}</h3><ul>${s.lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul>`),
    `<p><small>${esc(foot)}</small></p>`,
  ].join("");

  return { text, html };
}
