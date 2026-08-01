import Link from "next/link";
import type { Metadata } from "next";
import { SPECIALTY_LIST, specialtyToSlug, specialtyIntro } from "@/app/lib/specialties";
import { countListedByRegionAndCity, MIN_LISTED_FOR_INDEX } from "@/app/lib/therapist-directory";

const BASE = "https://www.mentalytics.co.il";

// Counts come from a live read, so a specialty joins the hub the moment it has
// real supply (same behaviour as the sitemap).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "מטפלים לפי גישה טיפולית | טיפול חכם",
  description:
    "CBT, טיפול דינאמי, EMDR, ACT, DBT, טיפול זוגי ועוד - בחרו גישה טיפולית וראו את המטפלים המאומתים שהוכשרו בה.",
  alternates: { canonical: `${BASE}/therapists/specialty` },
  openGraph: {
    title: "מטפלים לפי גישה טיפולית",
    description: "בחרו גישה טיפולית וראו את המטפלים המאומתים שהוכשרו בה - דרך טיפול חכם.",
    url: `${BASE}/therapists/specialty`,
  },
};

// One short line per card. Falls back to the first sentence of the specialty's
// own intro so a new specialty never renders a blank card.
function blurb(specialty: string): string {
  const intro = specialtyIntro(specialty);
  const firstSentence = intro.split(/(?<=[.!?])\s/)[0] ?? intro;
  return firstSentence.length > 120 ? firstSentence.slice(0, 117).trimEnd() + "…" : firstSentence;
}

export default async function SpecialtyHubPage() {
  const { specialties: counts } = await countListedByRegionAndCity();
  // Only list approaches that clear the same thin-page gate the individual
  // pages use. Linking a hub to noindex pages just burns crawl budget.
  const listed = SPECIALTY_LIST.filter((s) => (counts[s] ?? 0) >= MIN_LISTED_FOR_INDEX).sort(
    (a, b) => (counts[b] ?? 0) - (counts[a] ?? 0)
  );

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "בית", item: BASE },
      { "@type": "ListItem", position: 2, name: "המטפלים שלנו", item: `${BASE}/therapists` },
      { "@type": "ListItem", position: 3, name: "לפי גישה טיפולית", item: `${BASE}/therapists/specialty` },
    ],
  };

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "מטפלים לפי גישה טיפולית",
    url: `${BASE}/therapists/specialty`,
    inLanguage: "he",
    isPartOf: { "@type": "WebSite", name: "טיפול חכם", url: BASE },
    hasPart: listed.map((s) => ({
      "@type": "CollectionPage" as const,
      name: s,
      url: `${BASE}/therapists/specialty/${specialtyToSlug(s)}`,
    })),
  };

  return (
    <main className="mx-auto max-w-4xl px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />

      <Link href="/therapists" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← כל המטפלים</Link>

      <div className="mb-8">
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "8px" }}>
          לפי גישה טיפולית
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em" }}>
          מטפלים לפי גישה טיפולית
        </h1>
        <p className="mt-3 text-stone-600 leading-8" style={{ maxWidth: "60ch" }}>
          לכל גישה טיפולית יש היגיון משלה ומצבים שהיא מתאימה להם במיוחד. בחרו גישה כדי לקרוא עליה ולראות את
          המטפלים המאומתים שהוכשרו בה - או מלאו את השאלון ותנו לנו להמליץ.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {listed.map((s) => (
          <Link
            key={s}
            href={`/therapists/specialty/${specialtyToSlug(s)}`}
            className="rounded-2xl bg-white p-5 transition hover:shadow-md hover:-translate-y-0.5"
            style={{ border: "1px solid var(--line)", textDecoration: "none" }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-lg font-black text-stone-900">{s}</div>
              <div className="text-xs shrink-0" style={{ color: "var(--faint)" }}>
                {counts[s]} מטפלים
              </div>
            </div>
            <div className="text-sm text-stone-500 mt-1 leading-6">{blurb(s)}</div>
          </Link>
        ))}
      </div>

      <div
        className="mt-10 rounded-2xl p-6"
        style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }}
      >
        <p className="font-black" style={{ color: "var(--teal-dark)", fontSize: "16px" }}>
          לא בטוחים איזו גישה מתאימה לכם?
        </p>
        <p className="text-sm mt-1 leading-7" style={{ color: "var(--teal-dark)" }}>
          זו השאלה הכי נפוצה, ואין עליה תשובה אחת. השאלון שלנו ממפה את הקושי וממליץ על סוג הטיפול המתאים.
        </p>
        <Link href="/adults" className="mt-3 inline-block text-sm font-bold" style={{ color: "var(--teal-dark)" }}>
          למילוי השאלון ←
        </Link>
      </div>
    </main>
  );
}
