/**
 * Marketing attribution — single source of truth for "where did this visitor
 * come from". Captured first on the landing page, persisted in localStorage,
 * and attached to every tracked funnel event (page_view, profile_impression,
 * profile_view, contact_click) so the admin can report lead source and
 * per-channel conversion.
 *
 * Safe to import from both client components and server route handlers:
 * all browser access is guarded behind `typeof window`.
 */

export const CHANNELS = [
  "google_paid",     // Google Ads (gclid / utm_medium=cpc from google)
  "google_organic",  // organic Google search
  "meta_paid",       // paid Facebook / Instagram (fbclid / utm from meta)
  "whatsapp",        // WhatsApp referral or utm_source=whatsapp
  "direct",          // no referrer, no campaign params
  "referral",        // any other website (incl. organic social)
  "other",           // utm present but source not recognised
] as const;

export type Channel = (typeof CHANNELS)[number];

export type Attribution = {
  channel: Channel;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

const STORAGE_KEY = "mnt_attribution";
const UTM_MAX = 120;

export function isValidChannel(x: unknown): x is Channel {
  return typeof x === "string" && (CHANNELS as readonly string[]).includes(x);
}

const PAID_MEDIUMS = new Set([
  "cpc", "ppc", "paid", "paidsocial", "paid_social", "paid-social",
  "display", "cpm", "retargeting", "remarketing",
]);

function isGoogleSource(src: string): boolean {
  return src.includes("google") || src === "adwords" || src === "googleads";
}

function isMetaSource(src: string): boolean {
  return (
    src.includes("face") || src.includes("insta") ||
    ["meta", "fb", "ig"].includes(src)
  );
}

/** Derive a single normalized channel from URL params + referrer. */
function deriveChannel(params: URLSearchParams, referrer: string): Channel {
  const src = (params.get("utm_source") || "").trim().toLowerCase();
  const med = (params.get("utm_medium") || "").trim().toLowerCase();
  const ref = (referrer || "").trim().toLowerCase();

  // Highest-confidence paid signals: ad-platform click IDs.
  if (params.has("gclid") || params.has("gbraid") || params.has("wbraid")) return "google_paid";
  if (params.has("fbclid")) return "meta_paid";

  // Explicit UTM tagging.
  if (src) {
    if (src === "whatsapp" || src === "wa") return "whatsapp";
    if (isGoogleSource(src)) return med === "organic" ? "google_organic" : "google_paid";
    if (isMetaSource(src)) return "meta_paid";
    if (PAID_MEDIUMS.has(med)) return "other"; // tagged paid, unknown source
    return "other";
  }

  // No UTM — infer from the referrer.
  if (!ref) return "direct";
  if (ref.includes("whatsapp") || ref.includes("wa.me")) return "whatsapp";
  if (ref.includes("google.")) return "google_organic";
  return "referral";
}

function buildAttribution(params: URLSearchParams, referrer: string): Attribution {
  const cap = (v: string | null) => (v && v.length > 0 ? v.slice(0, UTM_MAX) : null);
  return {
    channel: deriveChannel(params, referrer),
    utm_source: cap(params.get("utm_source")),
    utm_medium: cap(params.get("utm_medium")),
    utm_campaign: cap(params.get("utm_campaign")),
  };
}

/**
 * Capture attribution from the current page. Call once early on each landing.
 * "Last meaningful touch": overwrite the stored value whenever a new explicit
 * campaign signal is present (so the ad that drove THIS visit gets credited);
 * otherwise keep whatever acquired the visitor originally.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const referrer = typeof document !== "undefined" ? document.referrer : "";
    const hasCampaignSignal =
      params.has("gclid") || params.has("gbraid") || params.has("wbraid") ||
      params.has("fbclid") || params.has("utm_source");

    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && !hasCampaignSignal) return; // keep the prior touch

    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildAttribution(params, referrer)));
  } catch {
    /* localStorage blocked — attribution stays unknown */
  }
}

/** Read the stored attribution (capturing now as a fallback if none exists). */
export function getAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      captureAttribution();
      raw = localStorage.getItem(STORAGE_KEY);
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Attribution>;
    return {
      channel: isValidChannel(parsed.channel) ? parsed.channel : "direct",
      utm_source: parsed.utm_source ?? null,
      utm_medium: parsed.utm_medium ?? null,
      utm_campaign: parsed.utm_campaign ?? null,
    };
  } catch {
    return null;
  }
}

/** Validate + clamp attribution fields arriving in an API request body. */
export function sanitizeAttribution(body: unknown): {
  channel: Channel | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
} {
  const b = (body ?? {}) as Record<string, unknown>;
  const cap = (v: unknown) =>
    typeof v === "string" && v.length > 0 ? v.slice(0, UTM_MAX) : null;
  return {
    channel: isValidChannel(b.channel) ? b.channel : null,
    utm_source: cap(b.utm_source),
    utm_medium: cap(b.utm_medium),
    utm_campaign: cap(b.utm_campaign),
  };
}

export const CHANNEL_LABELS: Record<Channel | "unknown", string> = {
  google_paid: "גוגל — בתשלום",
  google_organic: "גוגל — אורגני",
  meta_paid: "Meta — בתשלום",
  whatsapp: "וואטסאפ",
  direct: "ישיר",
  referral: "הפניה מאתר אחר",
  other: "אחר",
  unknown: "לא ידוע",
};
