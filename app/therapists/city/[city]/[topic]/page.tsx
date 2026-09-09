import { notFound } from "next/navigation";
import { listingItemSchema } from "@/app/lib/listing-schema";
import Link from "next/link";
import type { Metadata } from "next";
import { loadPublicTherapists, countListed, loadListedCounts } from "@/app/lib/therapist-directory";
import { slugToCity } from "@/app/lib/regions";
import { regionToSlug, neighborsOf } from "@/app/lib/regions";
import TopicFaq from "@/app/therapists/TopicFaq";
import { slugToCityTopic, isCityTopicAllowed, isYouthTopic, cityTopicCitiesFor, MIN_CITY_TOPIC, TOPICS } from "@/app/lib/topics";
import QuizCta from "@/app/therapists/QuizCta";
import TherapistResultCard from "@/app/components/TherapistResultCard";
import PageViewTracker from "@/app/components/PageViewTracker";
import { CREDENTIALS, QUIZ } from "@/app/lib/meta-description";
import { cityFact } from "@/app/lib/city-facts";
import { genderTitle } from "@/app/lib/gender-text";

// City×topic (docs/seo-roadmap.md M4): "טיפול בחרדה בתל אביב", "CBT בירושלים".
// Allow-listed topics, cities per cityTopicCitiesFor(), indexable only at
// ≥MIN_CITY_TOPIC listed therapists - everything below that is noindex, and
// combinations outside the allowed cities simply 404. This is the anti-doorway
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
  if (!isCityTopicAllowed(topic)) return null;
  if (!cityTopicCitiesFor(topic).includes(city)) return null;
  return { city, topic, citySlug };
}

export async function generateMetadata({ params }: { params: Promise<{ city: string; topic: string }> }): Promise<Metadata> {
  const r = await resolve(params);
  if (!r) return { title: "עמוד לא נמצא" };
  const { city, topic } = r;
  const title = `${topic.name} ${inPhrase(city)} - ${topic.cityTitleTail ?? "מטפלים מאומתים"} | טיפול חכם`;
  const url = `${BASE}/therapists/city/${regionToSlug(city)}/${topic.slug}`;
  const count = await countListed({ ...topic.filter, city });
  // Same shape as the city pages, and count-free for the same reason.
  const description = `${topic.name} ${inPhrase(city)}: ${CREDENTIALS} ובעלי הכשרה בתחום, ו${QUIZ}.`;
  const robots =
    topic.adsOnly || count < MIN_CITY_TOPIC ? { index: false as const, follow: true } : undefined;
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
    hasPart: list.slice(0, 50).map(listingItemSchema),
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

  // Sister pages for internal linking: same topic in the other allowed cities
  // (only when THEY are indexable too), nearest first, capped. One in-memory
  // count set: the audience list is every city with a page, not three.
  const counts = await loadListedCounts();
  const eligible = cityTopicCitiesFor(topic).filter(
    (c) => c !== city && counts.count({ ...topic.filter, city: c }) >= MIN_CITY_TOPIC
  );
  const near = neighborsOf(city).filter((c) => eligible.includes(c));
  const sisterCities = [...near, ...eligible.filter((c) => !near.includes(c))].slice(0, 8);

  // What makes THIS city's page differ from the next one, derived from its own
  // listing and count-free (owner's rule): which professions are actually
  // here, which ages they cover, whether video is an option, and where else
  // nearby a parent could look. Audience pages only.
  // A women-only page inflects: "מוצגות פסיכולוגית קלינית" would be broken
  // Hebrew, so the professions run through the canonical feminine map rather
  // than being printed as the database stores them (masculine canonical form).
  const fem = topic.kind === "gender";
  const cityNote = (() => {
    if ((topic.kind !== "audience" && topic.kind !== "gender") || list.length === 0) return null;
    const freq = new Map<string, number>();
    for (const t of list) for (const p of t.therapist_types ?? []) freq.set(p, (freq.get(p) ?? 0) + 1);
    const professions = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([p]) => (fem ? genderTitle(p, "נקבה") : p));
    const ages = ["גיל הרך", "ילדים", "נוער"].filter((a) => list.some((t) => (t.age_groups ?? []).includes(a)));
    const parts: string[] = [];
    if (professions.length) parts.push(`${inPhrase(city)} מוצג${fem ? "ות" : "ים"} ${professions.join(", ")}`);
    if (ages.length) parts.push(`שמטפל${fem ? "ות" : "ים"} ב${ages.join(", ")}`);
    let s = parts.join(" ");
    if (onlineHere > 0) s += fem ? ", וחלקן זמינות גם בשיחת וידאו" : ", וחלקם זמינים גם בשיחת וידאו";
    s += ".";
    if (near.length) s += ` מטפל${fem ? "ות" : "ים"} בתחום יש גם ${near.slice(0, 3).map(inPhrase).join(", ")}.`;
    return s;
  })();
  // One verified sentence about THIS city's public service for children
  // (its שפ"ח, or the closest official equivalent), with the source linked.
  // Audience pages only, and only for cities that were checked - see
  // city-facts.ts for the rules. Rendered inside the same paragraph as the
  // data-derived note so the page gains a sentence, not a section.
  const fact = topic.kind === "audience" ? cityFact(city) : null;
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
        {/* The first paragraph is what Google quotes when it skips the meta
            description. It used to be the thin supply line below, so the snippet
            read "מוצגים מטפלים..." and then ran into the card grid. Same sentence
            shape as the city pages, which is the one that produced the snippet
            we wanted ("מלאו שאלון מקצועי..."). */}
        <p className="mt-3 text-stone-600 leading-8" style={{ maxWidth: "60ch" }}>
          {fem
            ? `${topic.name} ${inPhrase(city)}: מלאו שאלון מקצועי שפותח על ידי פסיכולוגים קליניים ומצאו את ההתאמה הנכונה עבורכם, או עברו על רשימת המטפלות ${inPhrase(city)} שתעודות ההכשרה שלהן אומתו ובעלות הכשרה בתחום ופנו ישירות${onlineHere > 0 ? " (חלקן זמינות גם אונליין)" : ""}. בחינם וללא התחייבות.`
            : `${topic.name} ${inPhrase(city)}: מלאו שאלון מקצועי שפותח על ידי פסיכולוגים קליניים ומצאו את ההתאמה הנכונה עבורכם, או עברו על רשימת המטפלים ${inPhrase(city)} שתעודות ההכשרה שלהם אומתו ובעלי הכשרה בתחום ופנו ישירות${onlineHere > 0 ? " (חלקם זמינים גם אונליין)" : ""}. בחינם וללא התחייבות.`}
        </p>
        <p className="mt-2 text-sm text-stone-500">{topic.supplyNote}.</p>
      </div>

      {/* Quiz CTA. A children/teens topic sends parents to the kids
          questionnaire - the page's own headline promises a therapist for a
          child, and /adults asks the visitor about themselves instead. */}
      <QuizCta
        audience={isYouthTopic(topic) ? "youth" : "both"}
        body={isYouthTopic(topic)
          ? `ענו על שאלון קצר מבוסס מחקר - נזהה מה הילד/ה עובר/ת, נמליץ על סוג הטיפול, ונתאים מטפל/ת ב${city} או אונליין.`
          : `ענו על שאלון קצר מבוסס מחקר - נזהה את הצורך, נמליץ על סוג הטיפול, ונתאים לכם מטפל/ת ב${city} או אונליין.`}
      />

      {(cityNote || fact) && (
        <p className="mb-8 text-[15px] leading-8 text-stone-600" style={{ maxWidth: "72ch" }}>
          {cityNote}
          {cityNote && fact ? " " : null}
          {fact && (
            <>
              {fact.text}
              {" (מקור: "}
              <a href={fact.url} target="_blank" rel="noopener" className="font-semibold text-[#2e7d8c] hover:underline">{fact.source}</a>
              {")."}
            </>
          )}
        </p>
      )}
      <TopicFaq
        topic={topic}
        title={`${topic.name} ${inPhrase(city)} - ${topic.kind === "audience" ? "שאלות של הורים" : "שאלות נפוצות"}`}
      />

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

      {/* Prose below the listings (see the topic page for the rationale). */}
      {topic.intro && (
        <section className="mt-14 pt-10 border-t border-[var(--line)]" style={{ maxWidth: "72ch" }}>
          <h2 className="text-xl font-extrabold mb-4" style={{ color: "var(--text)" }}>
            על {topic.name} - מה חשוב לדעת
          </h2>
          <p className="text-[15px] leading-8 text-stone-600">{topic.intro}</p>
        </section>
      )}

      <div className="mt-8 pt-6 border-t border-[var(--line)]">
        <h2 className="text-base font-extrabold text-stone-800 mb-3">המשך עיון</h2>
        <div className="flex flex-wrap gap-2">
          {isNamedTopic && (
            <Link href={`/therapists/topic/${topic.slug}`} className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
              style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>{topic.name} - בכל הארץ</Link>
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
