import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { fetchAllRows } from "./fetch-all-rows";
import { JOIN_LINK_PLACEHOLDER, GIFT_OFFER_TTL_DAYS } from "./gift-checkout";
import { coversRegion, overlaps } from "./match-fallback";
import { ALL_REGIONS, REGION_GROUPS, REGION_GROUP_LABELS, regionGroupOf } from "./regions";
import { startAgentRun, finishAgentRun, syncAgentAlerts } from "./agent-infra";
import {
  giftEligibilityError,
  recentGiftOffers,
  recentlyPromotedIds,
  GIFT_OFFER_MONTHS,
  GIFT_OFFER_WAIT_DAYS,
  GIFT_OFFER_COOLDOWN_DAYS,
} from "./gift-offer";
import { GIFT_FOLLOWON_PRICE, GIFT_FOLLOWON_MONTHS } from "./promo";
import {
  canonicalPart,
  matchPart,
  treatmentKey,
  treatmentLabel,
  treatmentParts,
  treatmentPhrase,
} from "./treatment-parts";
import {
  analyzeConcentration,
  isConcentrated,
  NEW_PER_SLICE,
  ONLINE_REGION,
  PAID_SOURCES,
  regionDisplay,
  CONCENTRATION_WINDOW_DAYS,
  FREEZE_CHECK_EVERY_DAYS,
  FREEZE_DAYS,
  type ConcentrationSlice,
  type ConcentrationSummary,
  type FreezeCandidate,
} from "./contact-concentration";
import { loadConcentrationInput } from "./contact-concentration-data";
import { serverFreezeChecks, FREEZE_ACTION_TYPE } from "./contact-concentration-freeze";


// סוכן פערי ההיצע (סוכן 11): מוצא חיתוכים של אזור × סוג טיפול שבהם מטופלים
// ביקשו טיפול ולא היה לנו מטפל משלם להראות להם, ומציע מה לעשות עם כל פער:
//
//   יש אצלנו מטפל חינמי שמתאים  → טיוטת הצעת קידום מתנה לחודשיים
//   אין אף מטפל שמתאים          → פער גיוס: איפה לפרסם כדי לגייס
//
// מקור האמת לביקוש הוא אירוע match_free_fallback שמנוע ההתאמה כבר כותב
// בכל פעם שלא מצא מטפל משלם - כלומר מטופל אמיתי שביקש ולא קיבל. זה מדויק
// יותר מספירת צפיות, כי הוא נרשם רק כשבאמת היה חוסר.
//
// רזולוציית האזור: הצפיות נרשמות עם מפתח גס ("center") והאירועים עם שם אזור
// מלא ("גוש דן"), ולכן שני האותות מתורגמים כאן לאותה קבוצת אזורים לפני
// הצבירה. בלי זה שני הפערים היו נספרים בנפרד, והפער מהצפיות לא היה מתאים
// לאף מטפל (המפתח הגס אינו אזור שקיים בפרופילים) - ולכן היה נראה בטעות
// כאילו אין באזור אף מטפל, ומוצג כפער גיוס.
//
// בטיחות: הסוכן לא שולח דבר ולא מקדם אף אחד. הוא מנסח ומציע לתור; השליחה
// נעשית בקליק מפורש שלך מעמוד הסוכנים (gift-offer.ts), והקידום עצמו מוענק
// ידנית אחרי שהמטפל משיב (החלטת המשתמש 16/8).

const LOOKBACK_DAYS = Number(process.env.SUPPLY_GAP_LOOKBACK_DAYS ?? 60);
const GIFT_MONTHS = GIFT_OFFER_MONTHS;
const GIFT_SUBJECT = "הצעת קידום - חודשיים ראשונים ללא תשלום | טיפול חכם";
// מינימום אירועי פער כדי להציע פעולה - מתחת לזה זה רעש של מטופל בודד.
const MIN_EVENTS = Number(process.env.SUPPLY_GAP_MIN_EVENTS ?? 1);
const MAX_CANDIDATES_PER_GAP = 3;
// כמה מטפלים מקודמים צריכים להיות בחיתוך שמחפשים אותו. 4 הוא הרצפה
// (החלטת המשתמש 23/8/26): מתחת לזה למטופל אין באמת ממה לבחור.
//
// למה זה שונה מהגרסה הקודמת: עד היום הסף היה 2, והשאלה היחידה הייתה
// "כמה יש". כך אזור כמו ירושלים - הביקוש השני בגודלו בארץ (847 צפיות
// ב-60 יום) עם שני משלמים אמיתיים בלבד - נחשב "מכוסה" ולא ייצר אף
// הצעה, כי בחיתוכים הרחבים הצטברו ארבעה-שישה מקודמים.
const MIN_SUPPLY_PER_SLICE = Number(process.env.SUPPLY_GAP_MIN_SUPPLY ?? 4);
// ככל שהביקוש בחיתוך גדול יותר, כך צריך יותר אפשרויות. הסף עולה בערך
// אחד לכל עשרה מחפשים, עד תקרה - אחרת חיתוך פופולרי לעולם לא "מספיק".
const SUPPLY_PER_DEMAND = Number(process.env.SUPPLY_GAP_PER_DEMAND ?? 10);
const MAX_SUPPLY_TARGET = Number(process.env.SUPPLY_GAP_MAX_TARGET ?? 8);

/** כמה מטפלים החיתוך הזה צריך, לפי כמה מחפשים אותו. */
function supplyTargetFor(demand: number): number {
  return Math.min(MAX_SUPPLY_TARGET, MIN_SUPPLY_PER_SLICE + Math.floor(demand / SUPPLY_PER_DEMAND));
}

// מקור קידום שמשקף לקוח שמשלם בפועל (ישירות או דרך מרכז), מול קידום
// מתנה שיפוג. שניהם נספרים ככיסוי - למטופל אין הבדל - אבל ההפרדה מוצגת,
// כי חיתוך שנשען כולו על מתנות יתרוקן ברגע שהן יסתיימו. PAID_SOURCES משותף
// עם ניתוח ריכוז הפניות (contact-concentration.ts).

type FallbackEvent = { metadata: Record<string, unknown> | null };

type TherapistRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string;
  promotion_source: string | null;
  promoted_until: string | null;
  admin_approved: boolean | null;
  accepting_new_patients: boolean | null;
  regions: string[] | null;
  online: boolean | null;
  training_areas: string[] | null;
  assessment_types: string[] | null;
  couples_modalities: string[] | null;
  age_groups: string[] | null;
  // לניתוח ריכוז הפניות ולבדיקת ההקפאה (contact-concentration.ts).
  entity_type: string | null;
  match_paused_until: string | null;
  promoted_since: string | null;
};

// "אזורים נוספים" מאגד אזורים שאין ביניהם קשר גיאוגרפי (נגב ואילת, יהודה
// ושומרון, ומה שלא מופה) - הצעה או פרסום גיוס ברזולוציה הזו חסרי משמעות.
const UNACTIONABLE_GROUPS = new Set(["other"]);

function regionGroupLabel(key: string): string {
  return REGION_GROUP_LABELS[key] ?? key;
}

// "באזור המרכז והשפלה" מול "בטיפול אונליין" - אונליין אינו מקום.
function regionPhrase(key: string): string {
  return key === "online" ? "בטיפול אונליין" : `באזור ${regionGroupLabel(key)}`;
}

export type GapCandidate = {
  therapist_id: string;
  full_name: string;
  email: string;
  // טיוטה אישית לכל מועמד (הפנייה נושאת את שמו) - כדי שהחלפת נמען בעמוד
  // הסוכנים לא תשלח מייל שפותח בשם של מישהו אחר.
  draft: string;
};

// פער שכבר יצאה בו הצעה וממתין לתשובה - לא מוצע שוב, ומוצג כדי שיהיה ברור
// למה החיתוך הזה נעלם מהרשימה.
export type WaitingGap = {
  region: string;
  treatment: string;
  sentAt: string;
  pending: number; // כמה הצעות פתוחות בחיתוך הזה
  needed: number; // כמה מטפלים החיתוך צריך
  covering: number; // כמה כבר מקודמים בו
};

export type SupplyGap = {
  key: string;
  region: string;
  treatment: string;
  events: number; // כמה מטופלים נתקלו בפער
  lastSeen: string;
  payingCovering: number; // סך המקודמים שמכסים את החיתוך
  paidCovering: number; // מתוכם משלמים בפועל (ישירות או דרך מרכז)
  giftCovering: number; // מתוכם קידום מתנה - כיסוי שיפוג
  supplyTarget: number; // כמה צריכים להיות בחיתוך הזה לפי הביקוש
  candidates: GapCandidate[]; // מטפלים חינמיים שמתאימים - יעד ההצעה
  kind: "gift" | "recruit";
  draftEmail: string | null; // טיוטה מוכנה למשלוח ידני אחרי אישור
  /** האזורים המלאים שבהם הפער נראה בפועל, כשהם צרים מקבוצת האזורים
   *  ("השפלה והמרכז" בתוך "המרכז והשפלה"). ריק = הפער נמדד על הקבוצה. */
  observedRegions: string[];
};

export type SupplyGapsResult = {
  ok: boolean;
  gaps: SupplyGap[];
  giftGaps: SupplyGap[];
  recruitGaps: SupplyGap[];
  waitingGaps: WaitingGap[];
  /** חיתוכים שבהם מעט מטפלים מקבלים את רוב הפניות (20/10/26). */
  concentration: ConcentrationSummary[];
  /** כמה מהם הפכו להצעת מתנה בתור. */
  concentrationOffers: number;
  /** מי היה מוקפא לשבוע, ולמה כן או לא - בדיקה בלבד, שום דבר לא מוקפא מכאן. */
  freeze: FreezeCandidate[];
  error?: string;
};

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x)).filter(Boolean);
    } catch {
      return v ? [v] : [];
    }
  }
  return [];
}

// טיוטת הצעת הקידום. תבנית קבועה בטון עובדתי-מסייע: מובילה בצורך שלנו,
// לא במספרי הביצועים של המטפל, ובלי ניסוחים שיווקיים.
export function buildGiftDraft(
  name: string,
  regionKey: string,
  rawTreatment: string,
  events: number,
  // התאמה חלקית: המטופלים ביקשו שילוב, והנמען עוסק בחלק ממנו. נאמר
  // במפורש בטיוטה - הצעה שמתיימרת להתאמה מלאה כשהיא חלקית היא בדיוק
  // סוג ההבטחה שמאבדת אמון.
  coveredPart?: string
): string {
  const treatment = treatmentPhrase(rawTreatment);
  const where = regionPhrase(regionKey);
  // בטיוטה היוצאת לא מציינים מספר מדויק - "מספר רב" נכון יותר לקריאה
  // ולא מעמיד את המספר במרכז. הספירה המדויקת נשארת בגוף ההצעה באדמין.
  // ל-2 מטופלים נאמר "מספר מטופלים" ולא "מספר רב", כדי לא להגזים.
  // "דרך מערכת ההתאמות" ולא "דרכנו": הנמען כבר רשום אצלנו ומופיע באתר,
  // והפער הוא רק בכך שהוא אינו חלק ממערכת ההתאמות. בלי ההבחנה הזו המשפט
  // נשמע כאילו הוא לא קיים אצלנו בכלל, וזה מבלבל דווקא את מי שכן נרשם.
  const matchingSystem = "דרך מערכת ההתאמות, שבה מוצגים רק מטפלים מקודמים";
  const demandLine =
    events > 1
      ? `בחודשיים האחרונים ${events >= 3 ? "מספר רב של מטופלים" : "מספר מטופלים"} חיפשו ${treatment} ${where} ${matchingSystem}, ולא היו לנו מספיק מטפלים בתחום ובאזור הזה להציע להם.`
      : `לאחרונה מטופל חיפש ${treatment} ${where} ${matchingSystem}, ולא היו לנו מספיק מטפלים בתחום ובאזור הזה להציע לו.`;

  const fitLine = coveredPart
    ? `הפרופיל שלך מתאים ל${treatmentLabel(coveredPart)}, שהוא חלק מהשילוב הזה`
    : "הפרופיל שלך מתאים לחיתוך הזה";

  return giftOfferDraft(name, demandLine, fitLine, treatment, where);
}

// מה שמשותף לשתי הטיוטות (פער היצע וריכוז פניות): תנאי המסלול, מה זה אומר
// בפועל, הקישור והחתימה. במקום אחד, כדי שתנאים שהבעלים אישר לא ייפרדו בין
// שתי גרסאות של אותה הצעה.
function giftOfferDraft(name: string, demandLine: string, fitLine: string, treatment: string, where: string): string {
  return [
    `שלום ${name},`,
    ``,
    demandLine,
    ``,
    `${fitLine}, ולכן אנחנו מציעים לך להצטרף לקידום במסלול הבא: ${GIFT_MONTHS} חודשים ראשונים ללא תשלום, אחריהם ${GIFT_FOLLOWON_MONTHS} חודשים ב-${GIFT_FOLLOWON_PRICE} ש"ח + מע"מ לחודש, ורק לאחר מכן המחיר המלא - 140 ש"ח + מע"מ לחודש.`,
    ``,
    `מה זה אומר בפועל:`,
    `• הפרופיל שלך ייכנס למערכת ההתאמות ויוצג למטופלים שמחפשים ${treatment} ${where}, מיד עם ההצטרפות.`,
    `• ב-${GIFT_MONTHS} החודשים הראשונים לא נגבה תשלום, ובשני החודשים שאחריהם התשלום הוא ${GIFT_FOLLOWON_PRICE} ש"ח + מע"מ לחודש.`,
    `• שבוע לפני החיוב הראשון יישלח אליך מייל עם התאריך והסכום, כדי שתהיה לך אפשרות להחליט אם להמשיך.`,
    `• ביטול בכל שלב בהודעת מייל אחת אלינו, לפני החיוב הראשון או אחריו. אנחנו מטפלים בזה מיד.`,
    `• ההצעה תקפה ל-${GIFT_OFFER_TTL_DAYS} ימים מרגע שליחת המייל הזה. אחרי כן הקישור נסגר.`,
    ``,
    `הקישור להצטרפות אישי ומיועד עבורך בלבד:`,
    JOIN_LINK_PLACEHOLDER,
    ``,
    `בברכה,`,
    `צוות טיפול חכם`,
  ].join("\n");
}

// טיוטת הצעת המתנה לחיתוך של ריכוז פניות (נוסף 20/10/26). הנוסח של הבעלים,
// מילה במילה (20/10/26): בלי "הפניות מתרכזות", בלי שמות ובלי מספרים. "מספר רב"
// נכון תמיד כאן, כי חיתוך ריכוז דורש לפחות 3 פונים (MIN_SLICE_PEOPLE) - אותו
// סף שבו הטיוטה של פער ההיצע עוברת ל"מספר רב".
export function buildConcentrationDraft(name: string, regionKey: string, rawTreatment: string): string {
  const treatment = treatmentPhrase(rawTreatment);
  const where = regionPhrase(regionKey);
  const demandLine = `בתקופה האחרונה מספר רב של מטופלים חיפשו ${treatment} ${where} דרך מערכת ההתאמות, שבה מוצגים רק מטפלים מקודמים.`;
  return giftOfferDraft(name, demandLine, "הפרופיל שלך מתאים לתחום ולאזור האלה", treatment, where);
}

/** איפה בתוך הקבוצה הפער נראה, כשזה צר מהקבוצה כולה. שורה ריקה אחרת. */
function observedLine(g: { observedRegions: string[]; region: string }): string {
  if (g.observedRegions.length === 0) return "";
  return `החוסר נמדד ב${g.observedRegions.join(", ")} ולא בכל ${g.region} - הכיסוי והמועמדים למטה מוגבלים לשם.\n`;
}

/** תיאור ההיצע בחיתוך: כמה יש, כמה צריך, וכמה מזה נשען על מתנה. */
function supplyLine(g: {
  payingCovering: number;
  paidCovering: number;
  giftCovering: number;
  supplyTarget: number;
}): string {
  if (g.payingCovering === 0) return "אין אף מטפל מקודם בחיתוך הזה.";
  const base = `יש ${g.payingCovering} מטפלים מקודמים מתוך ${g.supplyTarget} שצריך לביקוש הזה`;
  if (g.giftCovering === 0) return `${base}.`;
  if (g.paidCovering === 0) {
    return `${base}, וכולם בקידום מתנה שיפוג - כלומר החיתוך יתרוקן בסיומו.`;
  }
  return `${base} (${g.paidCovering} משלמים, ${g.giftCovering} בקידום מתנה שיפוג).`;
}

export async function runSupplyGaps(): Promise<SupplyGapsResult> {
  const runId = await startAgentRun("supply_gaps", "monitor");
  try {
    const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();

    // אות ביקוש שני, ההכרחי לאיתור חיתוכים דלילים: כל צפייה שהגיעה ממסלול
    // ההתאמה נושאת את האזור והטיפול שהמטופל ביקש - גם כשכן היו מטפלים
    // להציע. אירוע הפער (למטה) נרשם רק כשלא היה אף משלם, ולכן הוא לבדו
    // לא יכול לגלות חיתוך שיש בו מטפל אחד או שניים.
    const [viewsRes, eventsRes, therapists, sentOffers, pastPromoted, concInput] = await Promise.all([
      fetchAllRows<{ viewer_region: string | null; viewer_treatment: string | null; session_id: string | null }>(
        () =>
          supabaseAdmin
            .from("therapist_profile_views")
            .select("viewer_region, viewer_treatment, session_id")
            .not("viewer_region", "is", null)
            .not("viewer_treatment", "is", null)
            .gte("viewed_at", sinceIso)
      ),
      supabaseAdmin
        .from("analytics_events")
        .select("metadata, created_at")
        .eq("event_type", "match_free_fallback")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(1000),
      fetchAllRows<TherapistRow>(() =>
        supabaseAdmin
          .from("therapists")
          .select(
            "id, full_name, email, status, promotion_source, promoted_until, admin_approved, accepting_new_patients, regions, online, training_areas, assessment_types, couples_modalities, age_groups, entity_type, match_paused_until, promoted_since"
          )
          .in("status", ["paying", "approved"])
      ),
      // הצעות מתנה שכבר יצאו: מוציאות את מי שקיבל אותן מבריכת המועמדים,
      // ומשתיקות את הפער שממנו יצאו כל עוד ההמתנה לתשובה נמשכת.
      recentGiftOffers(),
      // מי שהיה במסלול המקודם בשנה האחרונה - לא מועמד/ת למתנה (הבעלים, 22/10/26).
      recentlyPromotedIds(),
      // ריכוז פניות: מי פנה למי בשבועיים האחרונים (contact-concentration-data.ts).
      // כישלון כאן לא מפיל את פערי ההיצע - הם לא תלויים בנתונים האלה.
      loadConcentrationInput().catch((e) => {
        console.error("supply_gaps: concentration input failed:", e instanceof Error ? e.message : e);
        return null;
      }),
    ]);

    // צבירה לפי קבוצת אזור × טיפול. events = כמה מטופלים נתקלו בחיתוך הזה,
    // נספרים לפי סשן כדי שרפרוש לא ייספר כביקוש נוסף.
    // observed = שמות האזורים המלאים שבהם הפער באמת נראה, כשהאות מדויק
    // מספיק לדעת אותם. הצבירה נשארת בקבוצה הגסה (כי viewer_region נשמר
    // גס ואין ממה לגזור אזור מלא), אבל הכיסוי נמדד באזורים שנצפו בפועל -
    // אחרת תת-אזור עשיר מסתיר תת-אזור רעב באותה קבוצה. זה לא תיאורטי:
    // "המרכז והשפלה" מכיל את גוש דן (17 מקודמים למבוגרים) ואת השפלה (3),
    // וכך פער ה-CBT בשפלה נמצא 8 מכוסים מתוך יעד 8 והושתק לגמרי, אף
    // שהוא הפער הנפוץ ביותר באזור (7 מתוך 12 הנפילות לחינמיים).
    type Agg = {
      regionKey: string;
      treatment: string;
      sessions: Set<string>;
      events: number;
      lastSeen: string;
      observed: Set<string>;
    };
    const agg = new Map<string, Agg>();
    const touch = (
      regionKey: string,
      treatment: string,
      sessionKey: string | null,
      at: string,
      observedRegion?: string
    ): void => {
      const key = `${regionKey}|${treatmentKey(treatment)}`;
      const prev = agg.get(key);
      if (prev) {
        if (sessionKey) prev.sessions.add(sessionKey);
        else prev.events += 1;
        if (at > prev.lastSeen) prev.lastSeen = at;
        if (observedRegion) prev.observed.add(observedRegion);
        return;
      }
      agg.set(key, {
        regionKey,
        treatment,
        sessions: new Set(sessionKey ? [sessionKey] : []),
        events: sessionKey ? 0 : 1,
        lastSeen: at,
        observed: new Set(observedRegion ? [observedRegion] : []),
      });
    };

    for (const v of viewsRes) {
      // viewer_region כבר נשמר כמפתח קבוצה ("center"), חוץ מ"אונליין" שנשמר
      // ככה גם הוא - שניהם משמשים כאן כמפתח ישירות.
      const regionKey = String(v.viewer_region ?? "").trim();
      const treatment = String(v.viewer_treatment ?? "").trim();
      if (!regionKey || !treatment) continue;
      touch(regionKey, treatment, v.session_id ?? `anon:${regionKey}|${treatment}`, sinceIso);
    }
    for (const row of (eventsRes.data ?? []) as (FallbackEvent & { created_at: string })[]) {
      const md = row.metadata ?? {};
      const region = String(md.region ?? "").trim();
      if (!region) continue;
      // כאן האזור הוא שם מלא ("צפון השרון") - מתורגם לאותה קבוצה שהצפיות
      // נספרות בה, אחרת אותו חוסר היה מופיע פעמיים בשתי שפות.
      const regionKey = regionGroupOf(region);
      const treatments = asStringArray(md.requested_treatments);
      // בלי טיפול מפורש - הפער הוא אזורי; נרשם תחת "כללי".
      const list = treatments.length > 0 ? treatments : ["כללי"];
      for (const treatment of list) {
        touch(regionKey, treatment, null, row.created_at, region);
      }
    }

    const paying = therapists.filter((t) => t.status === "paying");
    // בריכת המועמדים להצעת מתנה - חינמיים בלבד. תנאי הזכאות עצמם יושבים
    // ב-gift-offer.ts ונבדקים גם כאן וגם שוב ברגע השליחה, כדי שמי שמקודם
    // לא יקבל הצעת מתנה בשום מסלול.
    const nowIso = new Date().toISOString();
    const offeredRecently = new Set(sentOffers.map((o) => o.therapist_id));
    // בלי כתובת מייל אין למי לשלוח - מועמד כזה רק היה יוצר הצעה שנחסמת
    // בשליחה, ולכן הוא לא נכנס לבריכה מלכתחילה.
    const freePool = therapists.filter(
      (t) => Boolean(t.email) && giftEligibilityError(t, nowIso) === null && !pastPromoted.has(t.id)
    );

    // הצעות פתוחות בחיתוך - טרם הגיעה עליהן תשובה. נספרות ולא רק
    // מסמנות "מחכים": כל הצעה סוגרת לכל היותר מטפל אחד מתוך הפער.
    const waitCutoff = new Date(Date.now() - GIFT_OFFER_WAIT_DAYS * 86_400_000).toISOString();
    const waitingByGap = new Map<string, { count: number; latest: string }>();
    // חיתוך שיצאה בו הצעה, חלון ההמתנה חלף, והוא עדיין פער - כלומר לא
    // התקבלה תשובה. הוא חוזר לתור עם המועמדים הנותרים בלבד, והפעם עם
    // ההקשר: למי כבר פנינו ומתי.
    const lapsedByGap = new Map<string, { name: string; sentAt: string }>();
    const offerNames = new Map<string, string>(
      therapists.map((t) => [t.id, t.full_name ?? ""])
    );
    // הצעות ריכוז פניות (מ-20/10/26) נרשמות באזור מלא ("גוש דן") ולא בתווית
    // הקבוצה ("המרכז והשפלה"). לצורך הפערים הן נספרות גם בקבוצה שלהן - אחרת
    // פער ברמת הקבוצה לא היה רואה שכבר יצאה הצעה לאותו מקום ולאותו תחום.
    // waitingGroupLabelled שומר רק את מה שנרשם בתווית קבוצה, לבדיקה של הריכוז
    // עצמו: הצעה בגוש דן לא משתיקה ריכוז בשפלה.
    const waitingGroupLabelled = new Set<string>();
    const bump = (key: string, sentAt: string): void => {
      const prev = waitingByGap.get(key);
      waitingByGap.set(key, {
        count: (prev?.count ?? 0) + 1,
        latest: prev && prev.latest > sentAt ? prev.latest : sentAt,
      });
    };
    for (const o of sentOffers) {
      const key = `${o.region}|${treatmentKey(o.treatment)}`;
      if (o.sent_at >= waitCutoff) {
        bump(key, o.sent_at);
        const isFullRegion = (ALL_REGIONS as readonly string[]).includes(o.region);
        const groupLabel = isFullRegion ? regionGroupLabel(regionGroupOf(o.region)) : null;
        if (groupLabel && groupLabel !== o.region) bump(`${groupLabel}|${treatmentKey(o.treatment)}`, o.sent_at);
        if (!isFullRegion) waitingGroupLabelled.add(key);
        continue;
      }
      const prevLapsed = lapsedByGap.get(key);
      if (!prevLapsed || o.sent_at > prevLapsed.sentAt) {
        lapsedByGap.set(key, { name: offerNames.get(o.therapist_id) ?? "", sentAt: o.sent_at });
      }
    }
    const waitingGaps: WaitingGap[] = [];

    // התאמה לקבוצת אזור: מטפל מכסה את הקבוצה אם הוא מכסה אחד מהאזורים שבה.
    // "online" אינו מקום אלא אופן עבודה, ולכן נבדק מול דגל האונליין.
    // observed מצמצם את הבדיקה לאזורים שבהם הפער נראה בפועל; בלעדיו (ביקוש
    // שהגיע רק מהצפיות, שנשמרות במפתח גס) נבדקת הקבוצה כולה כמקודם.
    const inGapRegion = (t: TherapistRow, regionKey: string, observed?: Set<string>): boolean => {
      if (regionKey === "online") return t.online === true;
      const scope = observed && observed.size > 0 ? [...observed] : (REGION_GROUPS[regionKey] ?? []);
      return scope.some((r) => coversRegion(t.regions ?? [], r));
    };

    // "all" = המטפל עוסק בכל רכיבי השילוב (ההתאמה האמיתית לבקשת המטופל).
    // "any" = עוסק לפחות באחד מהם - תשובה חלקית, אבל תשובה.
    const matchesGap = (
      t: TherapistRow,
      regionKey: string,
      treatment: string,
      mode: "all" | "any" = "any",
      observed?: Set<string>
    ): boolean => {
      if (!inGapRegion(t, regionKey, observed)) return false;
      const parts = treatmentParts(treatment);
      if (parts.length === 0 || parts.some((p) => canonicalPart(p) === "כללי")) return true;
      const areas = t.training_areas ?? [];
      const covers = (p: string) => overlaps(areas, [matchPart(p)]);
      return mode === "all" ? parts.every(covers) : parts.some(covers);
    };

    /** איזה רכיב מהשילוב המטפל מכסה - לניסוח כן בטיוטה. */
    const coveredPartOf = (t: TherapistRow, treatment: string): string | undefined => {
      const parts = treatmentParts(treatment);
      if (parts.length < 2) return undefined;
      return parts.find((p) => overlaps(t.training_areas ?? [], [matchPart(p)]));
    };

    const gaps: SupplyGap[] = [];
    let skippedUnactionable = 0;
    for (const a of agg.values()) {
      if (UNACTIONABLE_GROUPS.has(a.regionKey)) {
        skippedUnactionable += 1;
        continue;
      }
      const demand = a.events + a.sessions.size;
      if (demand < MIN_EVENTS) continue;
      const covering = paying.filter((t) => matchesGap(t, a.regionKey, a.treatment, "any", a.observed));
      const payingCovering = covering.length;
      const paidCovering = covering.filter((t) => PAID_SOURCES.has(t.promotion_source ?? "")).length;
      const giftCovering = payingCovering - paidCovering;
      const supplyTarget = supplyTargetFor(demand);
      // "לא מספיק להציע": חיתוך ריק, או חיתוך דליל של מטפל אחד או שניים.
      // הפער נקבע ביחס לביקוש, לא במספר מוחלט.
      if (payingCovering >= supplyTarget) continue;

      const regionLabel = regionGroupLabel(a.regionKey);
      // מוצג רק כשהוא באמת מצמצם - פער שנראה בכל אזורי הקבוצה (או שהגיע
      // מהצפיות בלבד) לא צריך הבהרה.
      const groupRegions = REGION_GROUPS[a.regionKey] ?? [];
      const narrowedTo =
        a.observed.size > 0 && a.observed.size < groupRegions.length ? [...a.observed] : [];

      // הצעות שכבר בדרך לחיתוך הזה. עד כה הספיקה הצעה אחת כדי
      // להשתיק את החיתוך לגמרי, וזה הגיוני כשהיעד הוא מטפל אחד. כשהיעד
      // הוא ארבעה, הצעה אחת שלא נענתה הקפיאה אזור שלם - כך ירושלים
      // נעלמה מההמלצות. לכן נספרות ההצעות הפתוחות כאילו כולן יתקבלו,
      // ורק אם גם אז החיתוך מלא - מחכים.
      const gapKey = `${regionLabel}|${treatmentKey(a.treatment)}`;
      const waiting = waitingByGap.get(gapKey);
      if (waiting && payingCovering + waiting.count >= supplyTarget) {
        waitingGaps.push({
          region: regionLabel,
          treatment: a.treatment,
          sentAt: waiting.latest,
          pending: waiting.count,
          needed: supplyTarget,
          covering: payingCovering,
        });
        continue;
      }

      // התאמה מלאה קודמת: מי שעוסק בכל רכיבי השילוב הוא התשובה הנכונה
      // למטופל. רק אם אין כזה עוברים למי שעוסק בחלק ממנו, והטיוטה תאמר
      // את זה במפורש.
      const fullMatch = freePool.filter((t) => matchesGap(t, a.regionKey, a.treatment, "all", a.observed));
      const matching = fullMatch.length > 0
        ? fullMatch
        : freePool.filter((t) => matchesGap(t, a.regionKey, a.treatment, "any", a.observed));
      const partialOnly = fullMatch.length === 0;
      const fresh = matching.filter((t) => !offeredRecently.has(t.id));
      // כל המתאימים כבר קיבלו הצעה בחלון הצינון: אין למי להציע, אבל גם אסור
      // להכריז "אין אף מטפל מתאים" ולשלוח את זה לגיוס - זו הצהרה לא נכונה.
      if (matching.length > 0 && fresh.length === 0) continue;

      const candidates: GapCandidate[] = fresh.slice(0, MAX_CANDIDATES_PER_GAP).map((t) => ({
        therapist_id: t.id,
        full_name: t.full_name ?? "",
        email: t.email ?? "",
        // הטיוטה היוצאת נוקבת באזור שבו החוסר באמת נמדד ובביקוש שנמדד שם,
        // ולא בקבוצה כולה: לנמען במודיעין "באזור המרכז והשפלה" נכון אך רחב,
        // ו"באזור השפלה והמרכז" הוא מה שקרה בפועל. תווית הפער עצמה (g.region)
        // נשארת גסה, כי היא מפתח הצינון מול הצעות שכבר יצאו.
        draft: buildGiftDraft(
          t.full_name ?? "",
          narrowedTo.length > 0 ? narrowedTo.join(", ") : a.regionKey,
          a.treatment,
          narrowedTo.length > 0 ? a.events : demand,
          partialOnly ? coveredPartOf(t, a.treatment) : undefined
        ),
      }));

      const lapsed = lapsedByGap.get(gapKey);
      const kind: "gift" | "recruit" = candidates.length > 0 ? "gift" : "recruit";
      gaps.push({
        key: `gap:${kind}:${a.regionKey}|${a.treatment}`,
        region: regionLabel,
        treatment: a.treatment,
        events: demand,
        lastSeen: a.lastSeen,
        payingCovering,
        paidCovering,
        giftCovering,
        supplyTarget,
        candidates,
        kind,
        draftEmail: kind === "gift" ? candidates[0].draft : null,
        observedRegions: narrowedTo,
      });
    }

    gaps.sort((x, y) => y.events - x.events);
    const giftGaps = gaps.filter((g) => g.kind === "gift");
    const recruitGaps = gaps.filter((g) => g.kind === "recruit");

    // ── ריכוז פניות (20/10/26) ─────────────────────────────────────────────
    // חיתוך שאין בו חוסר, אבל מעט מטפלים מקבלים בו את רוב הפניות: הצעת מתנה
    // לעוד מטפלים מאותו אזור ותחום, באותו מסלול שליחה ובאותם צינונים כמו
    // פער היצע. חיתוך שכבר עלה כפער לא מוצע פעמיים.
    const conc = concInput
      ? analyzeConcentration({
          contacts: concInput.contacts,
          therapists,
          lastPausedAt: concInput.lastPausedAt,
          paidSince: concInput.paidSince,
        })
      : { hot: [], slices: [], freeze: [] };
    const gapKeys = new Set(gaps.map((g) => `${g.region}|${treatmentKey(g.treatment)}`));
    type ConcOffer = { slice: ConcentrationSlice; regionLabel: string; candidates: GapCandidate[]; key: string };
    const concOffers: ConcOffer[] = [];
    const concentrated = conc.slices.filter(isConcentrated);
    // מטפל שעובד בשני אזורים (חיפה ועמק יזרעאל) עלה כמועמד בשני כרטיסים, והשליחה
    // מהכרטיס השני הייתה נחסמת בצינון. כל מועמד מופיע בכרטיס אחד בלבד.
    // גם מי שכבר מועמד/ת בכרטיס של פער היצע באותה ריצה.
    const assigned = new Set<string>(gaps.flatMap((g) => g.candidates.map((c) => c.therapist_id)));
    for (const s of concentrated) {
      const groupKey = s.region === ONLINE_REGION ? "online" : regionGroupOf(s.region);
      if (UNACTIONABLE_GROUPS.has(groupKey)) continue;
      // אותו חיתוך ברזולוציה של פערי ההיצע (קבוצת אזורים) - אם הוא כבר פער,
      // ההצעה שם מכסה אותו.
      if (gapKeys.has(`${regionGroupLabel(groupKey)}|${treatmentKey(s.treatment)}`)) continue;
      // ההצעה נרשמת באזור המלא ("גוש דן"), ולכן גם ההמתנה לתשובה נבדקת שם.
      // וגם ברמת הקבוצה: הצעת פער שיצאה לאחרונה ל"המרכז והשפלה" כבר מוסיפה
      // מטפלים לגוש דן, ואין טעם לשלוח עוד לפני שידוע מה קרה איתה.
      const regionLabel = s.region === ONLINE_REGION ? regionGroupLabel("online") : s.region;
      if (
        waitingByGap.has(`${regionLabel}|${treatmentKey(s.treatment)}`) ||
        waitingGroupLabelled.has(`${regionGroupLabel(groupKey)}|${treatmentKey(s.treatment)}`)
      ) {
        continue;
      }
      const fresh = freePool.filter(
        (t) =>
          !offeredRecently.has(t.id) &&
          !assigned.has(t.id) &&
          (s.region === ONLINE_REGION ? t.online === true : coversRegion(t.regions ?? [], s.region)) &&
          overlaps(t.training_areas ?? [], [matchPart(s.treatment)])
      );
      if (fresh.length === 0) continue;
      const label = treatmentLabel(s.treatment);
      const picked = fresh.slice(0, MAX_CANDIDATES_PER_GAP);
      for (const t of picked) assigned.add(t.id);
      concOffers.push({
        slice: s,
        regionLabel,
        key: `conc:gift:${s.region}|${s.treatment}`,
        candidates: picked.map((t) => ({
          therapist_id: t.id,
          full_name: t.full_name ?? "",
          email: t.email ?? "",
          draft: buildConcentrationDraft(t.full_name ?? "", s.region, label),
        })),
      });
    }

    // הצעות לתור, עם החלמה אוטומטית: פער שנסגר (נוסף מטפל משלם, או שכבר
    // יצאה בו הצעה) סוגר את ההצעה שלו בריצה הבאה.
    const gapActions = gaps.map((g) =>
        g.kind === "gift"
          ? {
              actionType: "gift_offer",
              // פעולה: יש כאן מייל לשלוח, ורק אתה יכול להכריע.
              kind: "action" as const,
              title: `הצעת קידום מתנה: ${g.treatment} · ${g.region}`,
              body:
                `${g.events} מטופלים חיפשו ${g.treatment} באזור ${g.region}; ` +
                `${supplyLine(g)}\n` +
                observedLine(g) +
                `מועמדים מתאימים במאגר: ${g.candidates.map((c) => `${c.full_name} (${c.email})`).join(", ")}\n` +
                `הטיוטה ניתנת לעריכה למטה, והמייל יוצא רק בלחיצה שלך.`,
              entityType: "therapist",
              entityId: g.candidates[0].therapist_id,
              entityLabel: g.candidates[0].full_name,
              dedupeKey: g.key,
              payload: {
                region: g.region,
                treatment: g.treatment,
                gift_months: GIFT_MONTHS,
                gap_key: g.key,
                subject: GIFT_SUBJECT,
                candidates: g.candidates,
                // כמה החיתוך צריך וכמה כבר יש בו - מסלול השליחה קורא
                // את אלה כדי לדעת אם אחרי השליחה נותר פער למלא.
                paying_covering: g.payingCovering,
                supply_target: g.supplyTarget,
              },
            }
          : {
              actionType: "recruit_gap",
              // ממצא: תיאור מצב היצע, לא משימה. הפעולה שנגזרת ממנו (פרסום
              // גיוס) לא מתבצעת מכאן.
              kind: "finding" as const,
              title: `פער גיוס: אין מספיק מטפלים ל${g.treatment} באזור ${g.region}`,
              body:
                `${g.events} מטופלים חיפשו ${g.treatment} באזור ${g.region}. ` +
                `${supplyLine(g)} ` +
                `וגם אין במאגר אף מטפל חינמי מאושר שמתאים. זה אזור/תחום לפרסום גיוס ממוקד.\n` +
                observedLine(g),
              dedupeKey: g.key,
              payload: { region: g.region, treatment: g.treatment },
            }
    );

    // הצעות הריכוז נכנסות לאותו תור ובאותו סוג פעולה (gift_offer), ולכן
    // השליחה, הצינון והתיעוד הם אלה של gift-offer.ts - אין מסלול שליחה שני.
    // supply_target = כמה מטפלים חדשים מציעים לחיתוך; paying_covering = 0,
    // כי כאן היעד הוא "עוד אפשרויות" ולא השלמה למספר מינימלי.
    const concActions = concOffers.map((o) => {
      const s = o.slice;
      const label = treatmentLabel(s.treatment);
      const where = regionDisplay(s.region);
      return {
        actionType: "gift_offer",
        kind: "action" as const,
        title: `הצעת קידום מתנה (ריכוז פניות): ${label} · ${where}`,
        body:
          `${s.slicePeople} מטופלים שחיפשו ${label} פנו ב-${CONCENTRATION_WINDOW_DAYS} הימים האחרונים למקודמים ב${where}; ` +
          `${s.hotPeople} מהם ל-${s.hot.length === 1 ? "מטפל/ת אחד/ת" : `${s.hot.length} מטפלים`} בלבד: ` +
          `${s.hot.map((h) => `${h.name} (${h.people} פונים בסך הכל)`).join(", ")}.\n` +
          `מקודמים בחיתוך: ${s.covering} (${s.paidCovering} משלמים)` +
          (s.idle > 0
            ? `, ${s.idle} מהם בלי אף פנייה בשבועיים - מטפל/ת נוסף/ת עלול/ה להתחלק איתם ולא עם העמוסים.\n`
            : `.\n`) +
          `מועמדים מתאימים במאגר: ${o.candidates.map((c) => `${c.full_name} (${c.email})`).join(", ")}\n` +
          `הטיוטה ניתנת לעריכה למטה, והמייל יוצא רק בלחיצה שלך.`,
        entityType: "therapist",
        entityId: o.candidates[0].therapist_id,
        entityLabel: o.candidates[0].full_name,
        dedupeKey: o.key,
        payload: {
          region: o.regionLabel,
          treatment: label,
          gift_months: GIFT_MONTHS,
          gap_key: o.key,
          subject: GIFT_SUBJECT,
          candidates: o.candidates,
          paying_covering: 0,
          supply_target: NEW_PER_SLICE,
          reason: "concentration",
        },
      };
    });
    // ── הצעות להקפאה שקטה (20/10/26) ──────────────────────────────────────
    // "חצי-אוטומטי": פעם בשבועיים עולה לתור הצעה לכל מקודם/ת עמוס/ה שעומד/ת
    // בכל הכללים (contact-concentration.ts + חלון הערבות); ההקפאה רק בלחיצה,
    // ושם הכול נבדק שוב. בריצה שבין שתי בדיקות לא עולות הצעות חדשות, אבל
    // הצעה שעוד ממתינה ועדיין בטוחה נשמרת - אחרת הסנכרון היה סוגר אותה.
    const [freeze, lastBatch, pendingFreezeKeys] = await Promise.all([
      concInput ? serverFreezeChecks(conc.freeze) : Promise.resolve([]),
      lastFreezeBatchAt(),
      pendingFreezeProposalKeys(),
    ]);
    // כשלא הצלחנו לקרוא מתי הייתה הבדיקה הקודמת - לא מעלים מנה חדשה, וגם לא
    // רושמים זמן מנה (אחרת כישלון רגעי היה מזיז את השעון בשבועיים).
    const freezeDue =
      concInput !== null &&
      lastBatch.ok &&
      (!lastBatch.at || Date.now() - Date.parse(lastBatch.at) >= (FREEZE_CHECK_EVERY_DAYS - 1) * 86_400_000);
    const freezeKey = (id: string) => `conc:freeze:${id}`;
    const freezeActions = freeze
      .filter((f) => f.safe && (freezeDue || pendingFreezeKeys.has(freezeKey(f.id))))
      .map((f) => {
        const w = f.weakest;
        return {
          actionType: FREEZE_ACTION_TYPE,
          kind: "action" as const,
          title: `הצעה להקפאה שקטה לשבוע: ${f.name}`,
          body:
            `${f.people} פונים ב-${CONCENTRATION_WINDOW_DAYS} הימים האחרונים, ${f.matchPeople} מהם מהשאלון.\n` +
            (w
              ? `גם בלי ${f.name} נשארות לפחות ${w.alternatives} חלופות פעילות (${treatmentLabel(w.treatment)} · ${regionDisplay(w.region)}).\n`
              : "") +
            `ההקפאה: ${FREEZE_DAYS} ימים מתוצאות השאלון בלבד. המאגר, עמודי הערים והחיוב לא משתנים, ולא נשלח שום מייל.\n` +
            `בלחיצה כל הבדיקות רצות שוב על הנתונים של עכשיו.`,
          entityType: "therapist",
          entityId: f.id,
          entityLabel: f.name,
          dedupeKey: freezeKey(f.id),
          payload: {
            therapist_id: f.id,
            people: f.people,
            match_people: f.matchPeople,
            weakest: f.weakest,
          },
        };
      });

    const actions = [...gapActions, ...concActions, ...freezeActions];
    const concSummary: ConcentrationSummary[] = concentrated.map((c) => ({
      region: c.region,
      treatment: treatmentLabel(c.treatment),
      hot: c.hot.map((h) => ({ id: h.id, name: h.name, people: h.people })),
      slicePeople: c.slicePeople,
      hotPeople: c.hotPeople,
      covering: c.covering,
      idle: c.idle,
      offered: concOffers.some((o) => o.slice === c),
    }));

    // בלי managedKeys: הריצה מחשבת מחדש את כל תמונת הפערים, ולכן כל הצעה
    // ממתינה שהריצה הזו לא הפיקה מחדש כבר לא רלוונטית ונסגרת. (עם רשימת
    // המפתחות של הריצה הנוכחית, כפי שהיה קודם, שום הצעה לא הייתה נסגרת
    // לעולם - הרשימה זהה לרשימת הפעילים, וההחלמה הייתה קוד מת.)
    await syncAgentAlerts("supply_gaps", actions, {
      // משותף לכל סוגי ההצעות של הסוכן: פער, ריכוז פניות והקפאה.
      recoveryNote: "המצב השתנה מאז ההצעה (כיסוי משלם, הצעה שכבר יצאה, או שהמטפל/ת כבר לא עומד/ת בכללים) - ההצעה נסגרה אוטומטית",
    });

    // רענון הצעות שכבר ממתינות בתור: createAgentAction לא דורס הצעה קיימת
    // עם אותו מפתח, ולכן בלי זה טיוטה שהנוסח שלה השתנה (או ספירת ביקוש
    // שהתעדכנה) הייתה נשארת תקועה בגרסה שנוצרה ביום הראשון.
    // כמה הצעות כבר יצאו מכרטיס ממתין (sent_count, נכתב במסלול השליחה) נשמר
    // ברענון: לפיו הכרטיס מציג "סיום" במקום "דחה".
    const { data: pendingRows } = await supabaseAdmin
      .from("agent_actions")
      .select("dedupe_key, payload")
      .eq("agent", "supply_gaps")
      .eq("status", "pending");
    const sentCountByKey = new Map<string, number>();
    for (const r of pendingRows ?? []) {
      const n = Number((r.payload as { sent_count?: unknown } | null)?.sent_count ?? 0);
      if (r.dedupe_key && n > 0) sentCountByKey.set(r.dedupe_key as string, n);
    }
    for (const a of actions) {
      if (!a.dedupeKey) continue;
      const sentCount = sentCountByKey.get(a.dedupeKey);
      const payload = a.payload ? (sentCount ? { ...a.payload, sent_count: sentCount } : a.payload) : null;
      const { error } = await supabaseAdmin
        .from("agent_actions")
        .update({ title: a.title, body: a.body ?? null, payload })
        .eq("agent", "supply_gaps")
        .eq("dedupe_key", a.dedupeKey)
        .eq("status", "pending");
      if (error) console.error(`supply_gaps: refresh of ${a.dedupeKey} failed:`, error.message);
    }

    await finishAgentRun(runId, {
      status: gaps.length > 0 || concOffers.length > 0 ? "ok" : "empty",
      summary:
        (gaps.length > 0
          ? `${gaps.length} פערי היצע: ${giftGaps.length} להצעת מתנה, ${recruitGaps.length} לגיוס` +
            (waitingGaps.length > 0 ? `, ${waitingGaps.length} ממתינים לתשובה` : "")
          : waitingGaps.length > 0
            ? `אין פערים חדשים; ${waitingGaps.length} ממתינים לתשובה על הצעה שנשלחה`
            : "אין פערי היצע פתוחים") +
        (concentrated.length > 0
          ? ` · ${concentrated.length} ריכוזי פניות (${concOffers.length} להצעת מתנה)`
          : ""),
      details: {
        gift: giftGaps.map((g) => ({ region: g.region, treatment: g.treatment, events: g.events })),
        recruit: recruitGaps.map((g) => ({ region: g.region, treatment: g.treatment, events: g.events })),
        waiting: waitingGaps,
        cooldown_days: GIFT_OFFER_COOLDOWN_DAYS,
        min_supply_per_slice: MIN_SUPPLY_PER_SLICE,
        skipped_unactionable: skippedUnactionable,
        // ריכוז פניות והקפאה - לתצוגה בעמוד הסוכנים גם בלי ריצה ידנית.
        concentration: concSummary,
        freeze,
        // מתי עלתה לאחרונה מנת הצעות הקפאה - קובע מתי הבאה (פעם בשבועיים).
        freeze_batch_at: freezeDue ? new Date().toISOString() : lastBatch.ok ? lastBatch.at : null,
        freeze_proposals: freezeActions.length,
      },
    });

    return {
      ok: true,
      gaps,
      giftGaps,
      recruitGaps,
      waitingGaps,
      concentration: concSummary,
      concentrationOffers: concOffers.length,
      freeze,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishAgentRun(runId, { status: "error", error: msg });
    return {
      ok: false,
      gaps: [],
      giftGaps: [],
      recruitGaps: [],
      waitingGaps: [],
      concentration: [],
      concentrationOffers: 0,
      freeze: [],
      error: msg,
    };
  }
}

/** מתי עלתה לאחרונה מנה של הצעות הקפאה (נשמר בפרטי הריצה). */
async function lastFreezeBatchAt(): Promise<{ ok: true; at: string | null } | { ok: false }> {
  const { data, error } = await supabaseAdmin
    .from("agent_runs")
    .select("details")
    .eq("agent", "supply_gaps")
    .not("details->>freeze_batch_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("supply_gaps: last freeze batch lookup failed:", error.message);
    return { ok: false };
  }
  const at = (data?.details as Record<string, unknown> | null)?.freeze_batch_at;
  return { ok: true, at: typeof at === "string" ? at : null };
}

/** הצעות הקפאה שממתינות בתור - נשמרות גם בריצה שבין שתי בדיקות. */
async function pendingFreezeProposalKeys(): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from("agent_actions")
    .select("dedupe_key")
    .eq("agent", "supply_gaps")
    .eq("action_type", FREEZE_ACTION_TYPE)
    .eq("status", "pending");
  if (error) {
    console.error("supply_gaps: pending freeze proposals lookup failed:", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.dedupe_key as string).filter(Boolean));
}
