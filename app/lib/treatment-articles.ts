// Maps a treatment / recommendation key to its explainer article.
//
// The questionnaire output uses Hebrew strings as treatment identifiers
// (e.g. "טיפול דינאמי", "CBT", "פסיכיאטר"), so this map is keyed on those
// exact strings. The matching results UI uses the resolver below to decide
// whether to render an active "📖 קרא עוד" link or a disabled "מאמר בהכנה"
// placeholder.
//
// When you publish a new article, change `status` to "ready" and point
// `slug` / `anchor` at it.

export type ArticleStatus = "ready" | "pending";

export type TreatmentArticle = {
  slug: string | null;     // e.g. "therapy-types", "cbt-vs-dynamic"
  anchor: string | null;   // optional in-page id
  status: ArticleStatus;   // "ready" → link, "pending" → disabled placeholder
  shortLabel?: string;     // optional override for the link text
};

// Default fallback (used when no entry exists for a treatment key).
const PENDING: TreatmentArticle = { slug: null, anchor: null, status: "pending" };

// Anchors here must match the `id` attributes in the corresponding articles.
// Currently the only article with treatment anchors is `/research/therapy-types`.
export const TREATMENT_ARTICLES: Record<string, TreatmentArticle> = {
  // Core modalities covered by /research/therapy-types
  "טיפול דינאמי":          { slug: "therapy-types", anchor: "dynamic",         status: "ready" },
  "פסיכואנליזה":           { slug: "therapy-types", anchor: "dynamic",         status: "ready" },
  "טיפול דינאמי בטראומה":  { slug: "therapy-types", anchor: "dynamic",         status: "ready" },
  "CBT":                  { slug: "therapy-types", anchor: "cbt",             status: "ready" },
  "DBT":                  { slug: "therapy-types", anchor: "dbt",             status: "ready" },
  "EMDR":                 { slug: "therapy-types", anchor: "emdr",            status: "ready" },
  "ACT":                  { slug: "therapy-types", anchor: "act",             status: "ready" },
  "טיפול משפחתי":          { slug: "therapy-types", anchor: "family-couples",  status: "ready" },
  "טיפול זוגי":            { slug: "therapy-types", anchor: "family-couples",  status: "ready" },
  "טיפול דיאדי":           { slug: "therapy-types", anchor: "family-couples",  status: "ready" },
  "הדרכת הורים":           { slug: "therapy-types", anchor: "parent-guidance", status: "ready" },
  "טיפול בהבעה ויצירה":    { slug: "therapy-types", anchor: "expressive",      status: "ready" },
  "טיפול COG-FUN לקשיי קשב וריכוז": { slug: "therapy-types", anchor: "cog-fun", status: "ready" },
  "טיפול בטראומה":         { slug: "therapy-types", anchor: "emdr",            status: "ready" },

  // CBT-vs-dynamic shortcut (alternate entry point)
  "CPT":                  { slug: "cbt-vs-dynamic", anchor: null,             status: "ready" },

  // Treatments awaiting a dedicated article
  "ריפוי בעיסוק":           PENDING,
  "טיפול תעסוקתי":          PENDING,
  "קבוצה חברתית":           PENDING,
  "טיפול בהתמכרויות":       PENDING,
  "טיפול מיני":             PENDING,
  "נוירופידבק":             PENDING,
  "קלינאות תקשורת":         PENDING,
  "טיפול בהפרעות אכילה":    PENDING,
  "טיפול באנקופרזיס":       PENDING,

  // Professional referrals - separate article eventually
  "פסיכיאטר":              PENDING,
  "פסיכיאטר ילדים":        PENDING,
  "דיאטנ/ית קליני/ת":       PENDING,
  "דיאטנית קלינית":         PENDING,
  "פיזיותרפיסט/ית":         PENDING,
  "פיזיותרפיה רצפת אגן":    PENDING,
  "מרפא/ת בעיסוק":          PENDING,
  "קלינאי/ת תקשורת":        PENDING,
  "קלינאית תקשורת":         PENDING,
};

/**
 * Resolve the article entry for a given treatment string. Falls back to a
 * "pending" placeholder so the UI always has something to render.
 */
export function getTreatmentArticle(treatment: string | null | undefined): TreatmentArticle {
  if (!treatment) return PENDING;
  return TREATMENT_ARTICLES[treatment] ?? PENDING;
}

/**
 * Build the href for a treatment article. Returns null when the article is
 * still pending.
 */
export function getTreatmentArticleHref(treatment: string | null | undefined): string | null {
  const entry = getTreatmentArticle(treatment);
  if (entry.status !== "ready" || !entry.slug) return null;
  return entry.anchor ? `/research/${entry.slug}#${entry.anchor}` : `/research/${entry.slug}`;
}
