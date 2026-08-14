import { notFound } from "next/navigation";
import { listingItemSchema } from "@/app/lib/listing-schema";
import Link from "next/link";
import type { Metadata } from "next";
import { loadPublicTherapists, countListed, MIN_LISTED_FOR_INDEX } from "@/app/lib/therapist-directory";
import { TOPICS, slugToTopic, PILOT_CITIES, MIN_CITY_TOPIC, CITY_TOPIC_SLUGS } from "@/app/lib/topics";
import { SPECIALTY_LIST, specialtyToSlug } from "@/app/lib/specialties";
import { regionToSlug, ONLINE_SLUG } from "@/app/lib/regions";
import TherapistResultCard from "@/app/components/TherapistResultCard";
import PageViewTracker from "@/app/components/PageViewTracker";
import { sectionForDirectoryHref, editorialBySection } from "@/app/lib/article-taxonomy";
import { loadArticlesByTopics } from "@/app/lib/local-articles";
import { introPlusOffer, therapistOffers } from "@/app/lib/meta-description";

// Condition/audience landing pages ("טיפול בחרדה", "פסיכולוג ילדים") - the
// missing keyword layers (docs/seo-roadmap.md M3). Conditions list therapists
// trained in the approaches that treat the condition; audiences filter by the
// real age_groups tags. Same thin-page gates as cities/specialties.

const BASE = "https://www.mentalytics.co.il";

export const revalidate = 300;

export function generateStaticParams() {
  return TOPICS.map((t) => ({ topic: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }): Promise<Metadata> {
  const { topic: slug } = await params;
  const topic = slugToTopic(slug);
  if (!topic) return { title: "נושא לא נמצא" };
  const url = `${BASE}/therapists/topic/${topic.slug}`;
  const count = await countListed(topic.filter);
  const description = introPlusOffer(topic.intro, ...therapistOffers());
  const robots =
    topic.adsOnly || count < MIN_LISTED_FOR_INDEX ? { index: false as const, follow: true } : undefined;
  return { title: topic.searchTitle, description, alternates: { canonical: url }, robots, openGraph: { title: topic.searchTitle, description, url } };
}

export default async function TopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic: slug } = await params;
  const topic = slugToTopic(slug);
  if (!topic) notFound();

  const list = await loadPublicTherapists(topic.filter);
  const onlineHere = list.filter((t) => t.online).length;

  // Articles for this topic, resolved through the shared taxonomy (a section
  // declares which directory pages it serves, so this stays in one place).
  const articleSection = sectionForDirectoryHref(`/therapists/topic/${topic.slug}`);
  const sectionArticles: { href: string; title: string; byline?: string }[] = articleSection
    ? [
        ...editorialBySection(articleSection.slug).map((a) => ({
          href: `/research/${a.slug}`,
          title: a.title,
        })),
        ...(await loadArticlesByTopics(articleSection.articleTopics as unknown as string[], 4)).map((a) => ({
          href: `/research/community/${encodeURIComponent(a.slug)}`,
          title: a.title,
          byline: a.author,
        })),
      ].slice(0, 6)
    : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: topic.searchTitle,
    inLanguage: "he",
    url: `${BASE}/therapists/topic/${topic.slug}`,
    hasPart: list.slice(0, 50).map(listingItemSchema),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "בית", item: BASE },
      { "@type": "ListItem", position: 2, name: "המטפלים שלנו", item: `${BASE}/therapists` },
      { "@type": "ListItem", position: 3, name: topic.name, item: `${BASE}/therapists/topic/${topic.slug}` },
    ],
  };

  // City sub-pages (the M4 pilot) - link only combos that are actually indexable.
  const cityLinks: { city: string; count: number }[] = [];
  if ((CITY_TOPIC_SLUGS as readonly string[]).includes(topic.slug)) {
    for (const city of PILOT_CITIES) {
      const count = await countListed({ ...topic.filter, city });
      if (count >= MIN_CITY_TOPIC) cityLinks.push({ city, count });
    }
  }

  const otherTopics = TOPICS.filter((t) => t.slug !== topic.slug);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />
      <PageViewTracker page={`topic:${topic.slug}`} source="topic" />

      <Link href="/therapists" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← כל המטפלים</Link>

      <div className="mb-8">
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "8px" }}>
          {topic.kind === "audience" ? "לפי קהל" : "לפי קושי"}
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em" }}>{topic.searchTitle}</h1>
        {list.length >= MIN_LISTED_FOR_INDEX && (
          <p className="mt-2 text-sm text-stone-500">
            {topic.supplyNote}, שתעודותיהם אומתו{onlineHere > 0 ? ", חלקם זמינים גם אונליין" : ""}.
          </p>
        )}
      </div>

      {/* Quiz CTA */}
      <div
        className="mb-10 flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7"
        style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }}
      >
        <div>
          <p style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--teal-dark)" }}>
            לא בטוחים מה מתאים לכם?
          </p>
          <p className="mt-1.5 leading-7 text-stone-600" style={{ maxWidth: "48ch" }}>
            {"ענו על שאלון קצר מבוסס מחקר שנבנה על ידי פסיכולוגים - נזהה את הצורך, נמליץ על סוג הטיפול, ונתאים לכם מטפל/ת."}
          </p>
        </div>
        <Link
          href={topic.kind === "audience" && topic.slug !== "פסיכולוג-לגיל-השלישי" ? "/kids" : "/adults"}
          className="shrink-0 inline-flex items-center justify-center whitespace-nowrap font-bold transition hover:opacity-95"
          style={{ background: "var(--teal)", color: "#fff", borderRadius: "50px", padding: "13px 30px", fontSize: "15px" }}
        >
          למילוי השאלון
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-[#E8E0D8] bg-[var(--surface)] p-6 text-stone-600">
          עדיין אין מטפלים מוצגים בקטגוריה זו. אפשר לעיין ב<Link href="/therapists" className="font-semibold text-[#2e7d8c] hover:underline">כל המטפלים</Link> או למלא <Link href="/adults" className="font-semibold text-[#2e7d8c] hover:underline">שאלון התאמה</Link>.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => <TherapistResultCard key={t.id} t={t} backHref={`/therapists/topic/${topic.slug}`} />)}
        </div>
      )}

      {/* Explanatory prose lives BELOW the listings: a visitor who came to find
          a therapist sees therapists first; the reading material is for those
          who scroll (and for crawlers). */}
      <section className="mt-14 pt-10 border-t border-[var(--line)]" style={{ maxWidth: "72ch" }}>
        <h2 className="text-xl font-extrabold mb-4" style={{ color: "var(--text)" }}>
          על {topic.name} - מה חשוב לדעת
        </h2>
        <p className="text-[15px] leading-8 text-stone-600">{topic.intro}</p>
      </section>

      {topic.related.length > 0 && (
        <div className="mt-8 pt-6 border-t border-[var(--line)]" style={{ maxWidth: "72ch" }}>
          <h2 className="text-base font-extrabold text-stone-800 mb-3">להעמקה באתר</h2>
          <ul className="space-y-2">
            {topic.related.map((r) => (
              <li key={r.href} className="text-sm leading-7">
                <Link href={r.href} className="font-semibold hover:underline" style={{ color: "var(--teal-dark)" }}>{r.label} ←</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cityLinks.length > 0 && (
        <div className="mt-8 pt-6 border-t border-[var(--line)]">
          <h2 className="text-base font-extrabold text-stone-800 mb-3">{topic.name} לפי עיר</h2>
          <div className="flex flex-wrap gap-2">
            {cityLinks.map(({ city }) => (
              <Link key={city} href={`/therapists/city/${regionToSlug(city)}/${topic.slug}`} className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
                style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>{topic.name} - {city}</Link>
            ))}
          </div>
        </div>
      )}

      {/* Reading list for this condition/audience. The specialty pages already
          did this; the topic pages did not, so the informational half of the
          query had no path in from the commercial half. */}
      {articleSection && sectionArticles.length > 0 && (
        <div className="mt-8 pt-6 border-t border-[var(--line)]">
          <h2 className="text-base font-extrabold text-stone-800 mb-1">מאמרים בנושא {topic.name}</h2>
          <p className="text-sm text-stone-500 mb-3">רקע מקצועי שכדאי לקרוא לפני שפונים לטיפול.</p>
          <ul className="space-y-2 list-none p-0">
            {sectionArticles.map((a) => (
              <li key={a.href}>
                <Link href={a.href} className="text-sm font-semibold hover:underline" style={{ color: "var(--teal-dark)" }}>
                  {a.title}
                </Link>
                {a.byline && <span className="text-xs" style={{ color: "var(--faint)" }}> · מאת {a.byline}</span>}
              </li>
            ))}
          </ul>
          <Link
            href={`/research/topic/${articleSection.slug}`}
            className="mt-3 inline-block text-sm font-bold"
            style={{ color: "var(--teal)" }}
          >
            כל המאמרים בנושא {articleSection.name} ←
          </Link>
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-[var(--line)]">
        <h2 className="text-base font-extrabold text-stone-800 mb-3">נושאים נוספים</h2>
        <div className="flex flex-wrap gap-2">
          {otherTopics.map((t) => (
            <Link key={t.slug} href={`/therapists/topic/${t.slug}`} className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
              style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>{t.name}</Link>
          ))}
          <Link href={`/therapists/region/${ONLINE_SLUG}`} className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
            style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>🌐 טיפול אונליין</Link>
          {SPECIALTY_LIST.slice(0, 8).map((s) => (
            <Link key={s} href={`/therapists/specialty/${specialtyToSlug(s)}`} className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
              style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>{s}</Link>
          ))}
        </div>
      </div>
    </main>
  );
}
