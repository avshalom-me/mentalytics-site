import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { ArticleBody } from "@/app/components/ArticleBody";
import { therapistTypeLabel } from "@/app/lib/therapist-options";

const BASE_URL = "https://www.mentalytics.co.il";

// A search-snippet-length description: strip markdown markers, collapse
// whitespace, and cut at a word boundary near 160 chars (Google truncates
// beyond that). Used for both the <meta> tag and the Article JSON-LD.
function metaDescription(raw: string): string {
  const clean = raw.replace(/[#*_>[\]()]/g, "").replace(/\s+/g, " ").trim();
  if (clean.length <= 160) return clean;
  const cut = clean.slice(0, 157);
  const at = cut.lastIndexOf(" ");
  return (at > 80 ? cut.slice(0, at) : cut).trimEnd() + "…";
}

// ISR: these are public SEO landing pages whose content changes rarely. Without
// this they were fully dynamic (a live Supabase read on every visit). Cache and
// revalidate every 5 minutes.
export const revalidate = 300;

type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  topic: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string | null;
  therapist_id: string;
  image_url: string | null;
  image_alt: string | null;
  image_credit: string | null;
  canonical_url: string | null;
  author_name: string | null;
  therapists:
    | { full_name: string | null; therapist_types: string[] | null; gender: string | null }
    | { full_name: string | null; therapist_types: string[] | null; gender: string | null }[]
    | null;
};

async function getArticle(slug: string): Promise<ArticleRow | null> {
  const { data, error } = await supabaseAdmin
    .from("therapist_articles")
    .select(
      "id, title, slug, summary, body, topic, approved_at, created_at, updated_at, therapist_id, image_url, image_alt, image_credit, canonical_url, author_name, therapists(full_name, therapist_types, gender)"
    )
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();
  if (error || !data) return null;
  return data as ArticleRow;
}

function authorName(row: ArticleRow): string {
  const t = Array.isArray(row.therapists) ? row.therapists[0] : row.therapists;
  return t?.full_name ?? "מטפל/ת";
}

// Role/title line from the therapist's professional types, inflected to the
// therapist's gender (e.g. "פסיכולוגית קלינית" for a female therapist).
function authorRole(row: ArticleRow): string {
  const t = Array.isArray(row.therapists) ? row.therapists[0] : row.therapists;
  return (t?.therapist_types ?? [])
    .filter(Boolean)
    .map((tp) => therapistTypeLabel(tp, t?.gender))
    .join(" · ");
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArticle(decodeURIComponent(slug));
  if (!a) return { title: "מאמר לא נמצא" };
  const desc = metaDescription(a.summary || a.body);
  const ownUrl = `${BASE_URL}/research/community/${a.slug}`;
  // If the article was first published elsewhere, point the canonical at that
  // original so Google attributes the content there (no duplicate-content
  // competition). Otherwise self-canonicalize.
  const canonical = a.canonical_url?.trim() || ownUrl;
  return {
    // Bare title — the root layout's "%s | טיפול חכם" template adds the brand
    // suffix (returning it here too double-suffixed every article title).
    title: a.title,
    description: desc,
    alternates: { canonical },
    openGraph: {
      title: a.title,
      description: desc,
      url: ownUrl,
      type: "article",
    },
  };
}

export default async function CommunityArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await getArticle(decodeURIComponent(slug));
  if (!a) notFound();

  // A house/editorial byline (e.g. "צוות טיפול חכם") overrides the therapist
  // attribution: no profile link, no professional role, no per-therapist noun.
  const house = a.author_name?.trim() || null;
  const author = house ?? authorName(a);
  const role = house ? "" : authorRole(a);
  const authorT = Array.isArray(a.therapists) ? a.therapists[0] : a.therapists;
  const authorNoun = authorT?.gender === "נקבה" ? "מטפלת" : authorT?.gender === "זכר" ? "מטפל" : "מטפל/ת";
  const published = a.approved_at || a.created_at;
  const dateLabel = new Date(published).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: metaDescription(a.summary || a.body),
    inLanguage: "he",
    // A house byline ("צוות טיפול חכם") is the organization, not a person.
    author: house
      ? { "@type": "Organization", name: author }
      : { "@type": "Person", name: author },
    publisher: { "@type": "Organization", name: "טיפול חכם", url: BASE_URL },
    url: `${BASE_URL}/research/community/${a.slug}`,
    datePublished: published,
    dateModified: a.updated_at || published,
    ...(a.image_url ? { image: a.image_url } : {}),
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>

      <Link href="/research" className="text-sm text-stone-500 hover:underline mb-6 inline-block">
        ← חזרה למאמרים ומידע שימושי
      </Link>

      {a.image_url && (
        <figure className="mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={a.image_url}
            alt={a.image_alt || a.title}
            className="w-full rounded-2xl object-cover"
            style={{ maxHeight: "360px", border: "1px solid #E8E0D8" }}
          />
          {a.image_credit && (
            <figcaption className="mt-2 text-xs text-stone-400 text-center">{a.image_credit}</figcaption>
          )}
        </figure>
      )}

      {a.topic && (
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", letterSpacing: ".08em", marginBottom: "10px" }}>
          {a.topic}
        </p>
      )}

      <h1 className="text-3xl font-black text-stone-900 mb-3">{a.title}</h1>

      <p className="text-sm text-stone-500 mb-8">
        מאת{" "}
        {house ? (
          <span className="font-semibold text-[#2e7d8c]">{author}</span>
        ) : (
          <Link href={`/therapists/${a.therapist_id}`} className="font-semibold text-[#2e7d8c] hover:underline">
            {author}
          </Link>
        )}
        {role && <> · {role}</>}
        {" "}· {dateLabel}
      </p>

      {a.summary && (
        <p className="text-[19px] md:text-[22px] text-stone-700 leading-9 mb-8" style={{ fontWeight: 500 }}>
          {a.summary}
        </p>
      )}

      <ArticleBody body={a.body} />

      {/* Author attribution — colored name + role + note. A house byline links
          to the homepage instead of a therapist profile. */}
      <div className="mt-12 rounded-2xl border border-[#E8E0D8] bg-[var(--surface)] p-6">
        {house ? (
          <>
            <span className="text-lg font-black text-[#2e7d8c]">{author}</span>
            <p className="mt-2 text-sm text-stone-600 leading-7">
              מאמר זה נכתב על ידי {author}. טיפול חכם עוזר לכם למצוא את הטיפול והמטפל/ת המתאימים —
              בחינם ובאנונימיות.
            </p>
            <Link href="/" className="mt-3 inline-block text-sm font-semibold text-[#2e7d8c] hover:underline">
              למציאת מטפל/ת מתאים/ה ←
            </Link>
          </>
        ) : (
          <>
            <Link href={`/therapists/${a.therapist_id}`} className="text-lg font-black text-[#2e7d8c] hover:underline">
              {author}
            </Link>
            {role && <p className="mt-1 text-sm font-semibold text-[var(--teal)]">{role}</p>}
            <p className="mt-2 text-sm text-stone-600 leading-7">
              מאמר זה נכתב על ידי {author}{role ? `, ${role}` : ""}, {authorNoun} באתר טיפול חכם.
            </p>
            <Link
              href={`/therapists/${a.therapist_id}`}
              className="mt-3 inline-block text-sm font-semibold text-[#2e7d8c] hover:underline"
            >
              לצפייה בפרופיל המלא ←
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
