import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { bodyToParagraphs } from "@/app/lib/articles";

const BASE_URL = "https://www.mentalytics.co.il";

type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  topic: string | null;
  approved_at: string | null;
  created_at: string;
  therapist_id: string;
  image_url: string | null;
  image_alt: string | null;
  image_credit: string | null;
  therapists: { full_name: string | null } | { full_name: string | null }[] | null;
};

async function getArticle(slug: string): Promise<ArticleRow | null> {
  const { data, error } = await supabaseAdmin
    .from("therapist_articles")
    .select(
      "id, title, slug, summary, body, topic, approved_at, created_at, therapist_id, image_url, image_alt, image_credit, therapists(full_name)"
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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArticle(decodeURIComponent(slug));
  if (!a) return { title: "מאמר לא נמצא" };
  const desc = a.summary || a.body.slice(0, 150);
  return {
    title: `${a.title} | טיפול חכם`,
    description: desc,
    openGraph: {
      title: a.title,
      description: desc,
      url: `${BASE_URL}/research/community/${a.slug}`,
      type: "article",
    },
  };
}

export default async function CommunityArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await getArticle(decodeURIComponent(slug));
  if (!a) notFound();

  const author = authorName(a);
  const paragraphs = bodyToParagraphs(a.body);
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
    description: a.summary || a.body.slice(0, 150),
    inLanguage: "he",
    author: { "@type": "Person", name: author },
    publisher: { "@type": "Organization", name: "טיפול חכם", url: BASE_URL },
    url: `${BASE_URL}/research/community/${a.slug}`,
    datePublished: published,
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
        <Link href={`/therapists/${a.therapist_id}`} className="font-semibold text-[#2e7d8c] hover:underline">
          {author}
        </Link>{" "}
        · {dateLabel}
      </p>

      {a.summary && (
        <p className="text-lg text-stone-700 leading-8 mb-8" style={{ fontWeight: 500 }}>
          {a.summary}
        </p>
      )}

      <article className="space-y-5">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-stone-700 leading-8">
            {p}
          </p>
        ))}
      </article>

      {/* Author attribution — clean, neutral surface (no colorful box) */}
      <div className="mt-12 rounded-2xl border border-[#E8E0D8] bg-[var(--surface)] p-6">
        <p className="text-sm text-stone-700 leading-7">
          מאמר זה נכתב על ידי{" "}
          <Link href={`/therapists/${a.therapist_id}`} className="font-semibold text-[#2e7d8c] hover:underline">
            {author}
          </Link>
          , מטפל/ת באתר טיפול חכם.
        </p>
        <Link
          href={`/therapists/${a.therapist_id}`}
          className="mt-3 inline-block text-sm font-semibold text-[#2e7d8c] hover:underline"
        >
          לצפייה בפרופיל המלא ←
        </Link>
      </div>
    </main>
  );
}
