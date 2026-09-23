import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { fetchAllRows } from "./fetch-all-rows";
import { CITY_TO_REGION } from "./regions";
import { centerWhatsAppNumber } from "./phone";
import { loadCentersWithReadiness, type CenterWithReadiness } from "./center-readiness-load";

// "בריאות מרכז": שכבת הפרשנות מעל המספרים שכבר יש באדמין.
//
// למה זה קיים: ב-17/9/26 נכתב לעומר מסמך על חמשת המרכזים, ידנית. כ-60% ממנו
// היה נגזר מנתונים שכבר יושבים בכרטיס המרכז - מה שחסר היה מה שהופך מספר
// לבעיה: השוואה למטפל פרטי משלם, הביקוש באזור, וסימון שמצביע על מה לשאול
// בשיחה. בלי השכבה הזו ממצא "5 ממטפלי שדות בלי לחיצה" ישב בתור מ-4/9 ואיש
// לא ראה אותו, וציידי המחשבות עברו חמישה שבועות בלי אף מטפל ובלי אף התראה.
//
// המודול הזה הוא מקור אמת יחיד לשלושה צרכנים: כרטיס המרכז באדמין, סוכן
// הבריאות (ממצא אחד לכל מרכז בתור ובדוח הבוקר), ודף השיחה לעומר. מדד
// שמחושב בשלושה מקומות מתפצל תוך שבוע - לכן הכל כאן, פעם אחת.
//
// כל דגל נושא שלושה טקסטים: label קצר לכרטיס, detail עם המספרים, ו-question
// לשיחה. דגל שבאחריות המרכז (owner='center') יכול לשאת גם פסקה למייל -
// זו נכנסת לטיוטת הנדנוד שהסוכן מכין. דגל שבאחריותנו לעולם לא נשלח למרכז.

export type HealthSeverity = "critical" | "high" | "normal";
export type HealthOwner = "center" | "us";
export type HealthFlagKey =
  | "no_therapists"
  | "no_whatsapp"
  | "inquiry_recipient"
  | "no_online"
  | "low_region_demand"
  | "contacts_concentrated"
  | "exposure_below_benchmark";

export type HealthFlag = {
  key: HealthFlagKey;
  severity: HealthSeverity;
  owner: HealthOwner;
  /** כותרת קצרה לכרטיס ולתור. */
  label: string;
  /** משפט אחד עם המספרים שמאחורי הדגל. */
  detail: string;
  /** מה לשאול או לבדוק בשיחה עם המרכז. */
  question: string;
  /** פסקה לטיוטת הנדנוד - רק לדגל שבאחריות המרכז. */
  emailParagraph: string | null;
};

export type Exposure = { cards: number; list: number; opens: number; contacts: number };

export type TherapistHealthRow = Exposure & {
  id: string;
  name: string;
  isEntity: boolean;
  promoted: boolean;
  online: boolean;
  ages: string[];
  regions: string[];
};

export type CenterHealth = {
  id: string;
  name: string;
  track: "per_therapist" | "center_entity";
  trackLabel: string;
  paidAt: string | null;
  billingStartsAt: string | null;
  /** ימים עד תחילת החיוב; שלילי = החיוב כבר התחיל; null = לא ידוע. */
  daysToBilling: number | null;
  /** ימים מאז שהמרכז התחיל לצבור חשיפה (מטפל ראשון מקודם / שורת הישות / התשלום). */
  daysActive: number;
  /** חלון המדידה של המרכז: 30 יום, או פחות אם המרכז צעיר יותר. */
  windowDays: number;
  /** כמה יחידות מודדים: מספר המטפלים המקודמים במסלול 1, יחידה אחת במסלול 2. */
  units: number;
  totals: Exposure;
  /** ליחידה, מנורמל ל-30 יום - כדי שמרכז בן 14 יום יושווה הוגן לבנצ'מרק. */
  perUnit30: Exposure | null;
  demand: { searches: number; regions: string[] };
  therapists: TherapistHealthRow[];
  flags: HealthFlag[];
  severity: HealthSeverity | null;
  readiness: CenterWithReadiness["readiness"];
  /** לאיזו כתובת נשלחות פניות מטופלים לישות (מסלול 2). */
  inquiryEmail: string | null;
  whatsapp: string | null;
  slots: { paid: number; linked: number; promoted: number } | null;
};

export type HealthBenchmark = {
  peers: number;
  windowDays: number;
} & Exposure;

export type CenterHealthReport = {
  centers: CenterHealth[];
  /** ממוצע ל-30 יום של מטפל פרטי משלם (promotion_source='paid') עם ותק של 30 יום לפחות. */
  benchmark: HealthBenchmark | null;
  demand: { total: number; onlineShare: number; windowDays: number };
  generatedAt: string;
};

// ── ספים. כל אחד מתועד בשורה כדי שלא יזוז בלי סיבה ────────────────────────

const WINDOW_DAYS = 30;
// מרכז צעיר משבוע לא נשפט על חשיפה - עוד אין לו מספרים, יש לו רעש.
const SETTLE_DAYS = 7;
// מסלול 1 בלי אף מטפל מקושר: אחרי שבועיים זה דגל, אחרי חודש זה קריטי.
const NO_THERAPISTS_HIGH_DAYS = 14;
const NO_THERAPISTS_CRITICAL_DAYS = 30;
// כשהחיוב הראשון בעוד פחות משבועיים, מרכז בלי מטפלים הוא שיחה דחופה.
const BILLING_SOON_DAYS = 14;
// מתחת לזה חיפושים באזור ב-30 יום, אף פרופיל לא יביא פניות - הבעיה בביקוש.
const LOW_DEMAND_SEARCHES = 30;
// ריכוז: מספיק פניות כדי שיהיה משמעותי, ורוב מוחלט למטפל אחד.
const CONCENTRATION_MIN_CONTACTS = 5;
const CONCENTRATION_SHARE = 0.8;
// חשיפה למטפל מתחת לחצי מהממוצע של משלם פרטי.
const BENCHMARK_RATIO = 0.5;
const BENCHMARK_MIN_PEERS = 5;

const SEVERITY_RANK: Record<HealthSeverity, number> = { critical: 0, high: 1, normal: 2 };

function worst(flags: HealthFlag[]): HealthSeverity | null {
  if (flags.length === 0) return null;
  return flags.reduce<HealthSeverity>(
    (acc, f) => (SEVERITY_RANK[f.severity] < SEVERITY_RANK[acc] ? f.severity : acc),
    "normal"
  );
}

function daysBetween(fromIso: string, to = Date.now()): number {
  return Math.floor((to - new Date(fromIso).getTime()) / 86_400_000);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clean(s: string | null | undefined): string | null {
  const v = (s ?? "").trim().toLowerCase();
  return v || null;
}

/** רק הפסקאות שמותר לשלוח למרכז: באחריותו, ועם נוסח. */
export function healthEmailParagraphs(h: CenterHealth): string[] {
  return h.flags
    .filter((f) => f.owner === "center" && f.emailParagraph)
    .map((f) => f.emailParagraph as string);
}

// ── הטעינה ─────────────────────────────────────────────────────────────────

type CenterExtra = {
  id: string;
  billing_track: string | null;
  billing_starts_at: string | null;
  paid_at: string | null;
  public_page_enabled: boolean | null;
  public_phone: string | null;
  public_whatsapp: string | null;
  email: string | null;
  payer_email: string | null;
  therapist_count: number | null;
};

type TRow = {
  id: string;
  center_account_id: string | null;
  full_name: string | null;
  entity_type: string | null;
  status: string | null;
  admin_approved: boolean | null;
  online: boolean | null;
  regions: string[] | null;
  age_groups: string[] | null;
  email: string | null;
  promoted_since: string | null;
  created_at: string | null;
  match_paused_until: string | null;
  promotion_source: string | null;
};

export async function loadCenterHealth(): Promise<CenterHealthReport> {
  const generatedAt = new Date().toISOString();
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();

  const withReadiness = await loadCentersWithReadiness();
  const ids = withReadiness.map((c) => c.id);
  const empty: CenterHealthReport = {
    centers: [],
    benchmark: null,
    demand: { total: 0, onlineShare: 0, windowDays: WINDOW_DAYS },
    generatedAt,
  };
  if (ids.length === 0) return empty;

  const [extrasRes, membersRes, linkedRes, peersRes, searchRows] = await Promise.all([
    supabaseAdmin
      .from("therapy_center_accounts")
      .select(
        "id, billing_track, billing_starts_at, paid_at, public_page_enabled, public_phone, public_whatsapp, email, payer_email, therapist_count"
      )
      .in("id", ids),
    supabaseAdmin.from("center_members").select("center_id, email").in("center_id", ids),
    supabaseAdmin
      .from("therapists")
      .select(
        "id, center_account_id, full_name, entity_type, status, admin_approved, online, regions, age_groups, email, promoted_since, created_at, match_paused_until, promotion_source"
      )
      .in("center_account_id", ids),
    // עמיתי ההשוואה: מטפל פרטי שמשלם בעצמו, מקודם 30 יום לפחות, ולא מוקפא.
    // מקודמי מתנה ומטפלי מרכזים בחוץ - הם לא "מה שמנוי מלא נותן".
    supabaseAdmin
      .from("therapists")
      .select("id, promoted_since, match_paused_until")
      .eq("status", "paying")
      .eq("promotion_source", "paid")
      .eq("admin_approved", true)
      .neq("entity_type", "center")
      .lte("promoted_since", cutoff),
    // ביקוש: כל חיפוש בשאלון ב-30 יום, לפי האזור שהמטופל ביקש.
    fetchAllRows<{ metadata: { region?: string | null; online?: boolean } | null }>(() =>
      supabaseAdmin
        .from("analytics_events")
        .select("metadata")
        .eq("event_type", "match_search")
        .gte("created_at", cutoff)
    ),
  ]);

  const extras = new Map<string, CenterExtra>();
  for (const e of (extrasRes.data ?? []) as unknown as CenterExtra[]) extras.set(e.id, e);

  const membersByCenter = new Map<string, string[]>();
  for (const m of membersRes.data ?? []) {
    const cid = m.center_id as string;
    const em = clean(m.email as string | null);
    if (!em) continue;
    membersByCenter.set(cid, [...(membersByCenter.get(cid) ?? []), em]);
  }

  const linked = ((linkedRes.data ?? []) as unknown as TRow[]).filter(
    (t) => t.status === "paying" || t.entity_type === "center"
  );
  const now = Date.now();
  const peerIds = ((peersRes.data ?? []) as { id: string; match_paused_until: string | null }[])
    .filter((p) => !p.match_paused_until || new Date(p.match_paused_until).getTime() < now)
    .map((p) => p.id);

  // ביקוש לפי אזור, פעם אחת לכל הדוח.
  const demandByRegion = new Map<string, number>();
  let demandTotal = 0;
  let demandOnline = 0;
  for (const r of searchRows) {
    demandTotal++;
    if (r.metadata?.online) demandOnline++;
    const region = r.metadata?.region;
    if (region) demandByRegion.set(region, (demandByRegion.get(region) ?? 0) + 1);
  }
  const onlineShare = demandTotal > 0 ? demandOnline / demandTotal : 0;

  // ── חשיפה: שליפה אחת למטפלי המרכזים ולעמיתי ההשוואה יחד ─────────────────
  const measuredIds = [...new Set([...linked.map((t) => t.id), ...peerIds])];
  const exposure = new Map<string, Exposure & { events: { at: string; kind: keyof Exposure }[] }>();
  const expOf = (id: string) => {
    let x = exposure.get(id);
    if (!x) exposure.set(id, (x = { cards: 0, list: 0, opens: 0, contacts: 0, events: [] }));
    return x;
  };
  if (measuredIds.length > 0) {
    const [views, impressions, clicks] = await Promise.all([
      fetchAllRows<{ therapist_id: string; viewed_at: string; source: string | null }>(() =>
        supabaseAdmin
          .from("therapist_profile_views")
          .select("therapist_id, viewed_at, source")
          .in("therapist_id", measuredIds)
          .gte("viewed_at", cutoff)
      ),
      fetchAllRows<{ therapist_id: string; created_at: string }>(() =>
        supabaseAdmin
          .from("analytics_events")
          .select("therapist_id, created_at")
          .eq("event_type", "profile_impression")
          .in("therapist_id", measuredIds)
          .gte("created_at", cutoff)
      ),
      fetchAllRows<{ therapist_id: string; clicked_at: string }>(() =>
        supabaseAdmin
          .from("therapist_contact_clicks")
          .select("therapist_id, clicked_at")
          .in("therapist_id", measuredIds)
          .gte("clicked_at", cutoff)
      ),
    ]);
    // האירועים נשמרים עם תאריך: המרכז נמדד רק מהיום שבו התחיל לצבור חשיפה,
    // ולכן הספירה לכל מרכז נעשית אחר כך, מול ה-since שלו.
    for (const v of views) {
      const kind: keyof Exposure | null =
        v.source === "match_card" ? "cards"
        : v.source === "match" || v.source === "directory" || v.source === "profile" ? "opens"
        : null;
      if (kind) expOf(v.therapist_id).events.push({ at: v.viewed_at, kind });
    }
    for (const i of impressions) expOf(i.therapist_id).events.push({ at: i.created_at, kind: "list" });
    for (const c of clicks) expOf(c.therapist_id).events.push({ at: c.clicked_at, kind: "contacts" });
  }
  const countSince = (id: string, sinceIso: string): Exposure => {
    const out: Exposure = { cards: 0, list: 0, opens: 0, contacts: 0 };
    const x = exposure.get(id);
    if (!x) return out;
    for (const e of x.events) if (e.at >= sinceIso) out[e.kind]++;
    return out;
  };

  // בנצ'מרק: ממוצע ליחידה על 30 יום מלאים.
  let benchmark: HealthBenchmark | null = null;
  if (peerIds.length >= BENCHMARK_MIN_PEERS) {
    const sum: Exposure = { cards: 0, list: 0, opens: 0, contacts: 0 };
    for (const id of peerIds) {
      const e = countSince(id, cutoff);
      sum.cards += e.cards; sum.list += e.list; sum.opens += e.opens; sum.contacts += e.contacts;
    }
    benchmark = {
      peers: peerIds.length,
      windowDays: WINDOW_DAYS,
      cards: round1(sum.cards / peerIds.length),
      list: round1(sum.list / peerIds.length),
      opens: round1(sum.opens / peerIds.length),
      contacts: round1(sum.contacts / peerIds.length),
    };
  }

  // ── מרכז אחר מרכז ──────────────────────────────────────────────────────
  const centers: CenterHealth[] = withReadiness.map((c) => {
    const x = extras.get(c.id);
    const isEntity = x?.billing_track === "center_entity";
    const mine = linked.filter((t) => t.center_account_id === c.id);
    const entity = mine.find((t) => t.entity_type === "center") ?? null;
    const real = mine.filter((t) => t.entity_type !== "center");
    const promoted = real.filter((t) => t.status === "paying");

    // עוגן: מתי המרכז התחיל להיות מוצג. לא התאריך המוקדם ביותר של הפעילות -
    // פרופיל שהיה במאגר לפני המרכז היה גורר את החלון אחורה.
    const anchorIso = isEntity
      ? entity?.promoted_since ?? entity?.created_at ?? x?.paid_at ?? null
      : promoted.map((t) => t.promoted_since ?? t.created_at ?? "").filter(Boolean).sort()[0] ?? x?.paid_at ?? null;
    const daysActive = anchorIso ? Math.max(0, daysBetween(anchorIso)) : 0;
    const sinceIso = anchorIso && anchorIso > cutoff ? anchorIso : cutoff;
    const windowDays = Math.min(WINDOW_DAYS, Math.max(1, daysActive || WINDOW_DAYS));

    const daysToBilling = x?.billing_starts_at ? -daysBetween(x.billing_starts_at) : null;

    const rows: TherapistHealthRow[] = (isEntity && entity ? [entity] : promoted).map((t) => ({
      id: t.id,
      name: (t.full_name ?? "").trim() || (t.entity_type === "center" ? c.name : "מטפל/ת ללא שם"),
      isEntity: t.entity_type === "center",
      promoted: t.status === "paying",
      online: t.online === true,
      ages: Array.isArray(t.age_groups) ? t.age_groups : [],
      regions: Array.isArray(t.regions) ? t.regions : [],
      ...countSince(t.id, sinceIso),
    }));
    const totals = rows.reduce<Exposure>(
      (a, r) => ({ cards: a.cards + r.cards, list: a.list + r.list, opens: a.opens + r.opens, contacts: a.contacts + r.contacts }),
      { cards: 0, list: 0, opens: 0, contacts: 0 }
    );
    const units = isEntity ? (entity ? 1 : 0) : promoted.length;
    const scale = units > 0 ? WINDOW_DAYS / windowDays / units : 0;
    const perUnit30: Exposure | null =
      units > 0 && daysActive >= SETTLE_DAYS
        ? { cards: round1(totals.cards * scale), list: round1(totals.list * scale), opens: round1(totals.opens * scale), contacts: round1(totals.contacts * scale) }
        : null;

    // ביקוש באזורי המרכז: הערים של המטפלים מתורגמות לאזור, בלי כפילויות.
    const regionKeys = new Set<string>();
    for (const r of rows) for (const city of r.regions) {
      const region = CITY_TO_REGION[city];
      if (region) regionKeys.add(region);
    }
    const searches = [...regionKeys].reduce((s, k) => s + (demandByRegion.get(k) ?? 0), 0);

    const whatsapp = centerWhatsAppNumber(x?.public_whatsapp, x?.public_phone);
    const inquiryEmail = isEntity ? clean(entity?.email) ?? clean(x?.email) ?? clean(x?.payer_email) : null;
    const memberEmails = membersByCenter.get(c.id) ?? [];

    const flags: HealthFlag[] = [];

    // 1. מסלול 1 בלי אף מטפל - הדגל שאיש לא ראה אצל ציידי המחשבות.
    if (!isEntity && real.length === 0 && daysActive >= NO_THERAPISTS_HIGH_DAYS) {
      const billingSoon = daysToBilling !== null && daysToBilling <= BILLING_SOON_DAYS;
      const critical = daysActive >= NO_THERAPISTS_CRITICAL_DAYS || billingSoon;
      const paid = Number(x?.therapist_count) || 0;
      flags.push({
        key: "no_therapists",
        severity: critical ? "critical" : "high",
        owner: "center",
        label: "אף מטפל לא נוסף למרכז",
        detail:
          `${daysActive} ימים מאז ההצטרפות ואף מטפל לא מקושר` +
          (paid > 0 ? ` (${paid} מקומות)` : "") +
          (daysToBilling !== null ? (daysToBilling >= 0 ? `, החיוב מתחיל בעוד ${daysToBilling} ימים` : ", החיוב כבר התחיל") : "") +
          ".",
        question: "לשאול אם הם עדיין רוצים להיות באתר ומה עיכב את הוספת המטפלים. לברר מי המטפלים וכתובות המייל שלהם - את ההזמנות שולחים מהפורטל, ואפשר ללוות אותם בזה באותה שיחה.",
        // הנדנוד הקיים כבר אומר את זה; אין טעם בפסקה שנייה על אותו דבר.
        emailParagraph: null,
      });
    }

    // 2. אין וואטסאפ: 71% מהפניות באתר הן בוואטסאפ. כרטיס ישות בלי מספר
    //    וואטסאפ מציג רק כפתור הודעה; עמוד מרכז בלי מספר כזה מציג רק חיוג.
    //    מ-23/9/26 גם קו נייח או וירטואלי נחשב, אם המרכז רשם אותו כוואטסאפ עסקי.
    if (!whatsapp && (isEntity || x?.public_page_enabled)) {
      flags.push({
        key: "no_whatsapp",
        severity: isEntity ? "high" : "normal",
        owner: "center",
        label: "אין מספר לוואטסאפ",
        detail: isEntity
          ? "לא הוגדר וואטסאפ עסקי והטלפון לחיוג אינו נייד, ולכן בכרטיס המרכז בתוצאות השאלון יש רק כפתור הודעה, בלי וואטסאפ."
          : "לא הוגדר וואטסאפ עסקי והטלפון לחיוג אינו נייד, ולכן בעמוד המרכז אין כפתור וואטסאפ.",
        question: "לבקש מספר לוואטסאפ עסקי: נייד, או הקו של המרכז אם הוא מחובר לוואטסאפ עסקי. רוב הפונים באתר בוחרים בוואטסאפ, ומעטים שולחים הודעה.",
        emailParagraph:
          "לפניות מטופלים חסר למרכז מספר לוואטסאפ עסקי. רוב הפונים באתר בוחרים לפנות בוואטסאפ, וכרגע מוצגים להם רק חיוג או שליחת הודעה. אפשר להוסיף את המספר בפורטל, בעריכת פרופיל המרכז: נייד, או הקו של המרכז אם הוא מחובר לוואטסאפ עסקי.",
      });
    }

    // 3. פניות לישות נשלחות לכתובת שאף אחד מחשבונות הפורטל לא מזוהה איתה.
    //    זה מה שקרה ברותם ב-15/9: עריכה באדמין העתיקה את מייל איש הקשר על
    //    תיבת המשרד, והפנייה הבאה הלכה למקום שאיש לא בודק.
    if (isEntity && inquiryEmail && memberEmails.length > 0 && !memberEmails.includes(inquiryEmail)) {
      flags.push({
        key: "inquiry_recipient",
        severity: "normal",
        owner: "us",
        label: "פניות נשלחות לכתובת שאינה של חשבון כניסה",
        detail: `פניות מטופלים נשלחות ל-${inquiryEmail}, בעוד שלפורטל נכנסים עם ${memberEmails.join(", ")}.`,
        question: "לוודא לאיזו כתובת מייל הם רוצים לקבל פניות, ולבקש שיבדקו גם ספאם ולשונית קידומים.",
        emailParagraph: null,
      });
    }

    // 4. אונליין: מטפל שלא סימן אונליין לא מופיע לכל מי שביקש טיפול מרחוק.
    const anyOnline = rows.some((r) => r.online);
    if (rows.length > 0 && !anyOnline) {
      const pct = Math.round(onlineShare * 100);
      flags.push({
        key: "no_online",
        severity: "normal",
        owner: "center",
        label: "אף מטפל לא זמין אונליין",
        detail: `${pct}% מהחיפושים בשאלון ב-30 יום ביקשו טיפול אונליין, ואף אחד ממטפלי המרכז לא מסומן כזמין לכך.`,
        question: "לשאול אילו מטפלים יכולים לעבוד גם אונליין. מטפל שלא סימן אונליין לא מופיע באף אחד מהחיפושים האלה.",
        emailParagraph: `אם חלק מהמטפלים מקבלים מטופלים גם בשיחת וידאו, כדאי לסמן זאת בפרופיל: כ-${pct}% מהפונים באתר מחפשים טיפול אונליין, ומי שלא סימן זאת לא מופיע אצלם.`,
      });
    }

    // 5. ביקוש נמוך באזור: הבעיה אצלנו (ובגיאוגרפיה), לא בפרופיל.
    if (rows.length > 0 && regionKeys.size > 0 && searches < LOW_DEMAND_SEARCHES) {
      flags.push({
        key: "low_region_demand",
        severity: "normal",
        owner: "us",
        label: "ביקוש נמוך באזור המרכז",
        detail: `${searches} חיפושים בשאלון ב-30 יום באזורי המרכז (${[...regionKeys].join(", ")}), מתוך ${demandTotal} בכל הארץ.`,
        question: "לתאם ציפיות על כמות הפניות האפשרית, ולשאול אילו ערים סמוכות הם משרתים בפועל. הרחבת אונליין היא הדרך היחידה לעקוף ביקוש מקומי נמוך.",
        emailParagraph: null,
      });
    }

    // 6. ריכוז: כל הפניות למטפל אחד. כנראה שאלת קיבולת, וגם רמז מה מבדיל אותו.
    if (!isEntity && rows.length >= 2 && totals.contacts >= CONCENTRATION_MIN_CONTACTS) {
      const top = [...rows].sort((a, b) => b.contacts - a.contacts)[0];
      if (top.contacts / totals.contacts >= CONCENTRATION_SHARE) {
        flags.push({
          key: "contacts_concentrated",
          severity: "normal",
          owner: "center",
          label: `כל הפניות מגיעות ל${top.name}`,
          detail: `${top.contacts} מתוך ${totals.contacts} הפניות ב-${windowDays} ימים הגיעו ל${top.name}; שאר ${rows.length - 1} המטפלים כמעט בלי פניות.`,
          question: `לשאול כמה מהפניות ל${top.name} הפכו לטיפול והאם נשאר מקום למטופלים חדשים, ומה מבדיל את הפרופיל שלו/ה מהאחרים (אונליין, גילאים, תחומים).`,
          emailParagraph: null,
        });
      }
    }

    // 7. חשיפה מתחת לחצי מהממוצע של משלם פרטי - השוואה הוגנת, על אותו חלון.
    if (perUnit30 && benchmark && benchmark.cards > 0 && perUnit30.cards < benchmark.cards * BENCHMARK_RATIO) {
      flags.push({
        key: "exposure_below_benchmark",
        severity: "normal",
        owner: "us",
        label: "חשיפה נמוכה בתוצאות השאלון",
        detail: `${perUnit30.cards} הופעות בתוצאות השאלון למטפל ב-30 יום, לעומת ${benchmark.cards} אצל מטפל פרטי משלם.`,
        question: "לבדוק יחד מה חסר בפרופילים: אונליין, קבוצות גיל, ערים סמוכות ותחומי טיפול. אלה מה שקובע באילו חיפושים המטפל מופיע.",
        emailParagraph: null,
      });
    }

    flags.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

    return {
      id: c.id,
      name: c.name,
      track: isEntity ? "center_entity" : "per_therapist",
      trackLabel: c.readiness.trackLabel,
      paidAt: x?.paid_at ?? null,
      billingStartsAt: x?.billing_starts_at ?? null,
      daysToBilling,
      daysActive,
      windowDays,
      units,
      totals,
      perUnit30,
      demand: { searches, regions: [...regionKeys] },
      therapists: rows.sort((a, b) => b.contacts - a.contacts || b.cards - a.cards),
      flags,
      severity: worst(flags),
      readiness: c.readiness,
      inquiryEmail,
      whatsapp,
      slots: isEntity ? null : { paid: Number(x?.therapist_count) || 0, linked: real.length, promoted: promoted.length },
    };
  });

  // הדחוף קודם, ובתוך אותה דחיפות - מי שהחיוב שלו קרוב יותר.
  centers.sort((a, b) => {
    const ra = a.severity ? SEVERITY_RANK[a.severity] : 9;
    const rb = b.severity ? SEVERITY_RANK[b.severity] : 9;
    return ra - rb || (a.daysToBilling ?? 999) - (b.daysToBilling ?? 999);
  });

  return {
    centers,
    benchmark,
    demand: { total: demandTotal, onlineShare, windowDays: WINDOW_DAYS },
    generatedAt,
  };
}
