/**
 * Types and formatting helpers for the validated-sources bibliography.
 *
 * Deliberately free of "use client": both the server page (which reads the
 * JSON off disk) and the browser-side filter UI import from here.
 */

export type SourceItem = {
  id: string;
  origin?: string;
  raw?: string;
  authors?: string[];
  year?: number | string;
  title?: string;
  container?: string;
  type?: "article" | "book" | "web" | string;
  doi?: string;
  url?: string;
  abstract_url?: string;
  full_text_url?: string;
  tags?: string[];
  annotation_he?: string;
  verification_status?: "verified" | "corrected" | "unverified" | "error" | string;
  verification_notes?: string;
};

export function safeText(v: unknown) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export function norm(v: unknown) {
  return safeText(v).toLowerCase().trim();
}

export function doiToUrl(doi?: string) {
  const d = safeText(doi);
  if (!d || d === "לא צוינו/unspecified") return "";
  if (d.startsWith("http")) return d;
  return `https://doi.org/${d}`;
}

export function formatAuthors(authors?: string[]) {
  if (!authors || authors.length === 0) return "לא צוינו/unspecified";
  // בקובץ הנוכחי שמרתי "מחרוזת מחברים" בתא הראשון של המערך (כדי לא לשבור שמות)
  return authors.join("; ");
}

export function buildCitation(it: SourceItem) {
  const authors = formatAuthors(it.authors);
  const year = safeText(it.year) || "לא צוינו/unspecified";
  const title = safeText(it.title) || "לא צוינו/unspecified";
  const container = safeText(it.container) || "לא צוינו/unspecified";
  return `${authors} (${year}). ${title}. ${container}`;
}

export function bestLinks(it: SourceItem) {
  const links: { label: string; url: string }[] = [];

  const doiUrl = doiToUrl(it.doi);
  if (doiUrl) links.push({ label: "DOI", url: doiUrl });

  const abs = safeText(it.abstract_url);
  if (abs && abs !== "לא צוינו/unspecified") links.push({ label: "תקציר/עמוד מקור", url: abs });

  const full = safeText(it.full_text_url);
  if (full && full !== "לא צוינו/unspecified") links.push({ label: "טקסט מלא/PMC", url: full });

  const url = safeText(it.url);
  if (url && url !== "לא צוינו/unspecified" && !doiUrl) links.push({ label: "Publisher/Source", url });

  const title = safeText(it.title);
  if (title) {
    links.push({
      label: "Google Scholar",
      url: `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`,
    });
  }

  return links;
}
