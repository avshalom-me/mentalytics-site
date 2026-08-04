import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ArticleShell from "@/app/components/ArticleShell";
import { AuthorByline } from "@/app/components/AuthorByline";
import { siteAuthorRef, SITE_AUTHOR, SITE_AUTHOR_PATH } from "@/app/lib/author";
import { BTL_TRACKS, btlTrackBySlug } from "@/app/lib/btl-tracks";
import BtlProcessFlow from "@/app/components/BtlProcessFlow";

const BASE_URL = "https://www.mentalytics.co.il";

export function generateStaticParams() {
  return BTL_TRACKS.map((t) => ({ track: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ track: string }> }): Promise<Metadata> {
  const { track } = await params;
  const t = btlTrackBySlug(track);
  if (!t) return { title: "מסלול לא נמצא" };
  const url = `${BASE_URL}/research/btl/${t.slug}`;
  return {
    title: t.searchTitle,
    description: t.metaDescription,
    alternates: { canonical: url },
    openGraph: { title: t.searchTitle, description: t.metaDescription, url, type: "article", locale: "he_IL", siteName: "טיפול חכם" },
  };
}

const h2 = {
  fontSize: "21px",
  fontWeight: 800,
  color: "var(--text)",
  marginBottom: "14px",
  borderBottom: "2px solid var(--teal-mid)",
  paddingBottom: "8px",
} as const;

export default async function BtlTrackPage({ params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  const t = btlTrackBySlug(track);
  if (!t) notFound();

  const url = `${BASE_URL}/research/btl/${t.slug}`;
  const others = BTL_TRACKS.filter((x) => x.slug !== t.slug);

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: t.searchTitle,
    description: t.metaDescription,
    inLanguage: "he",
    datePublished: "2026-08-04",
    dateModified: "2026-08-04",
    author: siteAuthorRef(),
    publisher: { "@type": "Organization", name: "טיפול חכם", url: BASE_URL },
    url,
    articleSection: "מסגרת, עלות וזכויות",
    isPartOf: { "@type": "WebSite", name: "טיפול חכם", url: BASE_URL },
  };

  // Only real questions the page answers below - no decorative markup.
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `${t.name} - מה ביטוח לאומי מממן?`,
        acceptedAnswer: { "@type": "Answer", text: t.covered },
      },
      {
        "@type": "Question",
        name: `כמה מפגשי טיפול מכוסים ב${t.name}?`,
        acceptedAnswer: { "@type": "Answer", text: t.sessionsNote },
      },
      ...t.issues.slice(0, 3).map((i) => ({
        "@type": "Question" as const,
        name: i.problem,
        acceptedAnswer: { "@type": "Answer" as const, text: i.whatToDo },
      })),
    ],
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "בית", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "מאמרים ומידע שימושי", item: `${BASE_URL}/research` },
      { "@type": "ListItem", position: 3, name: "טיפול נפשי דרך ביטוח לאומי", item: `${BASE_URL}/research/btl` },
      { "@type": "ListItem", position: 4, name: t.name, item: url },
    ],
  };

  return (
    <ArticleShell
      href={`/research/btl/${t.slug}`}
      title={t.name}
      sectionSlug="מסגרת-עלות-וזכויות"
      author={{ name: SITE_AUTHOR.name, role: SITE_AUTHOR.jobTitle, href: SITE_AUTHOR_PATH }}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />

      <div className="mb-8">
        <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--teal)", letterSpacing: ".14em", marginBottom: "10px" }}>
          ביטוח לאומי · {t.name}
        </p>
        <h1 style={{ fontSize: "clamp(1.75rem,4vw,2.3rem)", fontWeight: 900, color: "var(--text)", lineHeight: 1.25, letterSpacing: "-.02em", marginBottom: "16px" }}>
          {t.searchTitle}
        </h1>
        <p style={{ fontSize: "16px", color: "var(--text-2)", lineHeight: 1.85 }}>{t.whoFor}</p>
      </div>

      {/* The single most load-bearing fact: does this track pay for therapy at all. */}
      <div
        className="mb-8 rounded-2xl p-5"
        style={
          t.fundsTherapyDirectly
            ? { background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }
            : { background: "var(--gold-pale)", border: "1px solid var(--gold)" }
        }
      >
        <p
          style={{
            fontWeight: 900,
            fontSize: "15px",
            color: t.fundsTherapyDirectly ? "var(--teal-dark)" : "var(--gold-dark)",
            marginBottom: "6px",
          }}
        >
          {t.fundsTherapyDirectly ? "✓ המסלול הזה מממן טיפול נפשי" : "○ המסלול הזה משלם קצבה, לא מממן טיפול"}
        </p>
        <p style={{ fontSize: "14.5px", lineHeight: 1.8, color: "var(--text-2)" }}>{t.covered}</p>
      </div>

      <article className="space-y-10 text-stone-700 leading-8 text-base">

        <section>
          <h2 style={h2}>ההליך, שלב אחר שלב</h2>
          <BtlProcessFlow steps={t.steps} />
        </section>

        <section>
          <h2 style={h2}>הטפסים</h2>
          <ul className="space-y-2">
            {t.forms.map((f) => (
              <li key={f.number} className="flex items-start gap-3">
                <span
                  dir="ltr"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: "8px",
                    padding: "2px 10px",
                    fontSize: "13px",
                    fontWeight: 800,
                    color: "var(--text)",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {f.number}
                </span>
                <span style={{ fontSize: "15px", lineHeight: 1.7 }}>{f.title}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
            <strong>מי מחליט:</strong> {t.decidedBy}
          </p>
        </section>

        <section>
          <h2 style={h2}>כמה מפגשים מכוסים</h2>
          <p>{t.sessionsNote}</p>
          <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
            שימו לב: באתר הרשמי אין מספר מפגשים אחיד שמפורסם מראש לרוב המסלולים, ומי שמבטיח לכם מספר
            מדויק מראש כנראה מנחש. את ההיקף קובעים מול עובד/ת השיקום.
          </p>
        </section>

        {/* ── Part 2: what goes wrong ─────────────────────────────────────── */}
        <section>
          <h2 style={h2}>מה משתבש, ומה עושים</h2>
          <div className="space-y-5">
            {t.issues.map((i) => (
              <div key={i.problem} className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
                <p style={{ fontWeight: 800, fontSize: "15.5px", color: "var(--text)", marginBottom: "8px" }}>
                  “{i.problem}”
                </p>
                <p style={{ fontSize: "14.5px", lineHeight: 1.85, color: "var(--text-2)" }}>{i.whatToDo}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 style={h2}>ערעורים - ולוחות הזמנים שאסור לפספס</h2>
          <p className="mb-4">
            זה החלק הכי תלוי-זמן בכל התהליך. חלון ערר שחלף סוגר את התיק, ולכן כדאי להגיש ערר גם אם עדיין
            אוספים מסמכים, ולציין שנימוקים משלימים יישלחו בהמשך.
          </p>
          <div className="table-scroll" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14.5px", minWidth: "440px" }}>
              <thead>
                <tr>
                  {["על מה מערערים", "חלון הזמן", "לאן"].map((th) => (
                    <th
                      key={th}
                      style={{ textAlign: "start", padding: "10px 12px", background: "var(--surface)", color: "var(--muted)", fontSize: "13px", fontWeight: 700, borderBottom: "1px solid var(--line)" }}
                    >
                      {th}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.appeals.map((a) => (
                  <tr key={a.against}>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", color: "var(--text)", fontWeight: 500 }}>{a.against}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", color: "var(--text-2)", fontWeight: 700 }}>{a.window}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", color: "var(--text-2)" }}>{a.to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
            לערעור לבית הדין לעבודה קיים <strong>סיוע משפטי חינם</strong> מלשכות הסיוע המשפטי של משרד
            המשפטים, ללא מבחן הכנסה. רבים אינם יודעים זאת ומוותרים על ערעור מטעמי עלות.
          </p>
        </section>

        {/* ── Route to supply ─────────────────────────────────────────────── */}
        <section style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)", borderRadius: "16px", padding: "24px 26px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 900, color: "var(--teal-dark)", marginBottom: "10px" }}>
            מחפשים מטפל/ת?
          </h2>
          <p className="text-sm leading-7">
            אפשר להתחיל מהשאלון שממפה את הקושי וממליץ על סוג הטיפול, או לעבור ישירות לרשימות הרלוונטיות.
            בחינם, אנונימי וללא התחייבות.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {[{ href: "/adults", label: "לשאלון למבוגרים" }, { href: "/kids", label: "לשאלון לילדים ונוער" }, ...t.directory].map(
              ({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-full px-4 py-2 text-sm font-semibold"
                  style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--teal-dark)", textDecoration: "none" }}
                >
                  {label}
                </Link>
              )
            )}
          </div>
        </section>

        <section>
          <h2 style={h2}>מסלולים אחרים</h2>
          <p className="mb-3 text-sm" style={{ color: "var(--muted)" }}>
            אפשר להיות זכאי בכמה מסלולים במקביל, והם אינם מבטלים זה את זה.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/research/btl"
              className="rounded-full px-4 py-2 text-sm font-semibold"
              style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text-2)", textDecoration: "none" }}
            >
              ← המפה המלאה
            </Link>
            {others.map((x) => (
              <Link
                key={x.slug}
                href={`/research/btl/${x.slug}`}
                className="rounded-full px-4 py-2 text-sm font-semibold"
                style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text-2)", textDecoration: "none" }}
              >
                {x.name}
              </Link>
            ))}
          </div>
        </section>

        <AuthorByline
          note={`מדריך זה נכתב על ידי ${SITE_AUTHOR.name}, ${SITE_AUTHOR.jobTitle} וממייסדי "טיפול חכם". תנאי הזכאות, הסכומים ומספרי הטפסים משתנים מעת לעת, והפרטים המחייבים הם תמיד של המוסד לביטוח לאומי עצמו. אין באמור ייעוץ משפטי. עודכן באוגוסט 2026.`}
        />
      </article>
    </ArticleShell>
  );
}
