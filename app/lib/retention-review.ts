import { CITY_TO_REGION } from "./regions";
import { isMobileNumber, phoneNationalDigits } from "./phone";
import { detectProfileGapsDetailed, type ProfileGapKey } from "./profile-gaps";

// סקירת השימור השבועית - המנוע הטהור (docs/agents/retention-agent-plan.md).
//
// מקבל לכל מקודם את שורת המשפך שלו (retention_therapist_funnel), את מצב
// החיוב, את הביקוש באזוריו ואת הבנצ'מרק, ומחזיר: חשיבות (למי זה חשוב לנו),
// סיכון (כמה קרוב לביטול), דגלים עם ראיות ובעלים, ופעולות עם טיוטה מוכנה.
// בלי מסד ובלי מודל, כדי שכל כלל כאן ייבדק ב-vitest ויהיה זהה בכל ריצה.
// הטעינה והכתיבה ב-retention-review-data.ts; הכפתורים ב-retention-actions.ts.
//
// שלושה עקרונות שהקוד הזה שומר:
//   1. פניות = אנשים (לפי session), לא לחיצות; ולא לחיצות אוטומטיות.
//   2. "חשיפה נמוכה" נמדדת מול עמיתים (משלם פרטי, ותק 30 יום), ובאותו אזור
//      כשיש מספיק עמיתים שם - מטפל בעמק לא נמדד מול גוש דן.
//   3. טיוטת מייל למטפל לא מכילה אף מספר על הביצועים שלו (החלטת הבעלים
//      15/8/26): היא מנוסחת סביב השיפור, ואחוזי ביקוש כלליים מותרים.

export type ReviewTier = "high" | "medium" | "center";
export type ReviewRisk = "critical" | "high" | "medium" | "ok" | "new" | "paused";
export type FlagOwner = "therapist" | "us" | "market";
export type FlagSeverity = "critical" | "high" | "normal";
export type ReviewActionType = "fix" | "freeze" | "email" | "task" | "campaign" | "extend";

export type ReviewFlag = {
  key: string;
  severity: FlagSeverity;
  owner: FlagOwner;
  /** כותרת קצרה לצ'יפ בטבלה. */
  label: string;
  /** משפט עם המספרים שמאחורי הדגל - לנו, לא למטפל. */
  detail: string;
  /** פסקה למייל למטפל - רק לדגל שבאחריותו ובלי מספרי ביצועים. */
  emailParagraph?: string;
};

export type ReviewAction = {
  type: ReviewActionType;
  title: string;
  detail: string;
  /** מייל: נושא וגוף הטיוטה. */
  subject?: string;
  body?: string;
  /** הקפאה: ימים מוצעים. */
  days?: number;
  /** קמפיין / תיקון: לאן הכפתור מוביל. */
  link?: string;
  region?: string;
};

export type FunnelRow = {
  cards_cur: number;
  cards_prev: number;
  list_cur: number;
  list_prev: number;
  opens_cur: number;
  opens_prev: number;
  people_cur: number;
  people_prev: number;
  people_21: number;
  people_14: number;
  certain_cur: number;
  clicks_cur: number;
  paid_people_cur: number;
  paid_cards_cur: number;
  avg_score_cur: number | null;
  last_contact_at: string | null;
  first_card_at: string | null;
};

export const EMPTY_FUNNEL: FunnelRow = {
  cards_cur: 0, cards_prev: 0, list_cur: 0, list_prev: 0, opens_cur: 0, opens_prev: 0,
  people_cur: 0, people_prev: 0, people_21: 0, people_14: 0, certain_cur: 0, clicks_cur: 0,
  paid_people_cur: 0, paid_cards_cur: 0, avg_score_cur: null, last_contact_at: null, first_card_at: null,
};

export type TherapistInput = {
  id: string;
  name: string;
  status: string | null;
  promotion_source: string | null;
  entity_type: string | null;
  center_account_id: string | null;
  promoted_since: string | null;
  promoted_until: string | null;
  created_at: string;
  admin_approved: boolean | null;
  accepting_new_patients: boolean | null;
  online: boolean | null;
  /** ערים (therapists.regions מחזיק ערים; האזור נגזר דרך CITY_TO_REGION). */
  cities: string[];
  training_areas: string[];
  age_groups: string[];
  bio: string | null;
  profile_photo_path: string | null;
  education: string | null;
  experience: string | null;
  phone: string | null;
  email: string | null;
  match_paused_until: string | null;
  /** המנוי הפעיל, אם יש. */
  subscription: { first_charge_on: string | null; promo_reverts_at: string | null } | null;
  /** חלון ערבות הפניות (משלם פרטי בלבד): ימים שנותרו ופניות בתוכו. */
  guarantee: { daysLeft: number; contacts: number } | null;
  funnel: FunnelRow | null;
  /** מתי יצא למטפל/ת המייל היזום האחרון מאיתנו (כל סוכן). */
  lastOutreachAt: string | null;
};

export type Benchmark = { peers: number; cards: number; opens: number; people: number; avgScore: number | null };

export type RegionDemand = {
  searches: number;
  online: number;
  treatmentSessions: number;
  treatments: { t: string; n: number }[];
};

export type ReviewContext = {
  now: Date;
  windowDays: number;
  benchmark: Benchmark | null;
  /** בנצ'מרק לכל אזור (רק אזור עם REGION_BENCHMARK_MIN_PEERS עמיתים). */
  regionBenchmarks: Record<string, Benchmark>;
  demand: Record<string, RegionDemand>;
  demandTotal: number;
  onlineShare: number;
  /** שם החג כשהשבוע הנסקר כולל חג - הירידה אז אינה אישית. */
  holidayWeek: string | null;
  emailCooldownDays: number;
};

export type ReviewMetrics = FunnelRow & {
  tenureDays: number;
  regions: string[];
  /** הופעות כרטיס מנורמלות ל-30 יום (מטפל צעיר מחודש). */
  cards30: number;
  cardsBenchmark: number | null;
  benchmarkScope: "region" | "all" | null;
  /** נתח הכרטיסים של המטפל/ת מתוך כל המקודמים באזור הראשי שלו/ה. */
  regionCardShare: number | null;
  regionPromoted: number;
  daysSinceContact: number | null;
  daysToFirstCharge: number | null;
  daysToPromotionEnd: number | null;
  daysToPriceRevert: number | null;
  guaranteeDaysLeft: number | null;
  guaranteeContacts: number | null;
  paused: boolean;
  pausedUntil: string | null;
};

export type ReviewRow = {
  therapist_id: string;
  name: string;
  tier: ReviewTier;
  risk: ReviewRisk;
  promotion_source: string | null;
  metrics: ReviewMetrics;
  flags: ReviewFlag[];
  actions: ReviewAction[];
  primary_action: ReviewActionType | null;
  /** למה הסיכון הוא מה שהוא - משפט אחד לטבלה. */
  risk_reason: string;
  /** מה לעשות - משפט אחד, הדבר הכי חשוב (או 2-3), לשורה הסגורה. */
  todo: string;
};

export type ReviewSummary = {
  checked: number;
  byTier: Record<ReviewTier, number>;
  byRisk: Record<ReviewRisk, number>;
  actions: number;
  holidayWeek: string | null;
  /** מי לא נבדק/ת בכוונה: מושהים (לא מקבלים מטופלים) ולא מאושרים. */
  excluded: { suspended: number; unapproved: number };
};

// ── ספים. כל אחד מתועד כדי שלא יזוז בלי סיבה ───────────────────────────────

/** מתחת לזה ימי ותק אין ציון סיכון, יש צ'קליסט קליטה. */
export const MIN_TENURE_DAYS = 14;
/** "בלי פניות בכלל": החלון של הבעלים - שלושה שבועות. */
export const NO_CONTACT_DAYS = 21;
/** חשיפה נמוכה: הופעות כרטיס מתחת ל-40% מהבנצ'מרק... */
export const LOW_EXPOSURE_RATIO = 0.4;
/** ...וגם פחות מזה פניות ב-21 יום (מעט חשיפות עם מספיק פניות = בסדר). */
export const LOW_EXPOSURE_OK_CONTACTS = 2;
/** רגע כסף: ערבות / חיוב ראשון / עליית מחיר בטווח הזה מעלים לסיכון גבוה. */
export const BILLING_SOON_DAYS = 21;
/** סוף תקופת ניסיון בטווח הזה = רגע ההמרה (ואז גם החשיבות גבוהה). */
export const TRIAL_END_SOON_DAYS = 14;
/** ירידה: היו לפחות כך בתקופה הקודמת, ועכשיו עד שליש. */
export const DROP_MIN_PREVIOUS = 5;
export const DROP_RATIO = 1 / 3;
/** שקט ארוך: שישה שבועות בלי פנייה = סיכון גבוה גם בלי רגע כסף. */
export const LONG_SILENCE_DAYS = 42;
/** ביקוש נמוך באזור (כמו center-health). */
export const LOW_DEMAND_SEARCHES = 30;
/** בנצ'מרק אזורי רק עם לפחות כך עמיתים באזור. */
export const REGION_BENCHMARK_MIN_PEERS = 3;
/** דחיקה: מקודם אחד עם נתח כזה מהכרטיסים באזור, ועם פניות, כשיש לפחות 4 מקודמים. */
export const CROWD_SHARE = 0.35;
export const CROWD_MIN_CONTACTS_14 = 5;
export const CROWD_MIN_PROMOTED = 4;
/** כרטיס שלא נפתח: מספיק כרטיסים כדי לשפוט, ומעבר לפרופיל מתחת לחצי מהעמיתים. */
export const CARD_MIN_FOR_CTR = 20;
export const CTR_RATIO = 0.5;
/** פרופיל שלא ממיר: מספיק כניסות ואפס אנשים. */
export const OPENS_MIN_FOR_CONVERSION = 15;
/** התאמת שיטות: שיטה שהומלצה לנתח כזה מהשאלונים באזור, מתוך לפחות כך שאלונים. */
export const TREATMENT_SHARE = 0.25;
export const TREATMENT_MIN_SESSIONS = 10;
/** דירוג נמוך: ציון התאמה ממוצע נמוך מהעמיתים בכך נקודות, עם מספיק כרטיסים. */
export const LOW_RANK_GAP = 6;
export const LOW_RANK_MIN_CARDS = 10;
/** תלות בממומן: נתח כזה מהכרטיסים מגיע ממבקרים ממומנים. */
export const PAID_DEPENDENCE_SHARE = 0.8;
/** מטפל/ת חדש/ה שאחרי כך ימים עדיין לא הופיע/ה באף כרטיס - משהו אצלנו. */
export const NO_FIRST_CARD_DAYS = 7;
export const FREEZE_DAYS = 7;
export const EMAIL_MAX_PARAGRAPHS = 3;

const RISK_RANK: Record<ReviewRisk, number> = { critical: 0, high: 1, medium: 2, new: 3, paused: 4, ok: 5 };
const TIER_RANK: Record<ReviewTier, number> = { high: 0, center: 1, medium: 2 };
const SEVERITY_RANK: Record<FlagSeverity, number> = { critical: 0, high: 1, normal: 2 };
const ACTION_RANK: Record<ReviewActionType, number> = { fix: 0, freeze: 1, email: 2, extend: 3, task: 4, campaign: 5 };

export const TIER_LABELS: Record<ReviewTier, string> = { high: "משלמים ובמסלול לתשלום", center: "מכונים", medium: "מקודמים במתנה" };
export const RISK_LABELS: Record<ReviewRisk, string> = {
  critical: "קריטי", high: "סיכון גבוה", medium: "סיכון בינוני", ok: "תקין", new: "חדש/ה", paused: "מוקפא/ת",
};
export const SOURCE_LABELS: Record<string, string> = {
  paid: "משלם/ת", gift_trial: "מתנה עם כרטיס", trial: "ניסיון", manual: "קידום ידני", center: "מרכז",
};

// ── עזרים ──────────────────────────────────────────────────────────────────

function daysBetween(fromIso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(fromIso).getTime()) / 86_400_000);
}
function daysUntil(iso: string, now: Date): number {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000);
}
function ilDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" });
}
function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** האזורים של מטפל/ת מתוך הערים בפרופיל, בלי כפילויות ובסדר קבוע. */
export function regionsOf(cities: string[]): string[] {
  const out = new Set<string>();
  for (const c of cities) {
    const r = CITY_TO_REGION[c];
    if (r) out.add(r);
  }
  return [...out];
}

/**
 * חשיבות: למי זה חשוב לנו. null = לא בסקירה (חינמי, לא מקודם).
 * שתי קבוצות ברורות (הבעלים, 11/10/26 אחרי הריצה הראשונה): מי שמשלם או במסלול
 * שמגיע לתשלום (paid, gift_trial), ומקודמי מתנה (trial, manual) - פחות דחופים
 * משמעותית, גם כשהניסיון שלהם מסתיים. מכונים בקבוצה משלהם.
 */
export function tierOf(t: Pick<TherapistInput, "status" | "promotion_source" | "entity_type">): ReviewTier | null {
  if (t.entity_type === "center" || t.promotion_source === "center") return t.status === "paying" ? "center" : null;
  if (t.status !== "paying") return null;
  if (t.promotion_source === "paid" || t.promotion_source === "gift_trial") return "high";
  return "medium";
}

/**
 * מי לא נבדק/ת בכלל: מושהה/ית (accepting_new_patients=false) או לא מאושר/ת
 * לרישום. ההשהיה היא החלטה (של המטפל/ת או שלנו), לא סיכון; המאושרים-בהמתנה
 * כבר בתור העבודה בלוח הבקרה.
 */
export function excludedFromReview(t: Pick<TherapistInput, "accepting_new_patients" | "admin_approved">): "suspended" | "unapproved" | null {
  if (t.accepting_new_patients === false) return "suspended";
  if (t.admin_approved === false) return "unapproved";
  return null;
}

function benchmarkFor(regions: string[], ctx: ReviewContext): { bench: Benchmark | null; scope: "region" | "all" | null } {
  const regional = regions.map((r) => ctx.regionBenchmarks[r]).filter((b): b is Benchmark => Boolean(b));
  if (regional.length > 0) {
    // ממוצע הבנצ'מרקים של אזורי המטפל/ת - מי שפעיל בשני אזורים נמדד מול שניהם.
    const n = regional.length;
    return {
      bench: {
        peers: Math.min(...regional.map((b) => b.peers)),
        cards: round1(regional.reduce((s, b) => s + b.cards, 0) / n),
        opens: round1(regional.reduce((s, b) => s + b.opens, 0) / n),
        people: round1(regional.reduce((s, b) => s + b.people, 0) / n),
        avgScore: ctx.benchmark?.avgScore ?? null,
      },
      scope: "region",
    };
  }
  return { bench: ctx.benchmark, scope: ctx.benchmark ? "all" : null };
}

type ProfileGapTexts = Partial<Record<ProfileGapKey, string>>;

// הפסקאות למייל לפי פער. הטקסטים של profile-gaps נכתבו למייל הקליטה ונשארים
// שם; כאן הניסוח רגוע יותר, כי הנמען/ת כבר לקוח/ה.
const GAP_EMAIL: ProfileGapTexts = {
  photo: "בפרופיל אין תמונה. תמונה מקצועית, שרואים בה פנים, היא הדבר הראשון שמטופלים מסתכלים עליו בכרטיס ובפרופיל.",
  bio: "הביוגרפיה בפרופיל קצרה. שתי השורות הראשונות שלה מופיעות בכרטיס בתוצאות השאלון, ולכן כדאי שיאמרו במשפט אחד למי ובמה את/ה עוזר/ת, ואחריהן קצת על הגישה.",
  areas: "כדאי לוודא שכל התחומים שאת/ה עוסק/ת בהם מסומנים בפרופיל: החיפוש בתוצאות השאלון הוא לפי תחום, ותחום שלא מסומן לא נכנס אליו.",
  education: "בפרופיל חסרים פרטי השכלה והכשרה. מטופלים בודקים רקע מקצועי לפני שהם פונים.",
  experience: "בפרופיל חסר תיאור של הניסיון המקצועי: שנות ניסיון ומסגרות עבודה.",
  regions: "בפרופיל לא מסומנת אף עיר. החיפוש באתר הוא לפי מקום, ובלי עיר הפרופיל לא מופיע בחיפושים לפי אזור.",
};

// ── הדגלים ─────────────────────────────────────────────────────────────────

function flagsFor(t: TherapistInput, f: FunnelRow, m: ReviewMetrics, ctx: ReviewContext, crowd: CrowdInfo | null): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  const isNew = m.tenureDays < MIN_TENURE_DAYS;
  const bench = m.cardsBenchmark;

  // ── אצלנו: מקודם/ת שאף חיפוש לא יכול להגיע אליו/ה ──
  if (m.regions.length === 0 && t.online !== true) {
    flags.push({
      key: "no_reach",
      severity: "critical",
      owner: "us",
      label: "בלי אזור ובלי אונליין",
      detail: "בפרופיל אין אף עיר שממופה לאזור, וגם לא אונליין - אף חיפוש בשאלון לא יכול להגיע אליו/ה.",
      emailParagraph: GAP_EMAIL.regions,
    });
  }

  // ── כפתורי הקשר, לפני כל ניתוח דירוג (הלקח מ-21/9/26) ──
  const digits = phoneNationalDigits(t.phone);
  if (!digits) {
    const foreign = /^\s*(\+|00)(?!972)\d/.test(t.phone ?? "");
    flags.push({
      key: "contact_buttons",
      severity: t.email ? "high" : "critical",
      owner: "therapist",
      label: foreign ? "מספר חו\"ל בלי חיוג" : "טלפון לא תקין",
      detail: foreign
        ? "המספר בפרופיל אינו ישראלי, ולכן יש וואטסאפ בינלאומי בלי כפתור חיוג."
        : `בשדה הטלפון יש ערך שאינו מספר (${t.phone ? "טקסט אחר" : "ריק"}), ולכן בפרופיל אין חיוג ואין וואטסאפ - רק הודעה דרך האתר${t.email ? "" : ", וגם לה אין כתובת"}.`,
      emailParagraph: foreign
        ? undefined
        : "בשדה הטלפון בפרופיל חסר מספר טלפון תקין, ולכן כפתורי החיוג והוואטסאפ לא מוצגים למטופלים. כדאי לעדכן מספר נייד.",
    });
  } else if (!isMobileNumber(t.phone)) {
    flags.push({
      key: "landline",
      severity: "normal",
      owner: "therapist",
      label: "קו נייח, אין וואטסאפ",
      detail: "המספר בפרופיל הוא קו נייח, ולכן אין כפתור וואטסאפ. רוב הפונים באתר בוחרים בוואטסאפ.",
      emailParagraph: "המספר בפרופיל הוא קו נייח, ולכן אין בפרופיל כפתור וואטסאפ. רוב הפונים באתר בוחרים בוואטסאפ; אם יש מספר נייד, כדאי להוסיף אותו.",
    });
  }

  // ── פערי פרופיל (תמונה, ביו, השכלה...) ──
  // "אין עיר" לא נכנס כדגל: בלי עיר ובלי אונליין זה no_reach (קריטי, למעלה),
  // ומטפל/ת אונליין בלבד בלי עיר הוא/היא בחירה לגיטימית, לא פער.
  const gaps = detectProfileGapsDetailed({
    bio: t.bio, profile_photo_path: t.profile_photo_path, training_areas: t.training_areas,
    regions: t.cities, education: t.education, experience: t.experience,
  }).filter((g) => g.key !== "regions");
  for (const g of gaps) {
    flags.push({
      key: `gap_${g.key}`,
      severity: g.key === "photo" || g.key === "bio" ? "high" : "normal",
      owner: "therapist",
      label: { photo: "אין תמונה", bio: "ביו קצר", areas: "מעט תחומים", education: "אין השכלה", experience: "אין ניסיון", regions: "אין עיר" }[g.key],
      detail: g.text,
      emailParagraph: GAP_EMAIL[g.key],
    });
  }

  // ── מטפל/ת חדש/ה: צ'קליסט קליטה, ולא ציון סיכון ──
  if (isNew) {
    if (m.tenureDays >= NO_FIRST_CARD_DAYS && !f.first_card_at && !m.paused) {
      flags.push({
        key: "no_first_card",
        severity: "critical",
        owner: "us",
        label: "עדיין לא הופיע/ה בשאלון",
        detail: `${m.tenureDays} ימים מאז הקידום ואף הופעה בתוצאות השאלון. לבדוק: אישור לרישום, ערים, אונליין, קבוצות גיל.`,
      });
    }
    return flags.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  }

  // ── ביקוש ──
  const searches = m.regions.reduce((s, r) => s + (ctx.demand[r]?.searches ?? 0), 0);
  if (m.regions.length > 0 && t.online !== true && searches < LOW_DEMAND_SEARCHES) {
    flags.push({
      key: "no_demand",
      severity: "normal",
      owner: "market",
      label: "ביקוש נמוך באזור",
      detail: `${searches} חיפושים בשאלון ב-${ctx.windowDays} יום ב${m.regions.join(", ")}, מתוך ${ctx.demandTotal} בארץ, ובלי אונליין.`,
    });
  }
  if (t.online !== true) {
    flags.push({
      key: "not_online",
      severity: "normal",
      owner: "therapist",
      label: "לא אונליין",
      detail: `${pct(ctx.onlineShare)} מהחיפושים בשאלון ביקשו טיפול אונליין; מי שלא סימן אונליין לא מופיע באף אחד מהם.`,
      emailParagraph: `אם את/ה מקבל/ת מטופלים גם בשיחת וידאו, כדאי לסמן זאת בפרופיל: כ-${pct(ctx.onlineShare)} מהפונים באתר מחפשים טיפול אונליין, ומי שלא סימן זאת לא מופיע אצלם.`,
    });
  }
  // שיטה שהשאלון ממליץ עליה הרבה באזור ואינה בפרופיל. לידיעתנו בלבד: לא מציעים
  // למטפל/ת לסמן שיטה ספציפית (הבעלים, 11/10/26) - רק לוודא שכל התחומים
  // שהוא/היא עוסק/ת בהם מסומנים (narrow_profile / gap_areas).
  const missing = missingTreatment(t, m.regions, ctx);
  if (missing) {
    flags.push({
      key: "treatment_mismatch",
      severity: "normal",
      owner: "us",
      label: `ביקוש ל${/^[A-Za-z]/.test(missing.t) ? "-" : ""}${missing.t} באזור`,
      detail: `${missing.t} הומלץ ל-${pct(missing.share)} מהשאלונים ב${missing.region} (${missing.n} מתוך ${missing.sessions}), ואינו בתחומי הטיפול בפרופיל. לא מציעים לסמן שיטה ספציפית.`,
    });
  }

  // ── חשיפה ──
  const narrow: string[] = [];
  if (m.regions.length === 1 && t.online !== true) narrow.push("אזור אחד");
  if (t.age_groups.length === 1) narrow.push("קבוצת גיל אחת");
  if (t.training_areas.length > 2 && t.training_areas.length < 4) narrow.push(`${t.training_areas.length} תחומים`);
  if (narrow.length > 0) {
    flags.push({
      key: "narrow_profile",
      severity: "normal",
      owner: "therapist",
      label: "פרופיל צר",
      detail: `${narrow.join(", ")} - כל אחד מהם מצמצם את החיפושים שבהם הפרופיל מופיע.`,
      emailParagraph:
        (m.regions.length === 1 && t.online !== true ? "בפרופיל מסומן אזור אחד. אם את/ה מקבל/ת מטופלים גם מערים סמוכות, כדאי להוסיף אותן - החיפוש באתר הוא לפי מקום. " : "") +
        (t.age_groups.length === 1 ? "מסומנת קבוצת גיל אחת; אם את/ה מטפל/ת גם בגילאים נוספים, כדאי לסמן אותם. " : "") +
        (t.training_areas.length > 2 && t.training_areas.length < 4 ? "כדאי לוודא שכל התחומים שאת/ה עוסק/ת בהם מסומנים." : ""),
    });
  }
  if (bench != null && bench > 0 && m.cards30 < bench * LOW_EXPOSURE_RATIO) {
    flags.push({
      key: "low_exposure",
      severity: "normal",
      owner: "us",
      label: "חשיפה נמוכה",
      detail: `${m.cards30} הופעות בתוצאות השאלון ל-30 יום, לעומת ${bench} אצל ${m.benchmarkScope === "region" ? "משלם פרטי באותו אזור" : "משלם פרטי"}.`,
    });
  }
  if (crowd && crowd.strongId === t.id) {
    flags.push({
      key: "over_exposed",
      severity: "normal",
      owner: "us",
      label: "חזק/ה מדי באזור",
      detail: `${pct(crowd.share)} מהופעות הכרטיס של המקודמים ב${crowd.region} ו-${f.people_14} פניות ב-14 יום. הקפאה שקטה של שבוע תפנה מקום ל-${crowd.others} מקודמים אחרים באזור.`,
    });
  } else if (crowd && crowd.strongId !== t.id && bench != null && m.cards30 < bench) {
    flags.push({
      key: "crowded_out",
      severity: "normal",
      owner: "us",
      label: "נדחק/ת באזור",
      detail: `ב${crowd.region} ${crowd.strongName} מקבל/ת ${pct(crowd.share)} מהופעות הכרטיס של המקודמים.`,
    });
  }
  if (f.avg_score_cur != null && ctx.benchmark?.avgScore != null && f.cards_cur >= LOW_RANK_MIN_CARDS && f.avg_score_cur < ctx.benchmark.avgScore - LOW_RANK_GAP) {
    flags.push({
      key: "low_rank",
      severity: "normal",
      owner: "us",
      label: "דירוג נמוך",
      detail: `ציון התאמה ממוצע ${Math.round(f.avg_score_cur)} בכרטיסים, לעומת ${Math.round(ctx.benchmark.avgScore)} אצל העמיתים - מופיע/ה נמוך יותר ברשימה. בדרך כלל: שיטת טיפול חסרה או אונליין.`,
    });
  }
  if (f.cards_cur >= CARD_MIN_FOR_CTR && f.paid_cards_cur / f.cards_cur >= PAID_DEPENDENCE_SHARE) {
    flags.push({
      key: "paid_dependent",
      severity: "normal",
      owner: "us",
      label: "תלוי/ה בממומן",
      detail: `${pct(f.paid_cards_cur / f.cards_cur)} מהופעות הכרטיס מגיעות ממבקרים ממומנים - השהיית הקמפיין באזור מורידה את החשיפה שלו/ה בבת אחת.`,
    });
  }

  // ── כרטיס → פרופיל → פנייה ──
  const benchCtr = ctx.benchmark && ctx.benchmark.cards > 0 ? ctx.benchmark.opens / ctx.benchmark.cards : null;
  if (f.cards_cur >= CARD_MIN_FOR_CTR && benchCtr != null && f.opens_cur / f.cards_cur < benchCtr * CTR_RATIO) {
    flags.push({
      key: "card_not_opened",
      severity: "normal",
      owner: "therapist",
      label: "הכרטיס לא נפתח",
      detail: `${f.opens_cur} כניסות לפרופיל מ-${f.cards_cur} הופעות כרטיס (${pct(f.opens_cur / f.cards_cur)}), לעומת ${pct(benchCtr)} אצל העמיתים. הכרטיס = תמונה, תואר, שתי שורות ביו, אזורים.`,
      emailParagraph: "הכרטיס שלך בתוצאות השאלון מציג את התמונה, התואר ושתי השורות הראשונות של הביוגרפיה. כדאי לוודא שהפתיחה אומרת במשפט אחד למי ובמה את/ה עוזר/ת, ושהתמונה ברורה ומזמינה.",
    });
  }
  if (f.opens_cur >= OPENS_MIN_FOR_CONVERSION && f.people_cur === 0) {
    flags.push({
      key: "profile_not_converting",
      severity: "normal",
      owner: "therapist",
      label: "פרופיל לא ממיר",
      detail: `${f.opens_cur} כניסות לפרופיל ב-${ctx.windowDays} יום ואף פנייה. לבדוק: כפתורי קשר, מחיר, ביו, השכלה וניסיון, שפות.`,
      emailParagraph: "מטופלים שמגיעים לפרופיל מחפשים בעיקר מחיר, ניסיון ודרך קלה ליצור קשר. כדאי לבדוק שהשדות האלה מלאים ושהטלפון בפרופיל נכון.",
    });
  }

  // ── מגמה ──
  if (f.people_prev >= DROP_MIN_PREVIOUS && f.people_cur <= f.people_prev * DROP_RATIO) {
    flags.push({
      key: "drop",
      severity: "high",
      owner: "us",
      label: "ירידה חדה",
      detail: `${f.people_prev} פונים ב-${ctx.windowDays} הימים הקודמים, ${f.people_cur} ב-${ctx.windowDays} האחרונים.${ctx.holidayWeek ? ` שבוע ${ctx.holidayWeek} בתוך החלון.` : ""}`,
    });
  }

  // ── מועדים שמשנים את הסיכון: כל אחד דגל משלו, עם התאריך בכותרת ──
  if (m.guaranteeDaysLeft != null && m.guaranteeContacts === 0 && m.guaranteeDaysLeft <= BILLING_SOON_DAYS) {
    flags.push({
      key: "guarantee_closing",
      severity: "high",
      owner: "us",
      label: m.guaranteeDaysLeft >= 0 ? `ערבות הפניות נסגרת בעוד ${m.guaranteeDaysLeft} ימים` : "ערבות הפניות נסגרה בלי פנייה",
      detail: m.guaranteeDaysLeft >= 0
        ? `חלון ערבות הפניות (החזר מלא אם אין פנייה) נסגר בעוד ${m.guaranteeDaysLeft} ימים, ובינתיים אין אף פנייה.`
        : "חלון ערבות הפניות נסגר בלי אף פנייה - זכאות להחזר מלא.",
    });
  }
  if (m.daysToFirstCharge != null && m.daysToFirstCharge <= BILLING_SOON_DAYS && t.subscription?.first_charge_on) {
    flags.push({
      key: "first_charge_soon",
      severity: "high",
      owner: "us",
      label: `חיוב ראשון ב-${ilDate(t.subscription.first_charge_on)}`,
      detail: `הכרטיס שנמסר במתנה מתחיל להיגבות ב-${ilDate(t.subscription.first_charge_on)}${m.daysToFirstCharge >= 0 ? ` (בעוד ${m.daysToFirstCharge} ימים)` : ""}. מי שמגיע לחיוב בלי פניות - מבטל.`,
    });
  }
  if (t.promotion_source === "trial" && m.daysToPromotionEnd != null && m.daysToPromotionEnd <= TRIAL_END_SOON_DAYS && t.promoted_until) {
    flags.push({
      key: "trial_ending",
      severity: "high",
      owner: "us",
      label: `הניסיון מסתיים ב-${ilDate(t.promoted_until)}`,
      detail: `תקופת הניסיון מסתיימת ב-${ilDate(t.promoted_until)}${m.daysToPromotionEnd >= 0 ? ` (בעוד ${m.daysToPromotionEnd} ימים)` : ""}. ההצעה להמשיך בתשלום יוצאת רק למי שקיבל/ה פניות.`,
    });
  }
  if (m.daysToPriceRevert != null && m.daysToPriceRevert >= 0 && m.daysToPriceRevert <= BILLING_SOON_DAYS && t.subscription?.promo_reverts_at) {
    flags.push({
      key: "price_rising",
      severity: "high",
      owner: "us",
      label: `המחיר עולה ב-${ilDate(t.subscription.promo_reverts_at)}`,
      detail: `המחיר המוזל מסתיים ב-${ilDate(t.subscription.promo_reverts_at)} והחיוב עובר למחיר המלא.`,
    });
  }

  return flags.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

export const MONEY_FLAG_KEYS = ["guarantee_closing", "first_charge_soon", "trial_ending", "price_rising"] as const;

function missingTreatment(t: TherapistInput, regions: string[], ctx: ReviewContext): { t: string; region: string; share: number; n: number; sessions: number } | null {
  const mine = new Set(t.training_areas);
  let best: { t: string; region: string; share: number; n: number; sessions: number } | null = null;
  for (const region of regions) {
    const d = ctx.demand[region];
    if (!d || d.treatmentSessions < TREATMENT_MIN_SESSIONS) continue;
    for (const tr of d.treatments) {
      const share = tr.n / d.treatmentSessions;
      if (share < TREATMENT_SHARE || mine.has(tr.t)) continue;
      if (!best || share > best.share) best = { t: tr.t, region, share, n: tr.n, sessions: d.treatmentSessions };
    }
  }
  return best;
}

// ── הסיכון ──────────────────────────────────────────────────────────────────

function riskOf(t: TherapistInput, f: FunnelRow, m: ReviewMetrics, flags: ReviewFlag[]): { risk: ReviewRisk; reason: string } {
  if (m.paused) return { risk: "paused", reason: `מוקפא/ת מההתאמות עד ${m.pausedUntil ? ilDate(m.pausedUntil) : "?"} בהחלטה שלנו.` };
  const critical = flags.find((x) => x.severity === "critical");
  if (critical) return { risk: "critical", reason: critical.detail };
  if (m.tenureDays < MIN_TENURE_DAYS) return { risk: "new", reason: `${m.tenureDays} ימים מאז הקידום - עוד מוקדם למדוד.` };

  const noContact = f.people_21 === 0;
  const lowExposure = m.cardsBenchmark != null && m.cardsBenchmark > 0 && m.cards30 < m.cardsBenchmark * LOW_EXPOSURE_RATIO && f.people_21 < LOW_EXPOSURE_OK_CONTACTS;
  if (!noContact && !lowExposure) {
    return { risk: "ok", reason: `${f.people_21} פונים ב-${NO_CONTACT_DAYS} יום.` };
  }
  const base = noContact
    ? `אף פנייה ב-${NO_CONTACT_DAYS} יום${m.daysSinceContact != null ? ` (האחרונה לפני ${m.daysSinceContact} ימים)` : " (אף פעם)"}`
    : `חשיפה נמוכה (${m.cards30} הופעות ל-30 יום מול ${m.cardsBenchmark}) ורק ${f.people_21} פונים`;

  const escalations: string[] = [];
  for (const key of MONEY_FLAG_KEYS) {
    const money = flags.find((x) => x.key === key);
    if (money) escalations.push(money.label);
  }
  if (flags.some((x) => x.key === "drop")) escalations.push("ירידה חדה מול התקופה הקודמת");
  if (noContact && (m.daysSinceContact == null ? m.tenureDays : m.daysSinceContact) >= LONG_SILENCE_DAYS) escalations.push(`${LONG_SILENCE_DAYS}+ ימים בלי פנייה`);
  if (escalations.length > 0) return { risk: "high", reason: `${base}; ${escalations.join("; ")}.` };
  return { risk: "medium", reason: `${base}.` };
}

// ── הפעולות ─────────────────────────────────────────────────────────────────

export type EmailDraft = { subject: string; body: string };

/**
 * מה אסור בגוף מייל למטפל/ת: מספר דו-ספרתי שאינו אחוז (כנראה מספר ביצועים),
 * מקף ארוך, ואורך לא סביר. אותו כלל לטיוטת המודל ולשליחה הידנית.
 */
export function emailBodyProblem(body: string): string | null {
  const text = body.trim();
  if (text.length < 120) return "הטיוטה קצרה מדי";
  if (text.length > 2200) return "הטיוטה ארוכה מדי";
  if (text.includes("—")) return "יש מקף ארוך בטקסט";
  if (/\d{2,}/.test(text.replace(/\d+%/g, "").replace(/\b\d{1,2}\.\d{1,2}(\.\d{2,4})?\b/g, ""))) {
    return "בגוף המייל יש מספר. לפי ההחלטה מ-15/8/26 לא שולחים למטפלים מספרי ביצועים";
  }
  return null;
}

/**
 * טיוטת המייל למטפל/ת: רק פסקאות של דגלים שבאחריותו/ה, עד שלוש, בלי אף מספר
 * על הביצועים שלו/ה. מוחזר null כשאין מה להציע.
 */
export function buildRetentionEmail(name: string, flags: ReviewFlag[]): EmailDraft | null {
  const paragraphs = flags
    .filter((f) => f.owner === "therapist" && f.emailParagraph)
    .map((f) => (f.emailParagraph as string).trim())
    .filter((p) => p.length > 0)
    .slice(0, EMAIL_MAX_PARAGRAPHS);
  if (paragraphs.length === 0) return null;
  const first = (name || "").trim().split(/\s+/)[0] || "";
  const body = [
    `${first ? `שלום ${first},` : "שלום,"}`,
    "",
    "עברנו השבוע על הפרופיל שלך באתר, ויש כמה דברים שלדעתנו יכולים לעזור למטופלים שמחפשים מטפל/ת כמוך למצוא אותך ולפנות:",
    "",
    ...paragraphs.map((p) => `• ${p}`),
    "",
    "את כל אלה אפשר לערוך בעמוד עריכת הפרופיל (הכפתור למטה). אם משהו מהרשימה לא נכון לגביך, אפשר פשוט להתעלם ממנו, ואם יש שאלה - אפשר להשיב למייל הזה.",
    "",
    "בברכה,",
    "צוות טיפול חכם",
  ].join("\n");
  return { subject: "כמה הצעות לפרופיל שלך בטיפול חכם", body };
}

function actionsFor(t: TherapistWithTier, f: FunnelRow, m: ReviewMetrics, risk: ReviewRisk, flags: ReviewFlag[], ctx: ReviewContext, crowd: CrowdInfo | null): ReviewAction[] {
  const actions: ReviewAction[] = [];
  const adminLink = `/admin/therapists?therapist=${t.id}`;

  // תיקון אצלנו: לכל דגל קריטי שבאחריותנו.
  const ours = flags.filter((x) => x.owner === "us" && x.severity === "critical");
  if (ours.length > 0) {
    actions.push({
      type: "fix",
      title: "לתקן באדמין",
      detail: ours.map((x) => x.label).join(", "),
      link: adminLink,
    });
  }

  // הקפאה שקטה של החזק/ה מדי.
  if (crowd && crowd.strongId === t.id && crowd.pausable) {
    actions.push({
      type: "freeze",
      title: `הקפאה שקטה ל-${FREEZE_DAYS} ימים`,
      detail: `מפנה מקום ל-${crowd.others} מקודמים אחרים ב${crowd.region}. המטפל/ת לא מקבל/ת הודעה וההקפאה פגה מעצמה.`,
      days: FREEZE_DAYS,
    });
  }

  // מייל: רק למי שיש מה להציע לו, בסיכון או חדש/ה עם פערים, ולא בתוך צינון.
  const cooled = t.lastOutreachAt != null && daysBetween(t.lastOutreachAt, ctx.now) < ctx.emailCooldownDays;
  const wantsEmail = risk === "critical" || risk === "high" || risk === "medium" || (risk === "new" && flags.some((x) => x.key.startsWith("gap_") || x.key === "contact_buttons"));
  const draft = wantsEmail ? buildRetentionEmail(t.name, flags) : null;
  if (draft && t.tier !== "center") {
    actions.push({
      type: "email",
      title: cooled ? "מייל (בצינון)" : "מייל שיפור למטפל/ת",
      detail: cooled
        ? `יצא מייל יזום לפני פחות מ-${ctx.emailCooldownDays} ימים (${t.lastOutreachAt ? ilDate(t.lastOutreachAt) : ""}) - לשלוח רק אם באמת צריך.`
        : "טיוטה מוכנה, בלי מספרים, סביב השיפור המוצע. נשלחת רק אחרי עריכה ולחיצה.",
      subject: draft.subject,
      body: draft.body,
    });
  }

  // הארכת ניסיון: כשהניסיון מסתיים ועוד אין פניות - לתת לפרופיל עוד זמן אחרי התיקונים.
  const trialEnding = flags.find((x) => x.key === "trial_ending");
  if (trialEnding && t.promotion_source === "trial" && f.people_21 === 0 && t.promoted_until) {
    actions.push({
      type: "extend",
      title: "הארכת הניסיון",
      detail: `${trialEnding.label}, ועדיין אין פניות. הארכה מזיזה רק את התאריך: בלי מייל, בלי איפוס ותק.`,
      days: 30,
    });
  }

  // שיחה: סיכון גבוה או קריטי אצל מי שמשלם או עומד לשלם.
  if ((risk === "high" || risk === "critical") && t.tier === "high") {
    actions.push({
      type: "task",
      title: "משימת שיחת שימור",
      detail: "משימה ב-CRM עם המשפך והדגלים, לשיחה בשבוע הקרוב.",
    });
  }

  // קמפיין: ביקוש נמוך באזור, או תלות בממומן. בשלב הזה קישור ומפרט, לא לחיצה בגוגל.
  const demandFlag = flags.find((x) => x.key === "no_demand" || x.key === "paid_dependent");
  if (demandFlag && m.regions.length > 0 && (risk === "high" || risk === "medium")) {
    actions.push({
      type: "campaign",
      title: demandFlag.key === "no_demand" ? `קמפיין ב${m.regions[0]}` : `לבדוק את הקמפיין ב${m.regions[0]}`,
      detail: demandFlag.key === "no_demand"
        ? "אין מספיק חיפושים באזור כדי שפרופיל כלשהו יביא פניות; הערכה והמילים לאזור בעמוד הפרסום."
        : "רוב החשיפה ממומנת - לוודא שהקמפיין באזור פעיל ובתקציב.",
      link: "/admin/ads",
      region: m.regions[0],
    });
  }

  return actions.sort((a, b) => ACTION_RANK[a.type] - ACTION_RANK[b.type]);
}

// ── דחיקה: נתח הכרטיסים באזור ──────────────────────────────────────────────

type CrowdInfo = { region: string; strongId: string; strongName: string; share: number; others: number; pausable: boolean };

function crowdByRegion(rows: { t: TherapistInput; regions: string[]; f: FunnelRow }[]): Map<string, CrowdInfo> {
  const byRegion = new Map<string, { t: TherapistInput; f: FunnelRow }[]>();
  for (const r of rows) for (const region of r.regions) byRegion.set(region, [...(byRegion.get(region) ?? []), { t: r.t, f: r.f }]);
  const out = new Map<string, CrowdInfo>();
  for (const [region, members] of byRegion) {
    if (members.length < CROWD_MIN_PROMOTED) continue;
    const total = members.reduce((s, x) => s + x.f.cards_cur, 0);
    if (total === 0) continue;
    const top = [...members].sort((a, b) => b.f.cards_cur - a.f.cards_cur)[0];
    const share = top.f.cards_cur / total;
    if (share < CROWD_SHARE || top.f.people_14 < CROWD_MIN_CONTACTS_14) continue;
    const pausable = top.t.status === "paying" && ["trial", "manual", "paid"].includes(top.t.promotion_source ?? "") &&
      // למשלם/ת: ערבות פתוחה בלי פנייה חוסמת הקפאה (match-pause.ts). כאן יש פניות, אז רק הצינון לפי מצב הערבות.
      !(top.t.promotion_source === "paid" && top.t.guarantee && top.t.guarantee.contacts === 0 && top.t.guarantee.daysLeft >= 0);
    out.set(region, { region, strongId: top.t.id, strongName: top.t.name, share, others: members.length - 1, pausable });
  }
  return out;
}

// ── הסקירה ──────────────────────────────────────────────────────────────────

type TherapistWithTier = TherapistInput & { tier: ReviewTier };

// הקיצורים לשורת "מה לעשות": דגל שבאחריות המטפל/ת → מה המייל מבקש, בשתי מילים.
const TODO_SHORT: Record<string, string> = {
  contact_buttons: "טלפון נייד",
  landline: "מספר נייד לוואטסאפ",
  gap_photo: "תמונה",
  gap_bio: "ביו",
  gap_areas: "לוודא תחומים",
  gap_education: "השכלה",
  gap_experience: "ניסיון",
  not_online: "אונליין",
  narrow_profile: "ערים/גילאים נוספים",
  card_not_opened: "פתיחת הכרטיס",
  card_review: "תמונה ופתיחה",
  profile_not_converting: "מחיר וקשר",
};

/** המשפט הסגור: הדבר הכי חשוב לעשות, ואחריו עוד אחד-שניים אם יש. */
export function todoSentence(actions: ReviewAction[], flags: ReviewFlag[], risk: ReviewRisk): string {
  if (risk === "paused") return "מוקפא/ת בהחלטה שלנו - אין מה לעשות השבוע.";
  const parts: string[] = [];
  for (const a of actions) {
    if (a.type === "fix") parts.push(`לתקן באדמין: ${a.detail}`);
    else if (a.type === "freeze") parts.push(`להקפיא ל-${a.days ?? FREEZE_DAYS} ימים (חזק/ה מדי באזור)`);
    else if (a.type === "email") {
      const asks = flags.filter((x) => x.owner === "therapist" && TODO_SHORT[x.key]).map((x) => TODO_SHORT[x.key]);
      const unique = [...new Set(asks)].slice(0, 3);
      parts.push(unique.length > 0 ? `לשלוח מייל (${unique.join(", ")})` : "לשלוח מייל");
    } else if (a.type === "extend") parts.push("להאריך את הניסיון");
    else if (a.type === "task") {
      const money = flags.find((x) => (MONEY_FLAG_KEYS as readonly string[]).includes(x.key));
      parts.push(money ? `להתקשר לפני המועד (${money.label})` : "להתקשר");
    } else if (a.type === "campaign") parts.push(a.region ? `לבדוק קמפיין ב${a.region}` : "לבדוק קמפיין");
  }
  if (parts.length === 0) {
    if (risk === "new") return "עוד מוקדם למדוד - לעקוב בשבוע הבא.";
    return "אין מה לעשות השבוע.";
  }
  const [first, ...rest] = parts.slice(0, 3);
  return rest.length > 0 ? `${first}, ו${rest.join(", ו")}.` : `${first}.`;
}

export function buildRetentionReview(inputs: TherapistInput[], ctx: ReviewContext): { rows: ReviewRow[]; summary: ReviewSummary } {
  const now = ctx.now;
  const members: { t: TherapistWithTier; regions: string[]; f: FunnelRow }[] = [];
  const excluded = { suspended: 0, unapproved: 0 };
  for (const t of inputs) {
    const tier = tierOf(t);
    if (!tier) continue;
    const why = excludedFromReview(t);
    if (why) {
      excluded[why]++;
      continue;
    }
    members.push({ t: { ...t, tier }, regions: regionsOf(t.cities), f: t.funnel ?? EMPTY_FUNNEL });
  }
  // הדחיקה נמדדת בין המקודמים שבאמת מופיעים בשאלון (לא מוקפאים).
  const crowd = crowdByRegion(members.filter((x) => !(x.t.match_paused_until && new Date(x.t.match_paused_until).getTime() > now.getTime())));

  const rows: ReviewRow[] = members.map(({ t, regions, f }) => {
    const since = t.promoted_since ?? t.created_at;
    const tenureDays = Math.max(0, daysBetween(since, now));
    const scale = tenureDays > 0 && tenureDays < 30 ? 30 / tenureDays : 1;
    const { bench, scope } = benchmarkFor(regions, ctx);
    const paused = !!t.match_paused_until && new Date(t.match_paused_until).getTime() > now.getTime();
    const primaryRegion = regions[0] ?? null;
    const crowdHere = primaryRegion ? crowd.get(primaryRegion) ?? null : null;
    const regionCardShare = (() => {
      if (!primaryRegion) return null;
      const total = members.filter((x) => x.regions.includes(primaryRegion)).reduce((s, x) => s + x.f.cards_cur, 0);
      return total > 0 ? Math.round((f.cards_cur / total) * 1000) / 1000 : null;
    })();
    const metrics: ReviewMetrics = {
      ...f,
      tenureDays,
      regions,
      cards30: Math.round(f.cards_cur * scale),
      cardsBenchmark: bench ? bench.cards : null,
      benchmarkScope: scope,
      regionCardShare,
      regionPromoted: primaryRegion ? members.filter((x) => x.regions.includes(primaryRegion)).length : 0,
      daysSinceContact: f.last_contact_at ? daysBetween(f.last_contact_at, now) : null,
      daysToFirstCharge: t.subscription?.first_charge_on ? daysUntil(t.subscription.first_charge_on, now) : null,
      daysToPromotionEnd: t.promoted_until ? daysUntil(t.promoted_until, now) : null,
      daysToPriceRevert: t.subscription?.promo_reverts_at ? daysUntil(t.subscription.promo_reverts_at, now) : null,
      guaranteeDaysLeft: t.guarantee ? t.guarantee.daysLeft : null,
      guaranteeContacts: t.guarantee ? t.guarantee.contacts : null,
      paused,
      pausedUntil: paused ? t.match_paused_until : null,
    };
    const flags = flagsFor(t, f, metrics, ctx, crowdHere);
    const { risk, reason } = riskOf(t, f, metrics, flags);
    const actions = actionsFor(t, f, metrics, risk, flags, ctx, crowdHere);
    return {
      therapist_id: t.id,
      name: t.name,
      tier: t.tier,
      risk,
      promotion_source: t.promotion_source,
      metrics,
      flags,
      actions,
      primary_action: actions[0]?.type ?? null,
      risk_reason: reason,
      todo: todoSentence(actions, flags, risk),
    };
  });

  sortReviewRows(rows);

  const summary: ReviewSummary = {
    checked: rows.length,
    byTier: { high: 0, medium: 0, center: 0 },
    byRisk: { critical: 0, high: 0, medium: 0, ok: 0, new: 0, paused: 0 },
    actions: 0,
    holidayWeek: ctx.holidayWeek,
    excluded,
  };
  for (const r of rows) {
    summary.byTier[r.tier]++;
    summary.byRisk[r.risk]++;
    summary.actions += r.actions.filter((a) => a.type !== "campaign" && a.type !== "extend").length;
  }
  return { rows, summary };
}

/** הסדר של הסקירה: חשיבות, ואז סיכון, ואז מי שיש לו פחות פונים. גם לשורות שנקראו מהמסד. */
export function sortReviewRows<T extends { tier: ReviewTier; risk: ReviewRisk; metrics: { people_21: number } }>(rows: T[]): T[] {
  return rows.sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || RISK_RANK[a.risk] - RISK_RANK[b.risk] || a.metrics.people_21 - b.metrics.people_21);
}

/** הבנצ'מרק מתוך שורות העמיתים: ממוצע ל-30 יום של משלם פרטי עם ותק מלא. */
export function benchmarkFrom(peerFunnels: FunnelRow[]): Benchmark | null {
  if (peerFunnels.length === 0) return null;
  const n = peerFunnels.length;
  const scored = peerFunnels.filter((p) => p.avg_score_cur != null && p.cards_cur > 0);
  return {
    peers: n,
    cards: round1(peerFunnels.reduce((s, p) => s + p.cards_cur, 0) / n),
    opens: round1(peerFunnels.reduce((s, p) => s + p.opens_cur, 0) / n),
    people: round1(peerFunnels.reduce((s, p) => s + p.people_cur, 0) / n),
    avgScore: scored.length > 0 ? round1(scored.reduce((s, p) => s + (p.avg_score_cur as number), 0) / scored.length) : null,
  };
}

/** הסקירה שייכת לשבוע שמתחיל ביום ראשון (שעון ישראל) - גם כשמריצים ידנית באמצע השבוע. */
export function reviewWeekStart(now: Date): string {
  const il = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  il.setDate(il.getDate() - il.getDay());
  const y = il.getFullYear();
  const m = String(il.getMonth() + 1).padStart(2, "0");
  const d = String(il.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
