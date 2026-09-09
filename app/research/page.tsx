import Link from "next/link";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import {
  SECTIONS,
  EDITORIAL_ARTICLES,
  sectionForTopic,
  type EditorialArticle,
} from "@/app/lib/article-taxonomy";

const BASE_URL = "https://www.mentalytics.co.il";

const HUB_DESCRIPTION =
  "מידע מקצועי בעברית על סוגי טיפולים נפשיים, איך לבחור מטפל, אבחונים, חרדה, טראומה, טיפול אונליין ועוד - מותאם לישראל ולמערכת הבריאות הישראלית.";

export const metadata: Metadata = {
  title: "מאמרים ומידע על טיפול נפשי",
  description: HUB_DESCRIPTION,
  alternates: { canonical: `${BASE_URL}/research` },
  openGraph: {
    title: "מאמרים ומידע על טיפול נפשי",
    description: HUB_DESCRIPTION,
    url: `${BASE_URL}/research`,
    type: "website",
  },
};

// Refresh the hub periodically so newly-approved community articles appear.
export const revalidate = 300;

type CommunityItem = {
  slug: string;
  title: string;
  summary: string;
  topic: string | null;
  author: string;
  img: string | null;
  imgAlt: string;
};

async function getCommunityArticles(): Promise<CommunityItem[]> {
  const { data } = await supabaseAdmin
    .from("therapist_articles")
    .select("slug, title, summary, topic, image_url, image_alt, author_name, therapists(full_name)")
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(60);
  return (data ?? []).map((r) => {
    const t = Array.isArray(r.therapists) ? r.therapists[0] : r.therapists;
    return {
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      topic: r.topic,
      author: r.author_name?.trim() || t?.full_name || "מטפל/ת",
      img: r.image_url ?? null,
      imgAlt: r.image_alt ?? r.title,
    };
  });
}

function Card({
  href,
  title,
  desc,
  img,
  imgPosition = "center",
  byline,
}: {
  href: string;
  title: string;
  desc: string;
  img: string | null;
  imgPosition?: string;
  byline?: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl bg-white transition hover:shadow-md hover:-translate-y-0.5"
      style={{
        border: "1px solid var(--line)",
        boxShadow: "0 2px 10px rgba(61,140,138,.05)",
        textDecoration: "none",
        overflow: "hidden",
      }}
    >
      {img && (
        <div style={{ height: "168px", overflow: "hidden", background: "var(--surface)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img}
            alt={title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: imgPosition,
              transition: "transform .45s ease",
              display: "block",
            }}
            className="group-hover:scale-105"
            loading="lazy"
          />
        </div>
      )}
      <div style={{ padding: "20px 22px" }}>
        <h3
          style={{ fontSize: "15.5px", fontWeight: 800, color: "var(--text)", marginBottom: "7px" }}
          className="group-hover:underline"
        >
          {title}
        </h3>
        {desc && <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.75 }}>{desc}</p>}
        {/* A therapist byline is an E-E-A-T signal, so it stays visible on the card. */}
        {byline && <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--faint)" }}>מאת {byline}</div>}
      </div>
    </Link>
  );
}

export default async function ResearchHubPage() {
  const community = await getCommunityArticles();

  // Group both article kinds into the same sections. A community article whose
  // topic is unset (or maps nowhere) falls back to the general adult section
  // rather than vanishing from the hub.
  const FALLBACK = "טיפול-במבוגרים";
  const bySection = new Map<string, { editorial: EditorialArticle[]; community: CommunityItem[] }>();
  for (const s of SECTIONS) bySection.set(s.slug, { editorial: [], community: [] });
  for (const a of EDITORIAL_ARTICLES) bySection.get(a.section)?.editorial.push(a);
  for (const c of community) {
    const slug = sectionForTopic(c.topic)?.slug ?? FALLBACK;
    (bySection.get(slug) ?? bySection.get(FALLBACK))!.community.push(c);
  }

  const populated = SECTIONS.map((s) => ({ section: s, ...bySection.get(s.slug)! })).filter(
    (g) => g.editorial.length + g.community.length > 0
  );

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "מאמרים ומידע שימושי",
    description: HUB_DESCRIPTION,
    url: `${BASE_URL}/research`,
    inLanguage: "he",
    isPartOf: { "@type": "WebSite", name: "טיפול חכם", url: BASE_URL },
    hasPart: [
      ...EDITORIAL_ARTICLES.map((a) => ({
        "@type": "Article" as const,
        headline: a.title,
        url: `${BASE_URL}/research/${a.slug}`,
      })),
      ...community.map((c) => ({
        "@type": "Article" as const,
        headline: c.title,
        url: `${BASE_URL}/research/community/${encodeURIComponent(c.slug)}`,
        author: { "@type": "Person" as const, name: c.author },
      })),
    ],
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "בית", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "מאמרים ומידע שימושי", item: `${BASE_URL}/research` },
    ],
  };

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-14 pb-20" dir="rtl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />

      {/* Header */}
      <div className="mb-10 text-center">
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "10px" }}>
          ידע מקצועי
        </p>
        <h1 style={{ fontSize: "clamp(2rem,4vw,2.8rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em", marginBottom: "14px" }}>
          מאמרים ומידע שימושי
        </h1>
        <p style={{ fontSize: "16px", color: "var(--text-2)", lineHeight: 1.8, maxWidth: "46ch", margin: "0 auto" }}>
          מידע מקצועי ונגיש על עולם הטיפול הנפשי - כדי שתוכלו להגיע מוכנים ולקבל החלטות מושכלות.
        </p>
      </div>

      {/* מכאן ולמטה: סרגל נושאים + תוכן. הכותרת נשארת מעל הפיצול ברוחב מלא,
          כדי שה-H1 יישאר ראשון במסמך ולא יידחק אחרי רשימת הניווט.

          הסרגל והצ'יפים הם **אותו סט קישורים** ולא שני עותקים: ברוחב נייד
          ה-nav הוא שורת פילים כמו שהיה, ומ-lg הוא הופך לרשימה אנכית דביקה.
          שכפול הקישורים היה מייצר שתי עוגנים לכל עמוד נושא באותו דף. */}
      <div className="lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:items-start lg:gap-12">
        {/* גובה מוגבל וגלילה משלו: עשרה נושאים ועוד קופסת השאלון מגיעים
            לכ-520 פיקסלים, ובחלון נמוך (לפטופ 13" עם סרגלי דפדפן) התחתית
            הייתה נחתכת בלי דרך להגיע אליה. */}
        <aside className="mb-12 lg:sticky lg:top-6 lg:mb-0 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto">
          <p
            className="mb-3 hidden lg:block"
            style={{ fontSize: "11.5px", fontWeight: 800, letterSpacing: ".14em", color: "var(--teal-dark)" }}
          >
            נושאים
          </p>
          <nav
            aria-label="נושאים"
            className="flex flex-wrap justify-center gap-2 lg:block lg:gap-0 lg:border-s-2 lg:border-s-[var(--line)]"
          >
            {populated.map(({ section, editorial, community: items }) => (
              <Link
                key={section.slug}
                href={`/research/topic/${section.slug}`}
                className="flex items-baseline justify-between gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text-2)] no-underline transition hover:opacity-80 lg:-ms-0.5 lg:rounded-none lg:rounded-e-[10px] lg:border-0 lg:border-s-2 lg:border-s-transparent lg:bg-transparent lg:px-3.5 lg:text-[13.5px] lg:hover:border-s-[var(--teal)] lg:hover:bg-[var(--teal-pale)] lg:hover:opacity-100"
              >
                {section.name}
                {/* המונה מופיע רק בסרגל: בשורת פילים צרה הוא רק מוסיף רעש. */}
                <span className="hidden tabular-nums lg:inline" style={{ fontSize: "11.5px", color: "var(--faint)" }}>
                  {editorial.length + items.length}
                </span>
              </Link>
            ))}
          </nav>

          <div
            className="mt-5 hidden lg:block"
            style={{ background: "var(--gold-pale)", border: "1px solid #EDDCB4", borderRadius: "14px", padding: "14px" }}
          >
            <p style={{ fontSize: "12.5px", color: "var(--text-2)", lineHeight: 1.65, margin: "0 0 10px" }}>
              לא בטוחים איזה טיפול מתאים? השאלון נותן כיוון תוך כמה דקות.
            </p>
            <div className="flex gap-2">
              <Link
                href="/adults"
                className="flex-1 rounded-full py-2 text-center text-[12.5px] font-extrabold text-white no-underline transition hover:opacity-90"
                style={{ background: "var(--teal)" }}
              >
                למבוגרים
              </Link>
              <Link
                href="/kids"
                className="flex-1 rounded-full py-2 text-center text-[12.5px] font-extrabold no-underline transition hover:opacity-90"
                style={{ background: "#fff", border: "1px solid var(--teal)", color: "var(--teal-dark)" }}
              >
                לילדים
              </Link>
            </div>
          </div>
        </aside>

        <div>

      {populated.map(({ section, editorial, community: items }) => {
        // Featured guides first, then the rest, then therapist-written pieces.
        const ordered = [...editorial].sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
        return (
          <section key={section.slug} className="mb-14">
            <div className="mb-5 flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h2 style={{ fontSize: "19px", fontWeight: 800, color: "var(--text)", marginBottom: "4px" }}>
                  {section.name}
                </h2>
                <p style={{ fontSize: "13px", color: "var(--muted)", maxWidth: "62ch", lineHeight: 1.7 }}>
                  {section.blurb}
                </p>
              </div>
              {editorial.length + items.length > 2 && (
                <Link
                  href={`/research/topic/${section.slug}`}
                  style={{ fontSize: "13px", fontWeight: 700, color: "var(--teal)", whiteSpace: "nowrap" }}
                >
                  כל המאמרים בנושא ←
                </Link>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {ordered.map((a) => (
                <Card
                  key={a.slug}
                  href={`/research/${a.slug}`}
                  title={a.title}
                  desc={a.desc}
                  img={a.img}
                  imgPosition={a.imgPosition}
                />
              ))}
              {items.map((c) => (
                <Card
                  key={c.slug}
                  href={`/research/community/${c.slug}`}
                  title={c.title}
                  desc={c.summary}
                  img={c.img}
                  byline={c.author}
                />
              ))}
            </div>

            {/* The commercial half of the same intent. */}
            {section.directory.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span style={{ fontSize: "12.5px", color: "var(--faint)" }}>מחפשים מטפל?</span>
                {section.directory.map((d) => (
                  <Link
                    key={d.href}
                    href={d.href}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
                    style={{ background: "var(--teal-pale)", color: "var(--teal-dark)", textDecoration: "none" }}
                  >
                    {d.label}
                  </Link>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* Academic sources */}
      <div style={{ background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--line)", padding: "24px 28px" }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 style={{ fontWeight: 800, color: "var(--text)", fontSize: "16px" }}>מאמרים אקדמאיים</h3>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>
              השאלונים מבוססים על מאות מחקרים - הנה המקורות המלאים.
            </p>
          </div>
          <Link
            href="/research/academic"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "var(--teal)",
              color: "white",
              borderRadius: "50px",
              padding: "10px 22px",
              fontSize: "14px",
              fontWeight: 700,
              transition: "background .2s",
            }}
            className="hover:bg-[var(--teal-dark)]"
          >
            לרשימת המאמרים ←
          </Link>
        </div>
      </div>
        </div>
      </div>
    </main>
  );
}
