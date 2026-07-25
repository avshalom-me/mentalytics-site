import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { loadPublicTherapists, countListed } from "@/app/lib/therapist-directory";
import { therapistPath } from "@/app/lib/therapist-url";
import { genderTitle } from "@/app/lib/gender-text";
import { slugToCity } from "@/app/lib/regions";
import { regionToSlug } from "@/app/lib/regions";
import { slugToCityTopic, isCityTopicAllowed, PILOT_CITIES, MIN_CITY_TOPIC, TOPICS } from "@/app/lib/topics";
import TherapistResultCard from "@/app/components/TherapistResultCard";
import PageViewTracker from "@/app/components/PageViewTracker";

// City×topic PILOT (docs/seo-roadmap.md M4): "טיפול בחרדה בתל אביב",
// "CBT בירושלים". Deliberately narrow — 3 pilot cities, allow-listed topics,
// indexable only at ≥MIN_CITY_TOPIC listed therapists — everything below that
// is noindex, and non-pilot combinations simply 404. This is the anti-doorway
// discipline: pages exist only where real supply exists.

const BASE = "https://www.mentalytics.co.il";

export const revalidate = 300;

function inPhrase(city: string): string {
  return `ב${city}`;
}

async function resolve(params: Promise<{ city: string; topic: string }>) {
  const { city: citySlug, topic: topicSlug } = await params;
  const city = slugToCity(citySlug);
  const topic = slugToCityTopic(topicSlug);
  if (!city || !topic) return null;
  if (!(PILOT_CITIES as readonly string[]).includes(city)) return null;
  if (!isCityTopicAllowed(topic)) return null;
  return { city, topic, citySlug };
}

export async function generateMetadata({ params }: { params: Promise<{ city: string; topic: string }> }): Promise<Metadata> {
  const r = await resolve(params);
  if (!r) return { title: "עמוד לא נמצא" };
  const { city, topic } = r;
  const title = `${topic.name} ${inPhrase(city)} — מטפלים מאומתים`;
  const description = `${topic.name} ${inPhrase(city)}: מטפלים מאומתים עם הכשרה מתאימה, כולל אפשרות לפגישות אונליין. השוו, בחרו ופנו ישירות.`;
  const url = `${BASE}/therapists/city/${regionToSlug(city)}/${topic.slug}`;
  const count = await countListed({ ...topic.filter, city });
  const robots = count < MIN_CITY_TOPIC ? { index: false as const, follow: true } : undefined;
  return { title, description, alternates: { canonical: url }, robots, openGraph: { title, description, url } };
}

export default async function CityTopicPage({ params }: { params: Promise<{ city: string; topic: string }> }) {
  const r = await resolve(params);
  if (!r) notFound();
  const { city, topic } = r;

  const list = await loadPublicTherapists({ ...topic.filter, city });
  const onlineHere = list.filter((t) => t.online).length;
  const heading = `${topic.name} ${inPhrase(city)}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: heading,
    inLanguage: "he",
    url: `${BASE}/therapists/city/${regionToSlug(city)}/${topic.slug}`,
    hasPart: list.slice(0, 50).map((t) => ({
      "@type": "Person",
      name: t.full_name,
      jobTitle: t.therapist_types[0] ? genderTitle(t.therapist_types[0], t.gender) : undefined,
      url: `${BASE}${therapistPath(t.id, t.full_name)}`,
    })),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "בית", item: BASE },
      { "@type": "ListItem", position: 2, name: "המטפלים שלנו", item: `${BASE}/therapists` },
      { "@type": "ListItem", position: 3, name: city, item: `${BASE}/therapists/city/${regionToSlug(city)}` },
      { "@type": "ListItem", position: 4, name: topic.name, item: `${BASE}/therapists/city/${regionToSlug(city)}/${topic.slug}` },
    ],
  };

  // Sister pages for internal linking: same topic in the other pilot cities
  // (only when THEY are indexable too), and the parent pages.
  const sisterCities: string[] = [];
  for (const c of PILOT_CITIES) {
    if (c === city) continue;
    const n = await countListed({ ...topic.filter, city: c });
    if (n >= MIN_CITY_TOPIC) sisterCities.push(c);
  }
  const isNamedTopic = TOPICS.some((t) => t.slug === topic.slug);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />
      <PageViewTracker page={`city_topic:${city}:${topic.slug}`} source="city_topic" />

      <Link href={`/therapists/city/${regionToSlug(city)}`} className="text-sm text-stone-500 hover:underline mb-6 inline-block">← כל המטפלים {inPhrase(city)}</Link>

      <div className="mb-8">
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "8px" }}>לפי עיר ותחום</p>
        <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em" }}>{heading}</h1>
        {topic.intro && <p className="mt-3 text-stone-600 leading-8" style={{ maxWidth: "68ch" }}>{topic.intro}</p>}
        <p className="mt-2 text-sm text-stone-500">
          {topic.supplyNote}, הפועלים {inPhrase(city)} — {list.length} מטפלים{onlineHere > 0 ? `, ${onlineHere} מהם זמינים גם אונליין` : ""}.
        </p>
      </div>

      {/* Quiz CTA */}
      <div
        className="mb-10 flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7"
        style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }}
      >
        <div>
          <p style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--teal-dark)" }}>רוצים התאמה מדויקת יותר?</p>
          <p className="mt-1.5 leading-7 text-stone-600" style={{ maxWidth: "48ch" }}>
            {"ענו על שאלון קצר מבוסס מחקר — נזהה את הצורך, נמליץ על סוג הטיפול, ונתאים לכם מטפל/ת באזורכם או אונליין."}
          </p>
        </div>
        <Link
          href="/adults"
          className="shrink-0 inline-flex items-center justify-center whitespace-nowrap font-bold transition hover:opacity-95"
          style={{ background: "var(--teal)", color: "#fff", borderRadius: "50px", padding: "13px 30px", fontSize: "15px" }}
        >
          למילוי השאלון
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-[#E8E0D8] bg-[var(--surface)] p-6 text-stone-600">
          כרגע אין מטפלים מוצגים בשילוב הזה. אפשר לראות את <Link href={`/therapists/city/${regionToSlug(city)}`} className="font-semibold text-[#2e7d8c] hover:underline">כל המטפלים {inPhrase(city)}</Link> או <Link href="/therapists/region/אונליין" className="font-semibold text-[#2e7d8c] hover:underline">מטפלים אונליין</Link>.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => (
            <TherapistResultCard key={t.id} t={t} backHref={`/therapists/city/${regionToSlug(city)}/${topic.slug}`} contextCity={city} />
          ))}
        </div>
      )}

      <div className="mt-12 pt-8 border-t border-[var(--line)]">
        <h2 className="text-base font-extrabold text-stone-800 mb-3">המשך עיון</h2>
        <div className="flex flex-wrap gap-2">
          {isNamedTopic && (
            <Link href={`/therapists/topic/${topic.slug}`} className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
              style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>{topic.name} — בכל הארץ</Link>
          )}
          <Link href={`/therapists/city/${regionToSlug(city)}`} className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
            style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>כל המטפלים {inPhrase(city)}</Link>
          {sisterCities.map((c) => (
            <Link key={c} href={`/therapists/city/${regionToSlug(c)}/${topic.slug}`} className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
              style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>{topic.name} {inPhrase(c)}</Link>
          ))}
          <Link href="/therapists/region/אונליין" className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
            style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>🌐 טיפול אונליין</Link>
        </div>
      </div>
    </main>
  );
}
