import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ArticleShell from "@/app/components/ArticleShell";
import { AuthorByline } from "@/app/components/AuthorByline";
import { siteAuthorRef, SITE_AUTHOR, SITE_AUTHOR_PATH } from "@/app/lib/author";
import { BTL_TRACKS, btlTrackBySlug } from "@/app/lib/btl-tracks";
import BtlProcessFlow from "@/app/components/BtlProcessFlow";
import BtlDeadlines from "@/app/components/BtlDeadlines";

const BASE_URL = "https://www.mentalytics.co.il";

/** Landing page listing therapists who work through National Insurance. */
const BTL_THERAPISTS = "/therapists/arrangement/%D7%91%D7%99%D7%98%D7%95%D7%97-%D7%9C%D7%90%D7%95%D7%9E%D7%99";

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

/**
 * scrollMarginTop keeps a heading clear of the sticky header when the reader
 * arrives from the contents list - without it the anchor lands with the title
 * hidden behind the nav, which reads as a broken link.
 */
const h2 = {
  fontSize: "21px",
  fontWeight: 800,
  color: "var(--text)",
  marginBottom: "14px",
  borderBottom: "2px solid var(--teal-mid)",
  paddingBottom: "8px",
  scrollMarginTop: "90px",
} as const;

const h3 = {
  fontSize: "16.5px",
  fontWeight: 800,
  color: "var(--text)",
  marginBottom: "10px",
} as const;

export default async function BtlTrackPage({ params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  const t = btlTrackBySlug(track);
  if (!t) notFound();

  const url = `${BASE_URL}/research/btl/${t.slug}`;
  const others = BTL_TRACKS.filter((x) => x.slug !== t.slug);

  const contents = [
    { id: "why", label: "למה כדאי לקבל עזרה", hint: "החלק הנפשי" },
    { id: "process", label: "ההליך הבירוקרטי", hint: "שלבים, טפסים ומה משתבש" },
    { id: "official", label: "קישורים רשמיים", hint: "ישירות לביטוח לאומי" },
    { id: "visual", label: "לוחות הזמנים בתמונה", hint: "מה דחוף ומה לא" },
    { id: "summary", label: "סיכום קצר", hint: "מה לעשות, לפי סדר" },
  ];

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: t.searchTitle,
    description: t.metaDescription,
    inLanguage: "he",
    datePublished: "2026-08-04",
    dateModified: "2026-08-04",
    // Both, because the visible byline credits both - structured data that
    // disagrees with the rendered page is worse than none.
    author: [siteAuthorRef(), { "@type": "Organization", name: "צוות טיפול חכם", url: BASE_URL }],
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

      {/* ── Contents ────────────────────────────────────────────────────────
          Readers arrive here from very different places: some want the form
          number and nothing else, some are trying to decide whether what they
          feel warrants help at all. Jump links let both get where they are
          going without scrolling past the other's section. */}
      <nav
        aria-label="תוכן העמוד"
        className="mb-10 rounded-2xl"
        style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "20px 22px" }}
      >
        <p style={{ fontSize: "12px", fontWeight: 800, color: "var(--muted)", letterSpacing: ".1em", marginBottom: "12px" }}>
          מה יש בעמוד הזה
        </p>
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "2px" }}>
          {contents.map((c, i) => (
            <li key={c.id}>
              <a
                href={`#${c.id}`}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "10px",
                  padding: "8px 10px",
                  borderRadius: "10px",
                  textDecoration: "none",
                  color: "var(--text)",
                }}
              >
                <span
                  aria-hidden
                  style={{ fontSize: "12px", fontWeight: 800, color: "var(--teal)", minWidth: "16px" }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: "15px", fontWeight: 700 }}>{c.label}</span>
                <span style={{ fontSize: "13px", color: "var(--muted)" }}>· {c.hint}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="space-y-10 text-stone-700 leading-8 text-base">

        {/* ── 1. The clinical half ─────────────────────────────────────────── */}
        <section>
          <h2 id="why" style={h2}>{t.whyHelp.heading}</h2>
          {t.whyHelp.paragraphs.map((p) => (
            <p key={p.slice(0, 40)} className="mb-4">{p}</p>
          ))}

          <div className="rounded-2xl p-5 mt-6" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }}>
            <p style={{ fontWeight: 800, fontSize: "15px", color: "var(--teal-dark)", marginBottom: "10px" }}>
              מתי זה סימן לפנות לעזרה
            </p>
            <ul className="space-y-2" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {t.whyHelp.signs.map((s) => (
                <li key={s} style={{ fontSize: "14.5px", lineHeight: 1.75, color: "var(--text-2)", display: "flex", gap: "9px" }}>
                  <span aria-hidden style={{ color: "var(--teal)", fontWeight: 900 }}>·</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
            <p style={{ fontSize: "13.5px", color: "var(--muted)", marginTop: "12px", lineHeight: 1.7 }}>
              אף אחד מהסימנים האלה אינו אבחנה, ואין צורך בכולם. אם משהו כאן מוכר לכם ונמשך - זו סיבה
              מספקת לפנות, גם בלי לדעת אם זה חמור מספיק.
            </p>
          </div>
        </section>

        {/* ── 2. The bureaucratic half ─────────────────────────────────────── */}
        <section>
          <h2 id="process" style={h2}>ההליך הבירוקרטי, שלב אחר שלב</h2>
          <BtlProcessFlow steps={t.steps} />
        </section>

        <section>
          <h3 style={h3}>הטפסים</h3>
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
          <h3 style={h3}>כמה מפגשים מכוסים</h3>
          <p>{t.sessionsNote}</p>
          <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
            שימו לב: באתר הרשמי אין מספר מפגשים אחיד שמפורסם מראש לרוב המסלולים, ומי שמבטיח לכם מספר
            מדויק מראש כנראה מנחש. את ההיקף קובעים מול עובד/ת השיקום.
          </p>
        </section>

        <section>
          <h3 style={h3}>מה משתבש, ומה עושים</h3>
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
          <h3 style={h3}>ערעורים - ולוחות הזמנים שאסור לפספס</h3>
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

        {/* ── 3. Official sources, inside the bureaucratic half ─────────────── */}
        <section>
          <h3 id="official" style={{ ...h3, scrollMarginTop: "90px" }}>הקישורים הרשמיים</h3>
          <p className="mb-4 text-sm" style={{ color: "var(--muted)" }}>
            העמוד הזה מסביר ומסדר, אבל הגורם המחייב הוא תמיד ביטוח לאומי עצמו. אלה העמודים שמהם נלקחו
            הפרטים כאן, וכדאי לוודא בהם לפני הגשה - התנאים והסכומים משתנים.
          </p>
          <ul className="space-y-2" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {t.officialLinks.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="rounded-xl"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px 14px",
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    color: "var(--teal-dark)",
                    fontSize: "14.5px",
                    fontWeight: 600,
                    textDecoration: "none",
                    lineHeight: 1.6,
                  }}
                >
                  <span aria-hidden style={{ color: "var(--teal)", flexShrink: 0 }}>↗</span>
                  <span>{l.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        {/* ── 4. Visualisation ─────────────────────────────────────────────── */}
        <section>
          <h2 id="visual" style={h2}>לוחות הזמנים בתמונה אחת</h2>
          <p className="mb-5">
            רוב מי שמפספס זכאות לא מפספס אותה בגלל שהתנאים לא התקיימו, אלא בגלל שחלון זמן נסגר. זהו
            אותו מידע שבטבלה למעלה, בקנה מידה - כדי שיהיה ברור מה נשרף תוך שבועות ומה יש עליו שנה.
          </p>
          <BtlDeadlines appeals={t.appeals} />
        </section>

        {/* ── 5. Recap ─────────────────────────────────────────────────────── */}
        <section>
          <h2 id="summary" style={h2}>סיכום קצר</h2>
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "12px" }}>
            {t.summary.map((s, i) => (
              <li key={s} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <span
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    width: "26px",
                    height: "26px",
                    borderRadius: "50px",
                    background: "var(--teal-pale)",
                    color: "var(--teal-dark)",
                    fontSize: "13px",
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: "15.5px", lineHeight: 1.8, color: "var(--text-2)" }}>{s}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Route to supply ─────────────────────────────────────────────── */}
        <section style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)", borderRadius: "16px", padding: "24px 26px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 900, color: "var(--teal-dark)", marginBottom: "10px" }}>
            לא בטוחים לאן להתקדם?
          </h2>
          <p className="text-sm leading-7">
            אם אתם יודעים שמשהו לא בסדר אבל לא יודעים איזה טיפול מתאים או למי לפנות, השאלון ממפה את
            הקושי ומציע בסופו התאמה אישית - סוג הטיפול ומטפלים שמתאימים לו. הוא <strong>בחינם, אנונימי
            וללא התחייבות</strong>, ולוקח כמה דקות.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              { href: "/adults", label: "לשאלון למבוגרים" },
              { href: "/kids", label: "לשאלון לילדים ונוער" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="rounded-full px-5 py-2.5 text-sm font-bold"
                style={{ background: "var(--teal)", color: "#fff", textDecoration: "none" }}
              >
                {label}
              </Link>
            ))}
          </div>

          <div style={{ borderTop: "1px solid var(--teal-mid)", marginTop: "20px", paddingTop: "18px" }}>
            <p className="text-sm leading-7" style={{ marginBottom: "12px" }}>
              ואם אתם כבר יודעים מה אתם מחפשים - כאן מרוכזים המטפלים שעובדים דרך ביטוח לאומי:
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={BTL_THERAPISTS}
                className="rounded-full px-4 py-2 text-sm font-semibold"
                style={{ background: "var(--bg)", border: "1px solid var(--teal-mid)", color: "var(--teal-dark)", textDecoration: "none" }}
              >
                מטפלים דרך ביטוח לאומי
              </Link>
              {t.directory.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-full px-4 py-2 text-sm font-semibold"
                  style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--teal-dark)", textDecoration: "none" }}
                >
                  {label}
                </Link>
              ))}
            </div>
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
          coAuthor="צוות טיפול חכם"
          note={`נכתב על ידי ${SITE_AUTHOR.name}, ${SITE_AUTHOR.jobTitle} וממייסדי "טיפול חכם", יחד עם צוות טיפול חכם. תנאי הזכאות, הסכומים ומספרי הטפסים משתנים מעת לעת, והפרטים המחייבים הם תמיד של המוסד לביטוח לאומי עצמו. אין באמור ייעוץ משפטי. עודכן באוגוסט 2026.`}
        />
      </article>
    </ArticleShell>
  );
}
