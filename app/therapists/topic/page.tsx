import Link from "next/link";
import type { Metadata } from "next";
import { TOPICS } from "@/app/lib/topics";
import { countListed, MIN_LISTED_FOR_INDEX } from "@/app/lib/therapist-directory";
import PageViewTracker from "@/app/components/PageViewTracker";

const BASE = "https://www.mentalytics.co.il";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "מטפלים לפי סוג קושי ולפי גיל | טיפול חכם",
  description:
    "טיפול בחרדה, בדיכאון, בטראומה, ב-OCD ובקשיי קשב, וכן פסיכולוג לילדים, לנוער ולגיל השלישי - בחרו את מה שרלוונטי לכם וראו מטפלים מאומתים.",
  alternates: { canonical: `${BASE}/therapists/topic` },
  openGraph: {
    title: "מטפלים לפי סוג קושי ולפי גיל",
    description: "בחרו את הקושי או את הגיל וראו מטפלים מאומתים עם הכשרה רלוונטית - דרך טיפול חכם.",
    url: `${BASE}/therapists/topic`,
  },
};

function firstSentence(text: string): string {
  const s = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return s.length > 135 ? s.slice(0, 132).trimEnd() + "…" : s;
}

export default async function TopicHubPage() {
  // adsOnly topics are noindex by design (paid-landing only), so they never
  // belong in a hub meant to be crawled. The rest must clear the supply gate.
  const candidates = TOPICS.filter((t) => !t.adsOnly);
  const counted = await Promise.all(
    candidates.map(async (t) => ({ topic: t, count: await countListed(t.filter) }))
  );
  const listed = counted.filter((c) => c.count >= MIN_LISTED_FOR_INDEX);
  const conditions = listed.filter((c) => c.topic.kind === "condition");
  const audiences = listed.filter((c) => c.topic.kind === "audience");

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "בית", item: BASE },
      { "@type": "ListItem", position: 2, name: "המטפלים שלנו", item: `${BASE}/therapists` },
      { "@type": "ListItem", position: 3, name: "לפי סוג קושי", item: `${BASE}/therapists/topic` },
    ],
  };

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "מטפלים לפי סוג קושי ולפי גיל",
    url: `${BASE}/therapists/topic`,
    inLanguage: "he",
    isPartOf: { "@type": "WebSite", name: "טיפול חכם", url: BASE },
    hasPart: listed.map((c) => ({
      "@type": "CollectionPage" as const,
      name: c.topic.name,
      url: `${BASE}/therapists/topic/${encodeURIComponent(c.topic.slug)}`,
    })),
  };

  const Card = ({ topic, count }: { topic: (typeof TOPICS)[number]; count: number }) => (
    <Link
      href={`/therapists/topic/${topic.slug}`}
      className="rounded-2xl bg-white p-5 transition hover:shadow-md hover:-translate-y-0.5"
      style={{ border: "1px solid var(--line)", textDecoration: "none" }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-lg font-black text-stone-900">{topic.name}</div>
        <div className="text-xs shrink-0" style={{ color: "var(--faint)" }}>
          {count} מטפלים
        </div>
      </div>
      <div className="text-sm text-stone-500 mt-1 leading-6">{firstSentence(topic.intro)}</div>
    </Link>
  );

  return (
    <main className="mx-auto max-w-4xl px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <PageViewTracker page="hub:topic" source="hub" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />

      <Link href="/therapists" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← כל המטפלים</Link>

      <div className="mb-8">
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "8px" }}>
          לפי סוג קושי
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em" }}>
          מטפלים לפי סוג הקושי ולפי הגיל
        </h1>
        <p className="mt-3 text-stone-600 leading-8" style={{ maxWidth: "60ch" }}>
          לכל קושי יש גישות טיפוליות שנחקרו לעומקו והוכחו כיעילות עבורו. בכל עמוד תמצאו הסבר קצר על מה שעובד,
          ולצידו המטפלים שהוכשרו בגישות הרלוונטיות.
        </p>
      </div>

      {conditions.length > 0 && (
        <>
          <h2 className="text-lg font-black text-stone-900 mb-3">לפי סוג הקושי</h2>
          <div className="grid gap-3 sm:grid-cols-2 mb-10">
            {conditions.map((c) => (
              <Card key={c.topic.slug} topic={c.topic} count={c.count} />
            ))}
          </div>
        </>
      )}

      {audiences.length > 0 && (
        <>
          <h2 className="text-lg font-black text-stone-900 mb-3">לפי גיל המטופל</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {audiences.map((c) => (
              <Card key={c.topic.slug} topic={c.topic} count={c.count} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
