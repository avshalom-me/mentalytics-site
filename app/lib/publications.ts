// The publications library (/admin/publications, table marketing_publications): what the
// company has put out or is about to, where each piece lives and where it sends people.
// Pure helpers only, shared by the admin page and its API route, so the validation the
// server applies is the one the tests check.

export const AUDIENCES = [
  { value: "counselors", label: "יועצות" },
  { value: "kindergarten", label: "גננות" },
  { value: "parents", label: "הורים" },
  { value: "adults", label: "מטופלים מבוגרים" },
  { value: "therapists", label: "מטפלים" },
  { value: "centers", label: "מרכזים" },
  { value: "teachers", label: "מורים" },
  { value: "general", label: "כללי" },
] as const;

export const KINDS = [
  { value: "video", label: "סרטון" },
  { value: "ad", label: "מודעה" },
  { value: "brochure", label: "ברושור" },
  { value: "onepager", label: "תקציר" },
  { value: "post", label: "פוסט" },
  { value: "article", label: "מאמר" },
  { value: "other", label: "אחר" },
] as const;

export const STATUSES = [
  { value: "live", label: "באוויר" },
  { value: "draft", label: "טיוטה" },
  { value: "retired", label: "הוחלף או הוסר" },
] as const;

export const CHANNELS = [
  { value: "youtube", label: "יוטיוב" },
  { value: "facebook", label: "פייסבוק" },
  { value: "instagram", label: "אינסטגרם" },
  { value: "whatsapp", label: "וואטסאפ" },
  { value: "email", label: "מייל" },
  { value: "print", label: "הדפסה" },
  { value: "pdf", label: "PDF" },
  { value: "web", label: "אתר" },
  { value: "other", label: "אחר" },
] as const;

export type Audience = (typeof AUDIENCES)[number]["value"];
export type Kind = (typeof KINDS)[number]["value"];
export type PubStatus = (typeof STATUSES)[number]["value"];
export type Channel = (typeof CHANNELS)[number]["value"];
export type PubLink = { label: string; url: string };

export type Publication = {
  id: string;
  campaign: string;
  audience: Audience;
  kind: Kind;
  title: string;
  version: string | null;
  status: PubStatus;
  channels: Channel[];
  public_url: string | null;
  file_url: string | null;
  links: PubLink[];
  notes: string | null;
  published_on: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/** The fields the admin writes. */
export type PublicationInput = Pick<
  Publication,
  "campaign" | "audience" | "kind" | "title" | "version" | "status" | "channels" | "public_url" | "file_url" | "links" | "notes" | "published_on" | "sort_order"
>;

export const LIMITS = { campaign: 80, title: 160, version: 40, url: 1000, label: 60, notes: 2000, links: 8 } as const;

export function labelOf(list: readonly { value: string; label: string }[], value: string | null | undefined): string {
  return list.find((x) => x.value === value)?.label ?? value ?? "";
}

const has = (list: readonly { value: string }[], v: unknown): boolean => typeof v === "string" && list.some((x) => x.value === v);

function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

/** Notes keep their line breaks; everything else is one line. */
function longText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return t ? t.slice(0, max) : null;
}

/** An http(s) address, or null for empty. A value that is not one is an error, not dropped. */
function url(v: unknown): { ok: true; value: string | null } | { ok: false } {
  if (v === null || v === undefined || (typeof v === "string" && !v.trim())) return { ok: true, value: null };
  if (typeof v !== "string" || v.trim().length > LIMITS.url) return { ok: false };
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? { ok: true, value: u.toString() } : { ok: false };
  } catch {
    return { ok: false };
  }
}

type Failure = { ok: false; error: string };

/** A new publication: campaign, audience, kind and title are required, the rest is optional. */
export function normalizePublication(raw: unknown): { ok: true; value: PublicationInput } | Failure {
  const r = normalize(raw, false);
  return r.ok ? { ok: true, value: r.value as PublicationInput } : r;
}

/** An update: only the fields present are checked and returned. */
export function normalizePublicationPatch(raw: unknown): { ok: true; value: Partial<PublicationInput> } | Failure {
  return normalize(raw, true);
}

function normalize(raw: unknown, partial: boolean): { ok: true; value: Partial<PublicationInput> } | Failure {
  if (!raw || typeof raw !== "object") return { ok: false, error: "בקשה לא תקינה" };
  const r = raw as Record<string, unknown>;
  const out: Partial<PublicationInput> = {};
  const present = (k: string) => !partial || k in r;

  if (present("campaign")) {
    const v = text(r.campaign, LIMITS.campaign);
    if (!v) return { ok: false, error: "צריך לכתוב לאיזו סדרה הפרסום שייך" };
    out.campaign = v;
  }
  if (present("title")) {
    const v = text(r.title, LIMITS.title);
    if (!v) return { ok: false, error: "צריך לכתוב שם לפרסום" };
    out.title = v;
  }
  if (present("audience")) {
    if (!has(AUDIENCES, r.audience)) return { ok: false, error: "קהל היעד לא מוכר" };
    out.audience = r.audience as Audience;
  }
  if (present("kind")) {
    if (!has(KINDS, r.kind)) return { ok: false, error: "סוג הפרסום לא מוכר" };
    out.kind = r.kind as Kind;
  }
  if (present("status")) {
    const s = r.status ?? "draft";
    if (!has(STATUSES, s)) return { ok: false, error: "הסטטוס לא מוכר" };
    out.status = s as PubStatus;
  }
  if (present("version")) out.version = text(r.version, LIMITS.version);
  if (present("notes")) out.notes = longText(r.notes, LIMITS.notes);
  if (present("channels")) {
    const list = Array.isArray(r.channels) ? r.channels : [];
    if (!list.every((c) => has(CHANNELS, c))) return { ok: false, error: "ערוץ לא מוכר" };
    out.channels = [...new Set(list as Channel[])];
  }
  for (const k of ["public_url", "file_url"] as const) {
    if (!present(k)) continue;
    const u = url(r[k]);
    if (!u.ok) return { ok: false, error: k === "public_url" ? "כתובת הצפייה צריכה להתחיל ב-https://" : "כתובת הקובץ צריכה להתחיל ב-https://" };
    out[k] = u.value;
  }
  if (present("links")) {
    const list = Array.isArray(r.links) ? r.links : [];
    if (list.length > LIMITS.links) return { ok: false, error: `עד ${LIMITS.links} קישורים לפרסום` };
    const links: PubLink[] = [];
    for (const l of list) {
      const o = (l && typeof l === "object" ? l : {}) as Record<string, unknown>;
      const u = url(o.url);
      if (!u.ok || !u.value) return { ok: false, error: "כל קישור צריך כתובת שמתחילה ב-https://" };
      links.push({ label: text(o.label, LIMITS.label) ?? "קישור", url: u.value });
    }
    out.links = links;
  }
  if (present("published_on")) {
    const d = r.published_on;
    if (d === null || d === undefined || d === "") out.published_on = null;
    else if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d + "T00:00:00Z"))) out.published_on = d;
    else return { ok: false, error: "תאריך הפרסום לא תקין" };
  }
  if (present("sort_order")) {
    const n = Number(r.sort_order ?? 0);
    out.sort_order = Number.isFinite(n) ? Math.max(-100000, Math.min(100000, Math.round(n))) : 0;
  }
  return { ok: true, value: out };
}

/**
 * The links box on the form: one link per line, "label | address" or just the address.
 * Returns the lines it could not read, so the form can say which one is wrong.
 */
export function parseLinksText(textValue: string): { links: PubLink[]; bad: string[] } {
  const links: PubLink[] = [];
  const bad: string[] = [];
  for (const line of textValue.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const bar = t.lastIndexOf("|");
    const label = bar >= 0 ? t.slice(0, bar).trim() : "";
    const address = (bar >= 0 ? t.slice(bar + 1) : t).trim();
    const u = url(address);
    if (u.ok && u.value) links.push({ label: label || "קישור", url: u.value });
    else bad.push(t);
  }
  return { links, bad };
}

export function linksToText(links: PubLink[]): string {
  return links.map((l) => `${l.label} | ${l.url}`).join("\n");
}

/** The video id of a YouTube watch, short or Shorts link; null for anything else. */
export function youtubeId(address: string | null | undefined): string | null {
  if (!address) return null;
  let u: URL;
  try {
    u = new URL(address);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0] || null;
  else if (host === "youtube.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?#]+)/);
      id = m ? m[2] : null;
    }
  }
  return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
}

const KIND_ORDER: Kind[] = ["video", "ad", "brochure", "onepager", "post", "article", "other"];
const STATUS_ORDER: PubStatus[] = ["live", "draft", "retired"];

/** Campaign by campaign (the most recently touched first); inside one, by kind, status and the admin's order. */
export function groupByCampaign(items: Publication[]): { campaign: string; items: Publication[] }[] {
  const groups = new Map<string, Publication[]>();
  for (const p of items) {
    const g = groups.get(p.campaign);
    if (g) g.push(p);
    else groups.set(p.campaign, [p]);
  }
  const latest = (list: Publication[]) => list.reduce((m, p) => (p.updated_at > m ? p.updated_at : m), "");
  return [...groups.entries()]
    .map(([campaign, list]) => ({
      campaign,
      items: [...list].sort(
        (a, b) =>
          KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
          a.sort_order - b.sort_order ||
          a.title.localeCompare(b.title, "he"),
      ),
    }))
    .sort((a, b) => latest(b.items).localeCompare(latest(a.items)));
}
