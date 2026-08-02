import Link from "next/link";
import type { ReactNode } from "react";
import ArticleTOC from "@/app/components/ArticleTOC";
import {
  SECTIONS,
  EDITORIAL_ARTICLES,
  sectionBySlug,
  type Section,
} from "@/app/lib/article-taxonomy";
import { loadArticlesByTopics } from "@/app/lib/local-articles";

/**
 * Desktop layout for an article page.
 *
 * The body used to sit in `max-w-3xl` (768px) on any screen, with nothing beside
 * it - so on a 1440px display roughly half the viewport was empty margin while
 * competitors run a populated sidebar. The fix is to widen the PAGE, not the
 * text: a measure of 60-75 characters is what makes long prose readable, and the
 * existing column was already in that range. Stretching paragraphs to 1150px
 * would have traded readability for the appearance of using the space.
 *
 * So the column keeps its measure and the reclaimed width earns a sticky rail:
 * contents, a route to the questionnaire, related reading, and the author. The
 * rail collapses away under `lg`, where the single column was right all along.
 */

const BASE_URL = "https://www.mentalytics.co.il";

type Props = {
  /** Path of this article, e.g. "/research/psychodidactic". */
  href: string;
  /** Short label for the breadcrumb leaf (not the full headline). */
  title: string;
  /** Section slug from app/lib/article-taxonomy.ts - drives related + CTAs. */
  sectionSlug?: string | null;
  /** Author card in the rail. */
  author?: { name: string; role?: string; href?: string };
  children: ReactNode;
};

function railCardStyle(): React.CSSProperties {
  return {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: "14px",
    padding: "16px 18px",
  };
}

export default async function ArticleShell({ href, title, sectionSlug, author, children }: Props) {
  const section: Section | null = sectionSlug ? sectionBySlug(sectionSlug) : null;

  // Related reading: same section, this article excluded. Editorial guides
  // first (they are the evergreen ones), then therapist-written pieces.
  const relatedEditorial = section
    ? EDITORIAL_ARTICLES.filter((a) => a.section === section.slug && `/research/${a.slug}` !== href).slice(0, 4)
    : [];
  const relatedCommunity =
    section && section.articleTopics.length > 0
      ? (await loadArticlesByTopics(section.articleTopics as unknown as string[], 3)).filter(
          (a) => `/research/community/${a.slug}` !== href
        )
      : [];
  const related = [
    ...relatedEditorial.map((a) => ({ href: `/research/${a.slug}`, title: a.title, byline: undefined as string | undefined })),
    ...relatedCommunity.map((a) => ({ href: `/research/community/${encodeURIComponent(a.slug)}`, title: a.title, byline: a.author })),
  ].slice(0, 5);

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      {/* Visual breadcrumb. The BreadcrumbList JSON-LD existed on some pages but
          nothing was shown to the reader, and there was no crawlable trail. */}
      <nav aria-label="מיקום בתוך האתר" className="mb-6">
        <ol
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            color: "var(--muted)",
          }}
        >
          <li>
            <Link href="/" style={{ color: "var(--muted)" }} className="hover:underline">
              בית
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li>
            <Link href="/research" style={{ color: "var(--muted)" }} className="hover:underline">
              מאמרים
            </Link>
          </li>
          {section && (
            <>
              <li aria-hidden="true">›</li>
              <li>
                <Link href={`/research/topic/${section.slug}`} style={{ color: "var(--muted)" }} className="hover:underline">
                  {section.name}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true">›</li>
          <li aria-current="page" style={{ color: "var(--text-2)", fontWeight: 600 }}>
            {title}
          </li>
        </ol>
      </nav>

      <div className="lg:grid lg:gap-12" style={{ gridTemplateColumns: "minmax(0,1fr) 300px" }}>
        {/* Reading column - measure preserved, not stretched. */}
        <div id="article-body" className="min-w-0" style={{ maxWidth: "740px" }}>
          {children}
        </div>

        {/* Rail */}
        <aside className="hidden lg:block">
          <div style={{ position: "sticky", top: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
            <ArticleTOC />

            <div style={{ ...railCardStyle(), background: "var(--teal-pale)", borderColor: "var(--teal-mid)" }}>
              <p style={{ fontWeight: 800, fontSize: "14.5px", color: "var(--teal-dark)", marginBottom: "6px" }}>
                לא בטוחים מה מתאים לכם?
              </p>
              <p style={{ fontSize: "13px", color: "var(--teal-dark)", lineHeight: 1.7, marginBottom: "10px" }}>
                שאלון קצר שממפה את הקושי וממליץ על סוג הטיפול והמטפל המתאימים.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <Link
                  href="/adults"
                  className="rounded-full px-4 py-2 text-sm font-bold text-center"
                  style={{ background: "var(--teal)", color: "#fff", textDecoration: "none" }}
                >
                  לשאלון למבוגרים ←
                </Link>
                <Link
                  href="/kids"
                  className="rounded-full px-4 py-2 text-sm font-bold text-center"
                  style={{ background: "var(--bg)", color: "var(--teal-dark)", border: "1px solid var(--teal-mid)", textDecoration: "none" }}
                >
                  לשאלון לילדים ונוער ←
                </Link>
              </div>
              <p style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--teal)", marginTop: "10px", textAlign: "center" }}>
                בחינם · אנונימי · ללא התחייבות
              </p>
            </div>

            {related.length > 0 && (
              <div style={railCardStyle()}>
                <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: ".12em", color: "var(--muted)", marginBottom: "10px" }}>
                  מאמרים קשורים
                </p>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                  {related.map((r) => (
                    <li key={r.href}>
                      <Link
                        href={r.href}
                        style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text)", lineHeight: 1.5, textDecoration: "none" }}
                        className="hover:underline"
                      >
                        {r.title}
                      </Link>
                      {r.byline && <div style={{ fontSize: "12px", color: "var(--faint)" }}>מאת {r.byline}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {author && (
              <div style={railCardStyle()}>
                <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: ".12em", color: "var(--muted)", marginBottom: "8px" }}>
                  נכתב על ידי
                </p>
                {author.href ? (
                  <Link href={author.href} style={{ fontWeight: 800, fontSize: "14.5px", color: "var(--teal-dark)", textDecoration: "none" }} className="hover:underline">
                    {author.name}
                  </Link>
                ) : (
                  <span style={{ fontWeight: 800, fontSize: "14.5px", color: "var(--text)" }}>{author.name}</span>
                )}
                {author.role && <p style={{ fontSize: "12.5px", color: "var(--muted)", marginTop: "3px", lineHeight: 1.6 }}>{author.role}</p>}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Full-width close: the commercial half of the same query. */}
      {section && section.directory.length > 0 && (
        <div className="mt-14 pt-8" style={{ borderTop: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 900, color: "var(--text)", marginBottom: "4px" }}>
            מחפשים מטפל בנושא הזה?
          </h2>
          <p style={{ fontSize: "14px", color: "var(--muted)", marginBottom: "14px" }}>
            כל המטפלים במאגר מאומתים, והרשימות מתעדכנות אוטומטית.
          </p>
          <div className="flex flex-wrap gap-2">
            {section.directory.map((d) => (
              <Link
                key={d.href}
                href={d.href}
                className="rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-80"
                style={{ background: "var(--teal-pale)", color: "var(--teal-dark)", textDecoration: "none" }}
              >
                {d.label}
              </Link>
            ))}
            <Link
              href={`/research/topic/${section.slug}`}
              className="rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-80"
              style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text-2)", textDecoration: "none" }}
            >
              עוד מאמרים ב{section.name}
            </Link>
          </div>
        </div>
      )}

      {/* Mobile fallback for the rail's related list - the aside is hidden there. */}
      {related.length > 0 && (
        <div className="lg:hidden mt-10 pt-8" style={{ borderTop: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 900, color: "var(--text)", marginBottom: "10px" }}>מאמרים קשורים</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
            {related.map((r) => (
              <li key={r.href}>
                <Link href={r.href} style={{ fontSize: "14.5px", fontWeight: 600, color: "var(--teal-dark)", textDecoration: "none" }} className="hover:underline">
                  {r.title}
                </Link>
                {r.byline && <span style={{ fontSize: "12.5px", color: "var(--faint)" }}> · מאת {r.byline}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}

/** All section slugs, for callers that need to validate one. */
export const ARTICLE_SECTION_SLUGS = SECTIONS.map((s) => s.slug);
