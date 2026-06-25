// Shared types + helpers for therapist-submitted articles.

export type ArticleStatus = "pending" | "approved" | "rejected";

export type TherapistArticle = {
  id: string;
  therapist_id: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  topic: string | null;
  status: ArticleStatus;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  reviewed_by: string | null;
  image_url: string | null;
  image_alt: string | null;
  image_credit: string | null;
};

// Optional topic buckets a therapist can tag an article with — mirrors the
// /research hub so approved articles slot in naturally.
export const ARTICLE_TOPICS = [
  "טיפול במבוגרים",
  "טיפול בילדים ונוער",
  "זוגיות ומשפחה",
  "חרדה ולחץ",
  "דיכאון ומצב רוח",
  "טראומה",
  "הורות",
  "אבחון והערכה",
  "כללי",
] as const;

// Length bounds, shared by the submission form and the API validator.
export const ARTICLE_LIMITS = {
  titleMin: 6,
  titleMax: 120,
  summaryMax: 300,
  bodyMin: 200,
  bodyMax: 12000,
} as const;

// Hebrew-friendly slug. Keeps Hebrew letters and latin alphanumerics, turns
// whitespace into hyphens, strips other punctuation. Hebrew slugs are valid in
// URLs (percent-encoded) and good for Hebrew SEO. Callers must still guarantee
// uniqueness against the DB (the slug column is UNIQUE).
export function slugify(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^֐-׿a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return base || "article";
}

// Split a plain-text body into paragraphs for safe rendering (React escapes
// the text, so no HTML injection). Blank lines separate paragraphs.
export function bodyToParagraphs(body: string): string[] {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}
