import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEARNING_BRAND, LEARNING_OG_IMAGE, LEARNING_SIGNATURE, learningRobots } from "@/app/lib/learning-door";
import { shareMetadata } from "@/app/lib/share-metadata";
import { PAGE_REVISED } from "@/app/lib/page-revised";
import { LEARNING_ARTICLES, articleByN, articleBySlug, articlePath, type ArticleBlock } from "../content";

/** lastmod משותף לכל המאמרים (page-revised.ts), נבדק מול git בכל push. */
const UPDATED = PAGE_REVISED["@learning-article"].date;

// מאמר של "לימוד חכם": מדריך להורים על הוראה מתקנת, מורים פרטיים, קריאה וחשבון.
// התוכן ב-content.ts (מקור האמת: מסמך הוורד בדרופבוקס). כל מאמר: "בקצרה",
// הגוף, שאלות נפוצות (FAQPage), מקורות, ושני כפתורים בסוף: המאגר עם המסנן
// המתאים והשאלון. "(מאמר N בסדרה)" בטקסט הופך לקישור. נחתם "צוות לימוד חכם"
// (החלטת הבעלים 13/10/2026), ואינדוקס לפי המתג של הדלת.

const BASE = "https://www.mentalytics.co.il";

export const dynamicParams = false;
export function generateStaticParams() {
  return LEARNING_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = articleBySlug(slug);
  if (!a) return {};
  const url = `${BASE}${articlePath(a)}`;
  return {
    title: { absolute: `${a.seoTitle} | ${LEARNING_BRAND}` },
    description: a.description,
    alternates: { canonical: url },
    robots: learningRobots(),
    ...shareMetadata({ title: `${a.seoTitle} | ${LEARNING_BRAND}`, description: a.description, url, image: LEARNING_OG_IMAGE, type: "article" }),
  };
}

/** המסנן של המאגר שמתאים לנושא המאמר. */
function directoryHref(n: number): string {
  switch (n) {
    case 3:
      return "/learning/teachers?subject=reading_writing";
    case 6:
      return "/learning/teachers?subject=math";
    case 7:
      return "/learning/teachers";
    default:
      return "/learning/teachers?remedial=1";
  }
}

const SERIES_RE = /\(מאמר (\d) בסדרה\)/g;

/** טקסט עם "(מאמר N בסדרה)" כקישור לאותו מאמר. */
function Inline({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(SERIES_RE)) {
    const target = articleByN(Number(m[1]));
    parts.push(text.slice(last, m.index));
    parts.push(
      target ? (
        <Link key={m.index} href={articlePath(target)} className="font-bold text-[var(--teal-dark)] underline underline-offset-4">
          {target.title}
        </Link>
      ) : (
        m[0]
      ),
    );
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

function Block({ b }: { b: ArticleBlock }) {
  switch (b.type) {
    case "h2":
      return <h2 className="mt-10 text-2xl font-black leading-tight">{b.text}</h2>;
    case "h3":
      return <h3 className="mt-7 text-lg font-extrabold">{b.text}</h3>;
    case "p":
      return (
        <p className="mt-4 text-[17px] leading-8 text-[var(--text-2)]">
          <Inline text={b.text} />
        </p>
      );
    case "ul":
    case "ol": {
      const Tag = b.type;
      return (
        <Tag className={`mt-4 space-y-2 ps-6 text-[17px] leading-8 text-[var(--text-2)] ${b.type === "ul" ? "list-disc" : "list-decimal"}`}>
          {b.items.map((it, i) => (
            <li key={i}>
              <Inline text={it} />
            </li>
          ))}
        </Tag>
      );
    }
    case "table": {
      const [head, ...rows] = b.rows;
      return (
        <div className="mt-5 overflow-x-auto rounded-[18px]" style={{ border: "1px solid var(--line)" }}>
          <table className="w-full min-w-[520px] text-[15px] leading-7">
            <thead>
              <tr style={{ background: "var(--gold-pale)" }}>
                {head.map((c, i) => (
                  <th key={i} className="px-4 py-2.5 text-start font-extrabold text-[var(--gold-dark)]">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                  {r.map((c, j) => (
                    <td key={j} className={`px-4 py-2.5 align-top ${j === 0 ? "font-bold text-[var(--text)]" : "text-[var(--text-2)]"}`}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  }
}

function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

const hebDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", month: "long", year: "numeric" });

export default async function LearningArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = articleBySlug(slug);
  if (!a) notFound();
  const url = `${BASE}${articlePath(a)}`;
  const team = { "@type": "Organization", name: LEARNING_SIGNATURE, parentOrganization: { "@type": "Organization", name: "טיפול חכם", url: BASE } };
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.description,
    url,
    mainEntityOfPage: url,
    inLanguage: "he",
    datePublished: a.published,
    dateModified: UPDATED,
    author: team,
    publisher: team,
    isPartOf: { "@type": "WebSite", name: "טיפול חכם", url: BASE },
    about: a.queries.slice(0, 5),
  };
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: a.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  const crumbsLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: LEARNING_BRAND, item: `${BASE}/learning` },
      { "@type": "ListItem", position: 2, name: "מדריכים להורים", item: `${BASE}/learning/articles` },
      { "@type": "ListItem", position: 3, name: a.title, item: url },
    ],
  };
  const others = LEARNING_ARTICLES.filter((x) => x.n !== a.n);

  return (
    <main dir="rtl" className="min-h-screen bg-white" style={{ color: "var(--text)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(crumbsLd) }} />

      <article className="mx-auto max-w-3xl px-5 pb-16 pt-10 sm:pt-14">
        <nav aria-label="פירורי לחם" className="text-sm text-[var(--muted)]">
          <Link href="/learning" className="hover:underline">{LEARNING_BRAND}</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/learning/articles" className="hover:underline">מדריכים להורים</Link>
        </nav>
        <h1 className="mt-4 text-[clamp(1.9rem,4.6vw,3rem)] font-black leading-[1.15]">{a.title}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {LEARNING_SIGNATURE} · עדכון: {hebDate(UPDATED)}
        </p>

        <div className="mt-7 rounded-[20px] p-6" style={{ background: "var(--teal-pale)" }}>
          <p className="text-sm font-bold text-[var(--teal-dark)]">בקצרה</p>
          <p className="mt-2 text-[17px] leading-8 text-[var(--text)]">{a.summary}</p>
        </div>

        {a.blocks.map((b, i) => (
          <Block key={i} b={b} />
        ))}

        {a.faq.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-black leading-tight">שאלות נפוצות</h2>
            <div className="mt-5 rounded-2xl bg-white" style={{ border: "1px solid var(--line)" }}>
              {a.faq.map((f, i) => (
                <details key={f.q} className="group" style={{ borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[16px] font-bold [&::-webkit-details-marker]:hidden">
                    <span>{f.q}</span>
                    <span aria-hidden="true" className="shrink-0 text-[22px] leading-none text-[var(--gold)] transition group-open:rotate-45">+</span>
                  </summary>
                  <div className="px-5 pb-5 text-[15.5px] leading-8 text-[var(--text-2)]">
                    <p>
                      <Inline text={f.a} />
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* הצעד הבא: המאגר עם המסנן של הנושא, והשאלון שמציע כיוון */}
        <section className="mt-12 rounded-[20px] p-7" style={{ background: "var(--gold-pale)" }}>
          <h2 className="text-xl font-black text-[var(--gold-dark)]">הצעד הבא</h2>
          <p className="mt-2 leading-7 text-[var(--text-2)]">
            במאגר של {LEARNING_BRAND} מסננים מורים לפי תחום, כיתה ואזור ופונים אליהם ישירות. ואם לא ברור מה הילד צריך, השאלון לילדים ולנוער מציע כיוון: הוראה מתקנת, מורה פרטי, אבחון או טיפול. הוא אינו אבחון.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={directoryHref(a.n)} className="inline-flex items-center justify-center rounded-full bg-[var(--gold)] px-7 py-3 text-sm font-bold text-white hover:bg-[var(--gold-dark)]">
              למאגר המורים
            </Link>
            <Link href="/kids" className="inline-flex items-center justify-center rounded-full border-[1.5px] border-[var(--teal)] bg-white px-7 py-3 text-sm font-bold text-[var(--teal-dark)] hover:bg-[var(--teal-pale)]">
              לשאלון לילדים ולנוער
            </Link>
          </div>
        </section>

        {a.sources.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-extrabold">מקורות</h2>
            <ol className="mt-3 list-decimal space-y-1.5 ps-6 text-[14px] leading-7 text-[var(--muted)]">
              {a.sources.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </section>
        )}

        <section className="mt-12">
          <h2 className="text-lg font-extrabold">עוד מדריכים בסדרה</h2>
          <ul className="mt-3 grid list-none gap-2 sm:grid-cols-2">
            {others.map((x) => (
              <li key={x.slug}>
                <Link href={articlePath(x)} className="block rounded-2xl p-4 text-[15px] font-bold leading-6 text-[var(--teal-dark)] hover:bg-[var(--surface)]" style={{ border: "1px solid var(--line)" }}>
                  {x.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-10 text-sm leading-7 text-[var(--muted)]">
          <span className="font-bold text-[var(--text-2)]">{LEARNING_SIGNATURE}</span>
          <br />
          המדריך הזה מסביר ואינו תחליף לייעוץ מקצועי. {LEARNING_BRAND} הוא חלק מ<Link href="/" className="underline underline-offset-4">טיפול חכם</Link>.
        </p>
      </article>
    </main>
  );
}
