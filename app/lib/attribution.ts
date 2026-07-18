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
  "meta_paid",       // paid Facebook / Instagram (utm_medium paid + meta source)
  "meta_organic",    // organic Facebook / Instagram (fbclid alone, or social medium)
  "tiktok_paid",     // paid TikTok (utm_medium paid + tiktok source)
  "tiktok_organic",  // organic TikTok (ttclid alone, or tiktok referrer)
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

// Raw ad-platform click ids are stored separately from the normalized
// attribution: they are only needed at conversion time (to upload the
// conversion back to Google Ads / Meta with exact click attribution), so they
// are kept out of the per-event tracking payload.
const STORAGE_KEY_CLICKS = "mnt_click_ids";
const CLICK_ID_MAX = 512;

export type ClickIds = {
  gclid: string | null; // Google Ads — standard web click id
  gbraid: string | null; // Google Ads — web-to-app (iOS)
  wbraid: string | null; // Google Ads — app-to-web (iOS)
  fbclid: string | null; // Meta — click id (for future Meta CAPI)
};

function readClickIdsFromParams(params: URLSearchParams): ClickIds {
  const cap = (v: string | null) => (v && v.length > 0 ? v.slice(0, CLICK_ID_MAX) : null);
  return {
    gclid: cap(params.get("gclid")),
    gbraid: cap(params.get("gbraid")),
    wbraid: cap(params.get("wbraid")),
    fbclid: cap(params.get("fbclid")),
  };
}

function hasAnyClickId(c: ClickIds): boolean {
  return Boolean(c.gclid || c.gbraid || c.wbraid || c.fbclid);
}

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

function isTikTokSource(src: string): boolean {
  return src.includes("tiktok") || src.includes("tik_tok") || src === "tt";
}

/** Derive a single normalized channel from URL params + referrer. */
function deriveChannel(params: URLSearchParams, referrer: string): Channel {
  const src = (params.get("utm_source") || "").trim().toLowerCase();
  const med = (params.get("utm_medium") || "").trim().toLowerCase();
  const ref = (referrer || "").trim().toLowerCase();

  // Google Ads click ids are paid-exclusive — they alone prove paid traffic.
  // fbclid is NOT: Meta appends it to organic clicks too (shares, profile-link
  // taps, in-app browser), so it must never imply paid on its own (see below).
  if (params.has("gclid") || params.has("gbraid") || params.has("wbraid")) return "google_paid";

  // Explicit UTM tagging — trust the medium to separate paid from organic.
  if (src) {
    if (src === "whatsapp" || src === "wa") return "whatsapp";
    if (isGoogleSource(src)) return PAID_MEDIUMS.has(med) ? "google_paid" : "google_organic";
    if (isMetaSource(src)) return PAID_MEDIUMS.has(med) ? "meta_paid" : "meta_organic";
    if (isTikTokSource(src)) return PAID_MEDIUMS.has(med) ? "tiktok_paid" : "tiktok_organic";
    if (PAID_MEDIUMS.has(med)) return "other"; // tagged paid, unknown source
    return "other";
  }

  // fbclid present but no paid UTM → Meta-originated, treated as organic social.
  // (Paid Meta campaigns must be tagged with a paid utm_medium to count as paid.)
  if (params.has("fbclid")) return "meta_organic";
  // ttclid alone = TikTok-originated; treat as organic unless tagged paid (like fbclid).
  if (params.has("ttclid")) return "tiktok_organic";

  // No UTM — infer from the referrer.
  if (!ref) return "direct";
  if (ref.includes("whatsapp") || ref.includes("wa.me")) return "whatsapp";
  if (ref.includes("google.")) return "google_organic";
  if (ref.includes("facebook.") || ref.includes("instagram.") || ref.includes("fb.")) return "meta_organic";
  if (ref.includes("tiktok.")) return "tiktok_organic";
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
    // Bare fbclid is deliberately NOT a "meaningful" touch: Meta appends it to
    // organic clicks, so an organic Meta re-visit must not overwrite a prior
    // paid touch (or its click-ids). A real tagged Meta campaign still carries
    // utm_source and is captured normally.
    const hasCampaignSignal =
      params.has("gclid") || params.has("gbraid") || params.has("wbraid") ||
      params.has("utm_source");

    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && !hasCampaignSignal) return; // keep the prior touch

    const next = buildAttribution(params, referrer);
    // A gclid-only landing (campaign signal but no utm params — Google strips
    // the suffix on some ad assets) must not wipe a previously captured
    // campaign tag from the same channel: that orphaned paid conversions from
    // their campaign (seen live 16/7, g-online). Keep the richer prior tag.
    if (existing && !next.utm_campaign) {
      try {
        const prev = JSON.parse(existing) as Partial<Attribution>;
        if (prev.utm_campaign && prev.channel === next.channel) {
          next.utm_source = next.utm_source ?? prev.utm_source ?? null;
          next.utm_medium = next.utm_medium ?? prev.utm_medium ?? null;
          next.utm_campaign = prev.utm_campaign;
        }
      } catch {
        /* corrupt stored value — fall through with the fresh capture */
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

    // Persist the raw ad click ids (last-touch) so a later conversion can be
    // uploaded to the ad platform with exact click attribution. Only overwrite
    // when this landing actually carries click ids — a utm-only or organic
    // landing must not wipe a gclid captured on an earlier paid visit.
    const clicks = readClickIdsFromParams(params);
    if (hasAnyClickId(clicks)) {
      localStorage.setItem(STORAGE_KEY_CLICKS, JSON.stringify(clicks));
    }
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

function parseClickIds(raw: string): ClickIds | null {
  try {
    const p = JSON.parse(raw) as Partial<ClickIds>;
    const cap = (v: unknown) =>
      typeof v === "string" && v.length > 0 ? v.slice(0, CLICK_ID_MAX) : null;
    const c: ClickIds = {
      gclid: cap(p.gclid),
      gbraid: cap(p.gbraid),
      wbraid: cap(p.wbraid),
      fbclid: cap(p.fbclid),
    };
    return hasAnyClickId(c) ? c : null;
  } catch {
    return null;
  }
}

/**
 * Read the raw ad click ids captured at landing. Attach to the request body of
 * a conversion (payment) so the server can store them on the payment row.
 * Returns null when this visitor carries no click id (organic / direct).
 */
export function getClickIds(): ClickIds | null {
  if (typeof window === "undefined") return null;
  try {
    let raw = localStorage.getItem(STORAGE_KEY_CLICKS);
    if (!raw) {
      // This page might itself be the click landing (single-page convert).
      captureAttribution();
      raw = localStorage.getItem(STORAGE_KEY_CLICKS);
    }
    return raw ? parseClickIds(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Signup-attribution transport. The therapist stub row is created by a GET
 * (no request body), so the stored attribution + click ids ride in this
 * request header. Value is URI-encoded JSON — fetch() header values must be
 * Latin-1 safe and utm values can contain Hebrew.
 */
export const ATTRIBUTION_HEADER = "x-mnt-attribution";

/** Build the header value from the stored touch. Null when nothing is stored. */
export function getAttributionHeaderValue(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const att = getAttribution();
    const clicks = getClickIds();
    if (!att && !clicks) return null;
    return encodeURIComponent(JSON.stringify({ ...att, ...clicks }));
  } catch {
    return null;
  }
}

/** Validate + clamp click ids arriving in an API request body (server-side). */
export function sanitizeClickIds(body: unknown): ClickIds {
  const b = (body ?? {}) as Record<string, unknown>;
  // Click ids are opaque url-safe tokens — accept only [A-Za-z0-9._-].
  const clean = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim().slice(0, CLICK_ID_MAX);
    return t.length > 0 && /^[A-Za-z0-9._-]+$/.test(t) ? t : null;
  };
  return {
    gclid: clean(b.gclid),
    gbraid: clean(b.gbraid),
    wbraid: clean(b.wbraid),
    fbclid: clean(b.fbclid),
  };
}

export const CHANNEL_LABELS: Record<Channel | "unknown", string> = {
  google_paid: "גוגל — בתשלום",
  google_organic: "גוגל — אורגני",
  meta_paid: "Meta — בתשלום",
  meta_organic: "Meta — אורגני",
  tiktok_paid: "TikTok — בתשלום",
  tiktok_organic: "TikTok — אורגני",
  whatsapp: "וואטסאפ",
  direct: "ישיר",
  referral: "הפניה מאתר אחר",
  other: "אחר",
  unknown: "לא ידוע",
};
