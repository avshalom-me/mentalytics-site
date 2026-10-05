import { centerMonthlyPricing } from "@/app/lib/center-pricing";
import { isCenterOnGift, stopReasonLabel } from "@/app/lib/center-gift";
import { buildXlsx, toExcelSerial, type XlsxColumn, type XlsxKind, type XlsxSheet, type XlsxValue } from "@/app/lib/xlsx-writer";

// The centres export behind "הורדה לאקסל" on /admin/centers: one row per centre,
// one column per piece of information the admin sees on a centre's card, in the
// admin's own wording. It is built in the browser from the list the page has
// already loaded, so it costs the database nothing.
//
// What is left out on purpose: the join-link token (whoever holds it can open
// the payment page for that centre, and an export gets emailed around), the
// payer's company/ID number, and internal plumbing (organisation id, Sumit
// document id, retry counters, legacy plan JSON). Nothing here reads `token`.

const PUBLIC_SITE = "https://www.mentalytics.co.il";
const TIME_ZONE = "Asia/Jerusalem";

type Engagement = {
  views_30: number;
  clicks_30: number;
  views_total: number;
  clicks_total: number;
  clicks_30_by_channel: { paid: number; organic: number; direct: number; other: number };
  clicks_30_by_type: Record<string, number>;
  page_views_30: number;
  page_views_total: number;
  website_clicks_30: number;
  website_clicks_total: number;
  page_contact_30: number;
  page_contact_total: number;
  card_contact_30: number;
  card_contact_total: number;
  site_messages_30: number;
  site_messages_total: number;
};

type Readiness = {
  pct: number;
  headline: string | null;
  slots: { paid: number; filled: number; promoted: number } | null;
  missing: { label: string }[];
  blocked_on_us: string[];
};

type Health = {
  severity: "critical" | "high" | "normal" | null;
  days_to_billing: number | null;
  flags: { label: string; owner: "center" | "us"; detail: string }[];
};

/** A centre as the admin page holds it (GET /api/admin-centers). */
export type ExportCenter = {
  name: string;
  status: string;
  billing_track: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  gift_months: number | null;
  price_per_therapist: number | null;
  therapist_count: number | null;
  fixed_monthly_price: number | null;
  num_locations: number | null;
  discount_amount: number | null;
  agreed_monthly_price: number | null;
  billing_starts_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  // Optional so a list loaded before these columns existed still exports.
  cancel_reason?: string | null;
  gift_granted_at?: string | null;
  gift_until?: string | null;
  payer_name: string | null;
  payer_email: string | null;
  payer_phone: string | null;
  sumit_recurring_id: string | null;
  slug: string | null;
  public_page_enabled: boolean | null;
  public_description: string | null;
  public_managers: string | null;
  public_city: string | null;
  public_website: string | null;
  public_phone: string | null;
  public_whatsapp: string | null;
  user_id: string | null;
  members?: { email: string | null; is_primary: boolean }[];
  linked_therapist_count: number;
  pending_therapist_count: number;
  // The page's own type does not list these, but the API returns every column,
  // and the centre fills them in from its dashboard.
  public_founded_year?: number | null;
  public_team_size?: number | null;
  public_address?: string | null;
  public_hours?: string | null;
  public_accessibility?: string | null;
  public_director?: unknown;
  public_faq?: unknown;
  team_members?: unknown;
  gallery?: unknown;
  logo_path?: string | null;
  engagement?: Engagement | null;
  readiness?: Readiness | null;
  health?: Health | null;
};

type Def = {
  header: string;
  width: number;
  kind?: XlsxKind;
  wrap?: boolean;
  value: (c: ExportCenter) => XlsxValue;
};

// Wording as on the admin page (status and track badges, click types).
const STATUS_LABEL: Record<string, string> = {
  draft: "טיוטה",
  sent: "הצעה נשלחה",
  active: "מנוי פעיל",
  cancelled: "מנוי נעצר",
};
// An active centre on a gift promotion (no card, no charge) is its own stage on
// the admin page, with its own badge.
const GIFT_STATUS_LABEL = "קידום מתנה";
const statusLabel = (c: ExportCenter) =>
  isCenterOnGift(c) ? GIFT_STATUS_LABEL : STATUS_LABEL[c.status] ?? str(c.status);
const TRACK_LABEL = { per_therapist: "מסלול 1 - מטפלים בנפרד", center_entity: "מסלול 2 - מרכז כישות" } as const;
const CLICK_TYPE_LABEL: Record<string, string> = {
  site_message: "הודעות באתר",
  whatsapp: "וואטסאפ",
  phone: "טלפון",
  email: "מייל",
  other: "אחר",
};
const SEVERITY_LABEL = { critical: "קריטית", high: "גבוהה", normal: "רגילה" } as const;

// billing_track empty or old = track 1, the historical default (same as the page).
const isEntity = (c: ExportCenter) => c.billing_track === "center_entity";

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
};

const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const yesNo = (b: boolean) => (b ? "כן" : "לא");
const lines = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join("\n") || null;

// jsonb columns are edited by the centres themselves; never trust their shape.
function objects(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x)) : [];
}

const nameAndRole = (o: Record<string, unknown>) => [str(o.name), str(o.role)].filter(Boolean).join(" - ");

function directorText(v: unknown): string | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const d = v as Record<string, unknown>;
  return lines([nameAndRole(d), str(d.note)]);
}

function faqText(v: unknown): string | null {
  const blocks = objects(v)
    .map((f) => lines([str(f.q) && `ש: ${str(f.q)}`, str(f.a) && `ת: ${str(f.a)}`]))
    .filter(Boolean);
  return blocks.length ? blocks.join("\n\n") : null;
}

// Live when the admin page would show the "public page" link: a slug, an active
// subscription, and either track 2 (the page is the whole product) or the flag.
const publicPageLive = (c: ExportCenter) =>
  Boolean(str(c.slug)) && c.status === "active" && (isEntity(c) || c.public_page_enabled === true);

function channelText(e: Engagement | null | undefined): string | null {
  const ch = e?.clicks_30_by_channel;
  if (!ch) return null;
  const parts = [
    ch.paid > 0 ? `ממומן ${ch.paid}` : null,
    ch.organic > 0 ? `אורגני ${ch.organic}` : null,
    ch.direct > 0 ? `ישיר ${ch.direct}` : null,
    ch.other > 0 ? `אחר ${ch.other}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

// As the card's "פניות לפי סוג": track 1 site messages come from a different
// table, so they are added to the type counts here.
function typeText(e: Engagement | null | undefined): string | null {
  if (!e) return null;
  const byType: Record<string, number> = { ...(e.clicks_30_by_type ?? {}) };
  if (e.site_messages_30 > 0) byType.site_message = (byType.site_message ?? 0) + e.site_messages_30;
  const parts = Object.entries(byType)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${CLICK_TYPE_LABEL[k] ?? k} ${n}`);
  return parts.length ? parts.join(" · ") : null;
}

// What the offer comes to per month. Zero means "no price set yet", and a 0
// in the sheet would read as a price.
function offerTotal(c: ExportCenter, withVat: boolean): number | null {
  const p = centerMonthlyPricing(c);
  const total = withVat ? p.monthlyTotalWithVat : p.monthlyTotal;
  return total > 0 ? total : null;
}

const when = (iso: string | null | undefined) => toExcelSerial(iso, TIME_ZONE);

// Columns in sections; the two header shades alternate per section.
const SECTIONS: Def[][] = [
  // The centre
  [
    { header: "שם המרכז", width: 28, value: (c) => str(c.name) },
    { header: "סטטוס", width: 13, value: (c) => statusLabel(c) },
    { header: "מסלול", width: 24, value: (c) => (isEntity(c) ? TRACK_LABEL.center_entity : TRACK_LABEL.per_therapist) },
    { header: "איש/אשת קשר", width: 18, value: (c) => str(c.contact_name) },
    { header: "אימייל", width: 28, value: (c) => str(c.email) },
    { header: "טלפון איש/אשת הקשר (פנימי)", width: 18, value: (c) => str(c.phone) },
    { header: "הערות פנימיות", width: 40, wrap: true, value: (c) => str(c.notes) },
    { header: "נוצר", width: 17, kind: "datetime", value: (c) => when(c.created_at) },
    { header: "עודכן לאחרונה", width: 17, kind: "datetime", value: (c) => when(c.updated_at) },
  ],
  // The offer and its price
  [
    // The gift months inside a paid offer: the card is saved, the first charge is put off.
    { header: "חודשי מתנה בהצעה", width: 10, kind: "int", value: (c) => num(c.gift_months) },
    { header: 'מחיר למטפל (₪, לפני מע"מ)', width: 18, kind: "money", value: (c) => (isEntity(c) ? null : num(c.price_per_therapist)) },
    { header: "מספר מטפלים בהצעה", width: 12, kind: "int", value: (c) => (isEntity(c) ? null : num(c.therapist_count)) },
    { header: 'מחיר חודשי קבוע (₪, לפני מע"מ)', width: 18, kind: "money", value: (c) => (isEntity(c) ? num(c.fixed_monthly_price) : null) },
    { header: "מספר מיקומים", width: 10, kind: "int", value: (c) => num(c.num_locations) },
    { header: 'הנחה (₪ לחודש, לפני מע"מ)', width: 18, kind: "money", value: (c) => num(c.discount_amount) },
    { header: 'סכום חודשי לפי ההצעה (₪, לפני מע"מ)', width: 22, kind: "money", value: (c) => offerTotal(c, false) },
    { header: 'סכום חודשי לפי ההצעה (₪, כולל מע"מ)', width: 22, kind: "money", value: (c) => offerTotal(c, true) },
    { header: 'מחיר חודשי שסוכם (₪, לפני מע"מ)', width: 22, kind: "money", value: (c) => num(c.agreed_monthly_price) },
  ],
  // Payment and subscription
  [
    { header: "תחילת חיוב", width: 13, kind: "date", value: (c) => toExcelSerial(c.billing_starts_at ?? null, TIME_ZONE) },
    { header: "שולם בתאריך", width: 17, kind: "datetime", value: (c) => when(c.paid_at) },
    { header: "נעצר בתאריך", width: 17, kind: "datetime", value: (c) => when(c.cancelled_at) },
    { header: "סיבת העצירה", width: 24, value: (c) => (c.status === "cancelled" ? stopReasonLabel(c.cancel_reason) : null) },
    // A gift promotion: on air with no card and no charge. An empty end date on
    // a centre whose status says "קידום מתנה" means a gift with no end.
    { header: "קידום מתנה מתאריך", width: 17, kind: "datetime", value: (c) => (isCenterOnGift(c) ? when(c.gift_granted_at) : null) },
    { header: "קידום מתנה עד", width: 17, kind: "datetime", value: (c) => (isCenterOnGift(c) ? when(c.gift_until) : null) },
    { header: "שם המשלם", width: 20, value: (c) => str(c.payer_name) },
    { header: "אימייל המשלם", width: 28, value: (c) => str(c.payer_email) },
    { header: "טלפון המשלם", width: 16, value: (c) => str(c.payer_phone) },
    { header: "מזהה הוראת קבע ב-Sumit", width: 22, value: (c) => str(c.sumit_recurring_id) },
  ],
  // The public page, as the centre wrote it
  [
    { header: "עמוד ציבורי באוויר", width: 12, value: (c) => yesNo(publicPageLive(c)) },
    { header: "כתובת העמוד הציבורי", width: 46, value: (c) => (publicPageLive(c) ? `${PUBLIC_SITE}/centers/${str(c.slug)}` : null) },
    { header: "תיאור המרכז", width: 50, wrap: true, value: (c) => str(c.public_description) },
    { header: "שמות המנהלים / הצוות", width: 28, wrap: true, value: (c) => str(c.public_managers) },
    { header: "עיר / כתובת", width: 18, value: (c) => str(c.public_city) },
    { header: "כתובת מלאה", width: 28, value: (c) => str(c.public_address) },
    { header: "טלפון לחיוג (מוצג באתר)", width: 18, value: (c) => str(c.public_phone) },
    { header: "וואטסאפ עסקי", width: 16, value: (c) => str(c.public_whatsapp) },
    { header: "אתר המרכז", width: 30, value: (c) => str(c.public_website) },
    { header: "שנת ייסוד", width: 9, kind: "int", value: (c) => num(c.public_founded_year) },
    { header: "גודל הצוות", width: 9, kind: "int", value: (c) => num(c.public_team_size) },
    { header: "שעות פעילות", width: 26, wrap: true, value: (c) => str(c.public_hours) },
    { header: "נגישות", width: 26, wrap: true, value: (c) => str(c.public_accessibility) },
    { header: "מנהל/ת המרכז", width: 26, wrap: true, value: (c) => directorText(c.public_director) },
    {
      header: "צוות בעמוד הציבורי",
      width: 30,
      wrap: true,
      value: (c) => lines(objects(c.team_members).map(nameAndRole)),
    },
    { header: "שאלות ותשובות בעמוד", width: 50, wrap: true, value: (c) => faqText(c.public_faq) },
    { header: "לוגו", width: 8, value: (c) => (c.logo_path === undefined ? null : c.logo_path ? "יש" : "אין") },
    { header: "תמונות בגלריה", width: 10, kind: "int", value: (c) => (c.gallery === undefined ? null : objects(c.gallery).length) },
  ],
  // Portal accounts and linked therapists
  [
    { header: "נכנסו לפורטל", width: 10, value: (c) => yesNo(Boolean(c.user_id)) },
    {
      header: "חשבונות בפורטל",
      width: 32,
      value: (c) =>
        (c.members ?? []).map((m) => `${str(m.email) ?? "?"}${m.is_primary ? " (ראשי)" : ""}`).join("; ") || null,
    },
    { header: "מטפלים משויכים", width: 11, kind: "int", value: (c) => num(c.linked_therapist_count) },
    { header: "ממתינים לאישור", width: 11, kind: "int", value: (c) => num(c.pending_therapist_count) },
  ],
  // Readiness and health (active centres)
  [
    { header: "מוכנות (%)", width: 10, kind: "int", value: (c) => num(c.readiness?.pct) },
    { header: "מקומות בתשלום", width: 10, kind: "int", value: (c) => num(c.readiness?.slots?.paid) },
    { header: "מקומות פעילים", width: 10, kind: "int", value: (c) => num(c.readiness?.slots?.promoted) },
    { header: "מקומות מקושרים", width: 10, kind: "int", value: (c) => num(c.readiness?.slots?.filled) },
    { header: "מוכנות: כותרת", width: 32, wrap: true, value: (c) => str(c.readiness?.headline) },
    {
      header: "מוכנות: חסר אצלם",
      width: 36,
      wrap: true,
      value: (c) => lines((c.readiness?.missing ?? []).map((m) => str(m.label))),
    },
    {
      header: "מוכנות: חסמים אצלנו",
      width: 30,
      wrap: true,
      value: (c) => lines((c.readiness?.blocked_on_us ?? []).map(str)),
    },
    {
      header: "בריאות: חומרה",
      width: 11,
      value: (c) => (c.health?.severity ? SEVERITY_LABEL[c.health.severity] ?? null : null),
    },
    {
      header: "חיוב בעוד (ימים)",
      width: 10,
      kind: "int",
      // Negative means billing already started - the card says "חיוב פעיל".
      value: (c) => {
        const d = num(c.health?.days_to_billing);
        return d !== null && d >= 0 ? d : null;
      },
    },
    {
      header: "בריאות: דגלים",
      width: 50,
      wrap: true,
      value: (c) =>
        lines(
          (c.health?.flags ?? []).map(
            (f) => `${f.label} (${f.owner === "us" ? "אצלנו" : "אצלם"})${str(f.detail) ? `: ${str(f.detail)}` : ""}`,
          ),
        ),
    },
  ],
  // Engagement, last 30 days
  [
    { header: "צפיות (30 יום)", width: 10, kind: "count", value: (c) => num(c.engagement?.views_30) },
    { header: "לחיצות ליצירת קשר (30 יום)", width: 15, kind: "count", value: (c) => num(c.engagement?.clicks_30) },
    { header: "לחיצות לפי ערוץ (30 יום)", width: 26, value: (c) => channelText(c.engagement) },
    { header: "פניות לפי סוג (30 יום)", width: 28, value: (c) => typeText(c.engagement) },
    { header: "הודעות באתר (30 יום)", width: 13, kind: "count", value: (c) => num(c.engagement?.site_messages_30) },
    { header: "כניסות לעמוד הציבורי (30 יום)", width: 17, kind: "count", value: (c) => num(c.engagement?.page_views_30) },
    { header: "לחיצות לאתר המרכז (30 יום)", width: 16, kind: "count", value: (c) => num(c.engagement?.website_clicks_30) },
    { header: "לחיצות קשר מהעמוד (30 יום)", width: 16, kind: "count", value: (c) => num(c.engagement?.page_contact_30) },
    { header: "לחיצות קשר מכרטיס המרכז (30 יום)", width: 19, kind: "count", value: (c) => num(c.engagement?.card_contact_30) },
  ],
  // Engagement, all time
  [
    { header: "צפיות (מצטבר)", width: 10, kind: "count", value: (c) => num(c.engagement?.views_total) },
    { header: "לחיצות ליצירת קשר (מצטבר)", width: 15, kind: "count", value: (c) => num(c.engagement?.clicks_total) },
    { header: "הודעות באתר (מצטבר)", width: 13, kind: "count", value: (c) => num(c.engagement?.site_messages_total) },
    { header: "כניסות לעמוד הציבורי (מצטבר)", width: 17, kind: "count", value: (c) => num(c.engagement?.page_views_total) },
    { header: "לחיצות לאתר המרכז (מצטבר)", width: 16, kind: "count", value: (c) => num(c.engagement?.website_clicks_total) },
    { header: "לחיצות קשר מהעמוד (מצטבר)", width: 16, kind: "count", value: (c) => num(c.engagement?.page_contact_total) },
    { header: "לחיצות קשר מכרטיס המרכז (מצטבר)", width: 19, kind: "count", value: (c) => num(c.engagement?.card_contact_total) },
  ],
];

const DEFS: (Def & { band: 0 | 1 })[] = SECTIONS.flatMap((section, i) =>
  section.map((d) => ({ ...d, band: (i % 2) as 0 | 1 })),
);

// The order the admin page lists them in: active subscriptions (track 2, then
// track 1), gift promotions, then sent offers, drafts, stopped. Within a stage
// the loaded order (newest first) is kept.
function stageRank(c: ExportCenter): number {
  if (isCenterOnGift(c)) return 2;
  if (c.status === "active") return isEntity(c) ? 0 : 1;
  const i = ["sent", "draft", "cancelled"].indexOf(c.status);
  return i === -1 ? 6 : 3 + i;
}

export const CENTERS_SHEET_NAME = "מרכזים";

export function centersExportSheet(centers: ExportCenter[]): XlsxSheet {
  const ordered = centers.slice().sort((a, b) => stageRank(a) - stageRank(b));
  const columns: XlsxColumn[] = DEFS.map(({ header, width, kind, wrap, band }) => ({ header, width, kind, wrap, band }));
  return {
    name: CENTERS_SHEET_NAME,
    columns,
    rows: ordered.map((c) => DEFS.map((d) => d.value(c))),
    rtl: true,
    freezeFirstColumn: true,
  };
}

export function buildCentersXlsx(centers: ExportCenter[]): Uint8Array<ArrayBuffer> {
  return buildXlsx(centersExportSheet(centers));
}

/** mentalytics-centers-2026-09-30.xlsx - the Israeli date, and ASCII so it survives email and WhatsApp. */
export function centersExportFileName(now: Date = new Date()): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return `mentalytics-centers-${day}.xlsx`;
}
