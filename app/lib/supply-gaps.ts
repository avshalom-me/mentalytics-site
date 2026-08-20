import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { fetchAllRows } from "./fetch-all-rows";
import { JOIN_LINK_PLACEHOLDER } from "./gift-checkout";
import { coversRegion, overlaps } from "./match-fallback";
import { REGION_GROUPS, REGION_GROUP_LABELS, regionGroupOf } from "./regions";
import { startAgentRun, finishAgentRun, syncAgentAlerts } from "./agent-infra";
import {
  giftEligibilityError,
  recentGiftOffers,
  GIFT_OFFER_MONTHS,
  GIFT_OFFER_WAIT_DAYS,
  GIFT_OFFER_COOLDOWN_DAYS,
} from "./gift-offer";

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
// עד כמה מטפלים משלמים בחיתוך עדיין נחשב "לא מספיק להציע". 2 = גם חיתוך
// עם מטפל אחד או שניים נחשב פער, לא רק חיתוך ריק לגמרי.
const THIN_SUPPLY_MAX = Number(process.env.SUPPLY_GAP_THIN_MAX ?? 2);

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
  age_groups: string[] | null;
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
};

export type SupplyGap = {
  key: string;
  region: string;
  treatment: string;
  events: number; // כמה מטופלים נתקלו בפער
  lastSeen: string;
  payingCovering: number; // מטפלים משלמים שמכסים את החיתוך
  candidates: GapCandidate[]; // מטפלים חינמיים שמתאימים - יעד ההצעה
  kind: "gift" | "recruit";
  draftEmail: string | null; // טיוטה מוכנה למשלוח ידני אחרי אישור
};

export type SupplyGapsResult = {
  ok: boolean;
  gaps: SupplyGap[];
  giftGaps: SupplyGap[];
  recruitGaps: SupplyGap[];
  waitingGaps: WaitingGap[];
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

// ראשי תיבות לועזיים (cbt/dbt/emdr) נשמרים במאגר באותיות קטנות ונראים
// שבורים בתוך משפט בעברית - מוצגים באותיות גדולות.
function treatmentLabel(t: string): string {
  return /^[a-z0-9\s-]+$/i.test(t) ? t.toUpperCase() : t;
}

// ── חיתוך משולב ────────────────────────────────────────────────────────
// מטופל שמבקש "CBT + טיפול דינאמי" מייצר מחרוזת אחת, ועד 20/8/26 היא
// הושוותה כמכלול מול תחומי ההתמחות של המטפל. אין מטפל שרשום אצלו תחום
// בשם "CBT + טיפול דינאמי", ולכן אף מועמד לא נמצא לעולם וכל חיתוך משולב
// סווג כ"אין לנו אף מטפל" ונשלח לרשימת הגיוס. בפועל 15 מתוך 26 פערי
// הגיוס היו כאלה, והביקוש הגדול ביותר בנתונים הוא בדיוק שילוב כזה.
//
// נוסף לזה פיצול וריאנטים: "טיפול CBT + טיפול דינאמי" ו-"CBT + טיפול
// דינאמי" נספרו כשני חיתוכים נפרדים, כל אחד מתחת לסף - וכך ריכוז ביקוש
// אמיתי נראה כפירורים.

function normTreat(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}

// וריאנטים שהם אותו תחום. הרשימה מכוונת ומינימלית: רק תחילית "טיפול"
// לפני ראשי תיבות לועזיים, שם ההבדל הוא ניסוח ולא תוכן.
const TREATMENT_ALIASES: Record<string, string> = {
  "טיפול cbt": "cbt",
  "טיפול dbt": "dbt",
  "טיפול emdr": "emdr",
  "טיפול cpt": "cpt",
  "טיפול act": "act",
};

function canonicalPart(raw: string): string {
  const n = normTreat(raw);
  return TREATMENT_ALIASES[n] ?? n;
}

/** פירוק "CBT + טיפול דינאמי" לרכיביו, בלי כפילויות ובסדר קבוע. */
export function treatmentParts(raw: string): string[] {
  const parts = raw
    .split("+")
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [raw.trim()].filter(Boolean);
}

function canonicalParts(raw: string): string[] {
  return Array.from(new Set(treatmentParts(raw).map(canonicalPart))).sort();
}

/** מפתח הצבירה: שני ניסוחים של אותו שילוב מתמזגים לחיתוך אחד. */
function treatmentKey(raw: string): string {
  return canonicalParts(raw).join(" + ");
}

/** ניסוח קריא לשילוב: "שילוב של CBT וטיפול דינאמי", "X, Y ו-Z".
 *  ו' לפני מילה לועזית מקבלת מקף ("ו-CPT"), אחרת היא נדבקת אליה. */
function joinWithVav(word: string): string {
  return /^[a-z0-9]/i.test(word) ? `ו-${word}` : `ו${word}`;
}

function treatmentPhrase(raw: string): string {
  const parts = treatmentParts(raw).map(treatmentLabel);
  if (parts.length === 1) return parts[0];
  const last = joinWithVav(parts[parts.length - 1]);
  const head = parts.slice(0, -1).join(", ");
  // "שילוב של" - כדי שהמטפל יבין שהמטופל ביקש את הצירוף, ולא שהיו כמה
  // מטופלים שכל אחד ביקש משהו אחר.
  return `שילוב של ${head} ${last}`;
}

// טיוטת הצעת הקידום. תבנית קבועה בטון עובדתי-מסייע: מובילה בצורך שלנו,
// לא במספרי הביצועים של המטפל, ובלי ניסוחים שיווקיים.
function buildGiftDraft(
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

  return [
    `שלום ${name},`,
    ``,
    demandLine,
    ``,
    `${fitLine}, ולכן אנחנו מציעים לך להצטרף לקידום במסלול הבא: ${GIFT_MONTHS} חודשים ראשונים ללא תשלום, ולאחריהם 140 ש"ח + מע"מ לחודש.`,
    ``,
    `מה זה אומר בפועל:`,
    `• הפרופיל שלך ייכנס למערכת ההתאמות ויוצג למטופלים שמחפשים ${treatment} ${where}, מיד עם ההצטרפות.`,
    `• ב-${GIFT_MONTHS} החודשים הראשונים לא נגבה תשלום.`,
    `• שבוע לפני החיוב הראשון יישלח אליך מייל עם התאריך והסכום, כדי שתהיה לך אפשרות להחליט אם להמשיך.`,
    `• ביטול בכל שלב בהודעת מייל אחת אלינו, לפני החיוב הראשון או אחריו. אנחנו מטפלים בזה מיד.`,
    ``,
    `הקישור להצטרפות אישי ומיועד עבורך בלבד:`,
    JOIN_LINK_PLACEHOLDER,
    ``,
    `בברכה,`,
    `צוות טיפול חכם`,
  ].join("\n");
}

export async function runSupplyGaps(): Promise<SupplyGapsResult> {
  const runId = await startAgentRun("supply_gaps", "monitor");
  try {
    const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();

    // אות ביקוש שני, ההכרחי לאיתור חיתוכים דלילים: כל צפייה שהגיעה ממסלול
    // ההתאמה נושאת את האזור והטיפול שהמטופל ביקש - גם כשכן היו מטפלים
    // להציע. אירוע הפער (למטה) נרשם רק כשלא היה אף משלם, ולכן הוא לבדו
    // לא יכול לגלות חיתוך שיש בו מטפל אחד או שניים.
    const [viewsRes, eventsRes, therapists, sentOffers] = await Promise.all([
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
            "id, full_name, email, status, promotion_source, promoted_until, admin_approved, accepting_new_patients, regions, online, training_areas, age_groups"
          )
          .in("status", ["paying", "approved"])
      ),
      // הצעות מתנה שכבר יצאו: מוציאות את מי שקיבל אותן מבריכת המועמדים,
      // ומשתיקות את הפער שממנו יצאו כל עוד ההמתנה לתשובה נמשכת.
      recentGiftOffers(),
    ]);

    // צבירה לפי קבוצת אזור × טיפול. events = כמה מטופלים נתקלו בחיתוך הזה,
    // נספרים לפי סשן כדי שרפרוש לא ייספר כביקוש נוסף.
    type Agg = { regionKey: string; treatment: string; sessions: Set<string>; events: number; lastSeen: string };
    const agg = new Map<string, Agg>();
    const touch = (regionKey: string, treatment: string, sessionKey: string | null, at: string): void => {
      const key = `${regionKey}|${treatmentKey(treatment)}`;
      const prev = agg.get(key);
      if (prev) {
        if (sessionKey) prev.sessions.add(sessionKey);
        else prev.events += 1;
        if (at > prev.lastSeen) prev.lastSeen = at;
        return;
      }
      agg.set(key, {
        regionKey,
        treatment,
        sessions: new Set(sessionKey ? [sessionKey] : []),
        events: sessionKey ? 0 : 1,
        lastSeen: at,
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
        touch(regionKey, treatment, null, row.created_at);
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
    const freePool = therapists.filter((t) => Boolean(t.email) && giftEligibilityError(t, nowIso) === null);

    // חיתוכים שיצאה בהם הצעה בטווח ההמתנה - לא מציעים שוב עד שתגיע תשובה.
    const waitCutoff = new Date(Date.now() - GIFT_OFFER_WAIT_DAYS * 86_400_000).toISOString();
    const waitingByGap = new Map<string, string>();
    // חיתוך שיצאה בו הצעה, חלון ההמתנה חלף, והוא עדיין פער - כלומר לא
    // התקבלה תשובה. הוא חוזר לתור עם המועמדים הנותרים בלבד, והפעם עם
    // ההקשר: למי כבר פנינו ומתי.
    const lapsedByGap = new Map<string, { name: string; sentAt: string }>();
    const offerNames = new Map<string, string>(
      therapists.map((t) => [t.id, t.full_name ?? ""])
    );
    for (const o of sentOffers) {
      const key = `${o.region}|${treatmentKey(o.treatment)}`;
      if (o.sent_at >= waitCutoff) {
        const prev = waitingByGap.get(key);
        if (!prev || o.sent_at > prev) waitingByGap.set(key, o.sent_at);
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
    const inGapRegion = (t: TherapistRow, regionKey: string): boolean =>
      regionKey === "online"
        ? t.online === true
        : (REGION_GROUPS[regionKey] ?? []).some((r) => coversRegion(t.regions ?? [], r));

    // "all" = המטפל עוסק בכל רכיבי השילוב (ההתאמה האמיתית לבקשת המטופל).
    // "any" = עוסק לפחות באחד מהם - תשובה חלקית, אבל תשובה.
    const matchesGap = (
      t: TherapistRow,
      regionKey: string,
      treatment: string,
      mode: "all" | "any" = "any"
    ): boolean => {
      if (!inGapRegion(t, regionKey)) return false;
      const parts = treatmentParts(treatment);
      if (parts.length === 0 || parts.some((p) => canonicalPart(p) === "כללי")) return true;
      const areas = t.training_areas ?? [];
      const covers = (p: string) => overlaps(areas, [p]);
      return mode === "all" ? parts.every(covers) : parts.some(covers);
    };

    /** איזה רכיב מהשילוב המטפל מכסה - לניסוח כן בטיוטה. */
    const coveredPartOf = (t: TherapistRow, treatment: string): string | undefined => {
      const parts = treatmentParts(treatment);
      if (parts.length < 2) return undefined;
      return parts.find((p) => overlaps(t.training_areas ?? [], [p]));
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
      const payingCovering = paying.filter((t) => matchesGap(t, a.regionKey, a.treatment)).length;
      // "לא מספיק להציע": חיתוך ריק, או חיתוך דליל של מטפל אחד או שניים.
      if (payingCovering > THIN_SUPPLY_MAX) continue;

      const regionLabel = regionGroupLabel(a.regionKey);

      // הצעה כבר בדרך לחיתוך הזה - ממתינים לתשובה ולא מציפים שוב.
      const gapKey = `${regionLabel}|${treatmentKey(a.treatment)}`;
      const waitingSince = waitingByGap.get(gapKey);
      if (waitingSince) {
        waitingGaps.push({ region: regionLabel, treatment: a.treatment, sentAt: waitingSince });
        continue;
      }

      // התאמה מלאה קודמת: מי שעוסק בכל רכיבי השילוב הוא התשובה הנכונה
      // למטופל. רק אם אין כזה עוברים למי שעוסק בחלק ממנו, והטיוטה תאמר
      // את זה במפורש.
      const fullMatch = freePool.filter((t) => matchesGap(t, a.regionKey, a.treatment, "all"));
      const matching = fullMatch.length > 0
        ? fullMatch
        : freePool.filter((t) => matchesGap(t, a.regionKey, a.treatment, "any"));
      const partialOnly = fullMatch.length === 0;
      const fresh = matching.filter((t) => !offeredRecently.has(t.id));
      // כל המתאימים כבר קיבלו הצעה בחלון הצינון: אין למי להציע, אבל גם אסור
      // להכריז "אין אף מטפל מתאים" ולשלוח את זה לגיוס - זו הצהרה לא נכונה.
      if (matching.length > 0 && fresh.length === 0) continue;

      const candidates: GapCandidate[] = fresh.slice(0, MAX_CANDIDATES_PER_GAP).map((t) => ({
        therapist_id: t.id,
        full_name: t.full_name ?? "",
        email: t.email ?? "",
        draft: buildGiftDraft(
          t.full_name ?? "",
          a.regionKey,
          a.treatment,
          demand,
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
        candidates,
        kind,
        draftEmail: kind === "gift" ? candidates[0].draft : null,
      });
    }

    gaps.sort((x, y) => y.events - x.events);
    const giftGaps = gaps.filter((g) => g.kind === "gift");
    const recruitGaps = gaps.filter((g) => g.kind === "recruit");

    // הצעות לתור, עם החלמה אוטומטית: פער שנסגר (נוסף מטפל משלם, או שכבר
    // יצאה בו הצעה) סוגר את ההצעה שלו בריצה הבאה.
    const actions = gaps.map((g) =>
        g.kind === "gift"
          ? {
              actionType: "gift_offer",
              // פעולה: יש כאן מייל לשלוח, ורק אתה יכול להכריע.
              kind: "action" as const,
              title: `הצעת קידום מתנה: ${g.treatment} · ${g.region}`,
              body:
                `${g.events} מטופלים חיפשו ${g.treatment} באזור ${g.region}; ` +
                `${g.payingCovering === 0 ? "אין אף מטפל משלם" : `רק ${g.payingCovering} מטפלים משלמים`} בחיתוך הזה.\n` +
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
              },
            }
          : {
              actionType: "recruit_gap",
              // ממצא: תיאור מצב היצע, לא משימה. הפעולה שנגזרת ממנו (פרסום
              // גיוס) לא מתבצעת מכאן.
              kind: "finding" as const,
              title: `פער גיוס: אין מספיק מטפלים ל${g.treatment} באזור ${g.region}`,
              body:
                `${g.events} מטופלים חיפשו ${g.treatment} באזור ${g.region}, ` +
                `${g.payingCovering === 0 ? "ואין אף מטפל משלם" : `ויש רק ${g.payingCovering} מטפלים משלמים`} בחיתוך הזה - ` +
                `וגם אין במאגר אף מטפל חינמי מאושר שמתאים. זה אזור/תחום לפרסום גיוס ממוקד.`,
              dedupeKey: g.key,
              payload: { region: g.region, treatment: g.treatment },
            }
    );

    // בלי managedKeys: הריצה מחשבת מחדש את כל תמונת הפערים, ולכן כל הצעה
    // ממתינה שהריצה הזו לא הפיקה מחדש כבר לא רלוונטית ונסגרת. (עם רשימת
    // המפתחות של הריצה הנוכחית, כפי שהיה קודם, שום הצעה לא הייתה נסגרת
    // לעולם - הרשימה זהה לרשימת הפעילים, וההחלמה הייתה קוד מת.)
    await syncAgentAlerts("supply_gaps", actions, {
      recoveryNote: "הפער כבר לא עולה בניתוח (כיסוי משלם, או שכבר יצאה הצעה) - ההצעה נסגרה אוטומטית",
    });

    // רענון הצעות שכבר ממתינות בתור: createAgentAction לא דורס הצעה קיימת
    // עם אותו מפתח, ולכן בלי זה טיוטה שהנוסח שלה השתנה (או ספירת ביקוש
    // שהתעדכנה) הייתה נשארת תקועה בגרסה שנוצרה ביום הראשון.
    for (const a of actions) {
      if (!a.dedupeKey) continue;
      const { error } = await supabaseAdmin
        .from("agent_actions")
        .update({ title: a.title, body: a.body ?? null, payload: a.payload ?? null })
        .eq("agent", "supply_gaps")
        .eq("dedupe_key", a.dedupeKey)
        .eq("status", "pending");
      if (error) console.error(`supply_gaps: refresh of ${a.dedupeKey} failed:`, error.message);
    }

    await finishAgentRun(runId, {
      status: gaps.length > 0 ? "ok" : "empty",
      summary:
        gaps.length > 0
          ? `${gaps.length} פערי היצע: ${giftGaps.length} להצעת מתנה, ${recruitGaps.length} לגיוס` +
            (waitingGaps.length > 0 ? `, ${waitingGaps.length} ממתינים לתשובה` : "")
          : waitingGaps.length > 0
            ? `אין פערים חדשים; ${waitingGaps.length} ממתינים לתשובה על הצעה שנשלחה`
            : "אין פערי היצע פתוחים",
      details: {
        gift: giftGaps.map((g) => ({ region: g.region, treatment: g.treatment, events: g.events })),
        recruit: recruitGaps.map((g) => ({ region: g.region, treatment: g.treatment, events: g.events })),
        waiting: waitingGaps,
        cooldown_days: GIFT_OFFER_COOLDOWN_DAYS,
        skipped_unactionable: skippedUnactionable,
      },
    });

    return { ok: true, gaps, giftGaps, recruitGaps, waitingGaps };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishAgentRun(runId, { status: "error", error: msg });
    return { ok: false, gaps: [], giftGaps: [], recruitGaps: [], waitingGaps: [], error: msg };
  }
}
