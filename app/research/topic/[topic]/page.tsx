import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import {
  SECTIONS,
  sectionBySlug,
  editorialBySection,
  MIN_ARTICLES_FOR_SECTION_INDEX,
  type Section,
} from "@/app/lib/article-taxonomy";

const BASE_URL = "https://www.mentalytics.co.il";

export const revalidate = 300;

export function generateStaticParams() {
  return SECTIONS.map((s) => ({ topic: s.slug }));
}

type CommunityItem = { slug: string; title: string; summary: string | null; author: string; img: string | null };

async function communityForSection(section: Section): Promise<CommunityItem[]> {
  if (section.articleTopics.length === 0) return [];
  const { data } = await supabaseAdmin
    .from("therapist_articles")
    .select("slug, title, summary, image_url, author_name, therapists(full_name)")
    .eq("status", "approved")
    .in("topic", section.articleTopics as unknown as string[])
    .order("approved_at", { ascending: false })
    .limit(30);
  return (data ?? []).map((r) => {
    const t = Array.isArray(r.therapists) ? r.therapists[0] : r.therapists;
    return {
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      author: r.author_name?.trim() || t?.full_name || "מטפל/ת",
      img: r.image_url ?? null,
    };
  });
}

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }): Promise<Metadata> {
  const { topic } = await params;
  const section = sectionBySlug(topic);
  if (!section) return { title: "נושא לא נמצא" };

  const total = editorialBySection(section.slug).length + (await communityForSection(section)).length;
  const url = `${BASE_URL}/research/topic/${encodeURIComponent(section.slug)}`;
  // Same thin-page discipline as the city/specialty/topic pages: a hub with one
  // or two items is a near-empty duplicate of /research, so keep it out of the
  // index until it fills up. It rejoins automatically.
  const robots = total >= MIN_ARTICLES_FOR_SECTION_INDEX ? undefined : { index: false, follow: true };

  return {
    title: `${section.name} - מאמרים ומידע`,
    description: section.blurb,
    alternates: { canonical: url },
    robots,
    openGraph: { title: `${section.name} - מאמרים ומידע`, description: section.blurb, url, type: "website" },
  };
}

export default async function ResearchTopicHub({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  const section = sectionBySlug(topic);
  if (!section) notFound();

  const editorial = editorialBySection(section.slug);
  const community = await communityForSection(section);
  const total = editorial.length + community.length;
  const url = `${BASE_URL}/research/topic/${encodeURIComponent(section.slug)}`;

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: section.name,
    description: section.blurb,
    url,
    inLanguage: "he",
    isPartOf: { "@type": "WebSite", name: "טיפול חכם", url: BASE_URL },
    hasPart: [
      ...editorial.map((a) => ({ "@type": "Article" as const, headline: a.title, url: `${BASE_URL}/research/${a.slug}` })),
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
      { "@type": "ListItem", position: 3, name: section.name, item: url },
    ],
  };

  const others = SECTIONS.filter((s) => s.slug !== section.slug);

  return (
    <main className="mx-auto max-w-4xl px-5 py-12 pb-20" dir="rtl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />

      <Link href="/research" className="text-sm text-stone-500 hover:underline mb-6 inline-block">
        ← כל המאמרים
      </Link>

      <div className="mb-8">
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: "8px" }}>
          נושא
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem,3.4vw,2.4rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em", marginBottom: "12px" }}>
          {section.name}
        </h1>
        <p style={{ fontSize: "16px", color: "var(--text-2)", lineHeight: 1.85, maxWidth: "64ch" }}>{section.blurb}</p>
      </div>

      {/* The therapist side of the same intent, high on the page. */}
      {section.directory.length > 0 && (
        <div
          className="mb-10 rounded-2xl p-5"
          style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }}
        >
          <p style={{ fontWeight: 800, color: "var(--teal-dark)", fontSize: "15px", marginBottom: "10px" }}>
            מחפשים מטפל בנושא הזה?
          </p>
          <div className="flex flex-wrap gap-2">
            {section.directory.map((d) => (
              <Link
                key={d.href}
                href={d.href}
                className="rounded-full px-4 py-2 text-sm font-semibold"
                style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--teal-dark)", textDecoration: "none" }}
              >
                {d.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {total === 0 ? (
        <p className="text-stone-500">עדיין אין מאמרים בנושא הזה. אנחנו מוסיפים תוכן חדש כל חודש.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {editorial.map((a) => (
            <Link
              key={a.slug}
              href={`/research/${a.slug}`}
              className="group block rounded-2xl bg-white transition hover:shadow-md hover:-translate-y-0.5"
              style={{ border: "1px solid var(--line)", textDecoration: "none", overflow: "hidden" }}
            >
              <div style={{ height: "150px", overflow: "hidden", background: "var(--surface)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.img}
                  alt={a.title}
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: a.imgPosition ?? "center", display: "block" }}
                />
              </div>
              <div style={{ padding: "18px 20px" }}>
                <h2 style={{ fontSize: "15.5px", fontWeight: 800, color: "var(--text)", marginBottom: "6px" }} className="group-hover:underline">
                  {a.title}
                </h2>
                <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.75 }}>{a.desc}</p>
              </div>
            </Link>
          ))}

          {community.map((c) => (
            <Link
              key={c.slug}
              href={`/research/community/${c.slug}`}
              className="group block rounded-2xl bg-white transition hover:shadow-md hover:-translate-y-0.5"
              style={{ border: "1px solid var(--line)", textDecoration: "none", overflow: "hidden" }}
            >
              {c.img && (
                <div style={{ height: "150px", overflow: "hidden", background: "var(--surface)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.img} alt={c.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
              )}
              <div style={{ padding: "18px 20px" }}>
                <h2 style={{ fontSize: "15.5px", fontWeight: 800, color: "var(--text)", marginBottom: "6px" }} className="group-hover:underline">
                  {c.title}
                </h2>
                {c.summary && <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.75 }}>{c.summary}</p>}
                <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--faint)" }}>מאת {c.author}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <nav aria-label="נושאים נוספים" className="mt-12 pt-8" style={{ borderTop: "1px solid var(--line)" }}>
        <h2 className="text-base font-black text-stone-900 mb-3">נושאים נוספים</h2>
        <div className="flex flex-wrap gap-2">
          {others.map((s) => (
            <Link
              key={s.slug}
              href={`/research/topic/${s.slug}`}
              className="rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-80"
              style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text-2)", textDecoration: "none" }}
            >
              {s.name}
            </Link>
          ))}
        </div>
      </nav>
    </main>
  );
}
