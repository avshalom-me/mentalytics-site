import { notFound } from "next/navigation";
import { listingItemSchema } from "@/app/lib/listing-schema";
import Link from "next/link";
import type { Metadata } from "next";
import { loadPublicTherapists, countListed, MIN_LISTED_FOR_INDEX } from "@/app/lib/therapist-directory";
import { slugToRegion, regionToSlug, ONLINE_SLUG, ALL_REGIONS, REGION_CITIES, CITY_SEO_LIST, REGION_INTRO } from "@/app/lib/regions";
import { SPECIALTY_LIST, specialtyToSlug } from "@/app/lib/specialties";
import { onlineTopicSlugs, slugToCityTopic, MIN_ONLINE_TOPIC } from "@/app/lib/topics";
import OnlineEvidenceSection from "@/app/therapists/OnlineEvidenceSection";
import TherapistResultCard from "@/app/components/TherapistResultCard";
import PageViewTracker from "@/app/components/PageViewTracker";
import CitySeoSection from "@/app/therapists/CitySeoSection";
import QuizCta from "@/app/therapists/QuizCta";
import { loadLocalArticles } from "@/app/lib/local-articles";
import { CREDENTIALS, QUIZ } from "@/app/lib/meta-description";

const BASE = "https://www.mentalytics.co.il";

// Regenerate every 5 minutes so newly-approved therapists appear, while staying
// static + fast for crawlers.
export const revalidate = 300;

export function generateStaticParams() {
  return [
    ...ALL_REGIONS.map((r) => ({ region: regionToSlug(r) })),
    { region: ONLINE_SLUG },
  ];
}

type Resolved = { kind: "online" } | { kind: "region"; region: string } | null;
function resolve(regionParam: string): Resolved {
  let decoded: string;
  try {
    decoded = decodeURIComponent(regionParam);
  } catch {
    return null; // malformed encoding → 404 instead of a 500
  }
  if (decoded === ONLINE_SLUG) return { kind: "online" };
  const region = slugToRegion(regionParam);
  return region ? { kind: "region", region } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ region: string }> }): Promise<Metadata> {
  const { region: regionParam } = await params;
  const r = resolve(regionParam);
  if (!r) return { title: "אזור לא נמצא" };
  const isOnline = r.kind === "online";
  const label = isOnline ? "טיפול אונליין" : r.region;
  // The head phrase of the whole cluster ("טיפול פסיכולוגי אונליין") belongs in
  // the title - a 3-model SERP panel (5/8/26) found every ranking competitor
  // carries it, and we carried neither it nor "פסיכולוג אונליין" anywhere.
  const title = isOnline
    ? "טיפול פסיכולוגי אונליין: מטפלים ופסיכולוגים מאומתים | טיפול חכם"
    : // Same reasoning as the city pages (6/8/26): the treatment phrase is a
      // query family of its own and every competitor ranking for it carries it
      // in the title; the person-phrase prefix stays for the rankings we have.
      `פסיכולוגים ומטפלים ב${label} - טיפול פסיכולוגי | טיפול חכם`;
  const url = `${BASE}/therapists/region/${regionParam}`;
  // Keep near-empty region pages out of the index until they have real content,
  // so Google doesn't flag them as thin / near-duplicate. The online page is a
  // distinct, always-valuable page and is never gated.
  const regionCount = isOnline ? 0 : await countListed({ region: r.region });
  const robots =
    !isOnline && regionCount < MIN_LISTED_FOR_INDEX ? { index: false as const, follow: true } : undefined;
  // Count-free, like the city pages (owner's call, 14/8/26).
  const description = isOnline
    ? `פסיכולוג אונליין או מטפל רגשי מרחוק: ${CREDENTIALS} שמטפלים בזום או בווידאו, ו${QUIZ}.`
    : `טיפול פסיכולוגי ונפשי ב${label}: ${CREDENTIALS}, ו${QUIZ}. בחינם וללא התחייבות.`;
  return { title, description, alternates: { canonical: url }, robots, openGraph: { title, description, url } };
}


export default async function RegionPage({ params }: { params: Promise<{ region: string }> }) {
  const { region: regionParam } = await params;
  const r = resolve(regionParam);
  if (!r) notFound();

  const isOnline = r.kind === "online";
  const list = await loadPublicTherapists(isOnline ? { online: true } : { region: r.region });
  const onlineCount = isOnline ? list.length : await countListed({ online: true });
  const localArticles = await loadLocalArticles(isOnline ? { online: true } : { region: r.region });
  const label = isOnline ? "טיפול אונליין" : r.region;
  const heading = isOnline
    ? "טיפול פסיכולוגי אונליין: מטפלים ופסיכולוגים מאומתים"
    : `פסיכולוגים ומטפלים ב${label}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: heading,
    inLanguage: "he",
    url: `${BASE}/therapists/region/${regionParam}`,
    hasPart: list.slice(0, 50).map(listingItemSchema),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "בית", item: BASE },
      { "@type": "ListItem", position: 2, name: "המטפלים שלנו", item: `${BASE}/therapists` },
      { "@type": "ListItem", position: 3, name: label, item: `${BASE}/therapists/region/${regionParam}` },
    ],
  };

  // Online×topic children (online hub only) - the crawl path into the phase-3
  // pages, gated exactly like their own indexability so we never link a
  // noindex child from here.
  const onlineTopics: { slug: string; name: string }[] = [];
  if (isOnline) {
    for (const slug of onlineTopicSlugs()) {
      const t = slugToCityTopic(slug);
      if (!t || t.adsOnly) continue;
      const n = await countListed({ ...t.filter, online: true });
      if (n >= MIN_ONLINE_TOPIC) onlineTopics.push({ slug: t.slug, name: t.name });
    }
  }

  // Other regions for internal linking.
  const otherRegions = ALL_REGIONS.filter((reg) => !(r.kind === "region" && reg === r.region));
  const regionCities = r.kind === "region"
    ? (REGION_CITIES[r.region] ?? []).filter((c) => (CITY_SEO_LIST as readonly string[]).includes(c))
    : [];

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />
      {/* Count paid-search / directory landings in the patient funnel, tagged with channel (google_paid etc.). */}
      <PageViewTracker page={isOnline ? "region:online" : `region:${r.region}`} source={isOnline ? "online" : "region"} />

      <Link href="/therapists" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← כל המטפלים</Link>

      <div className="mb-8">
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "8px" }}>
          {isOnline ? "טיפול מרחוק" : "לפי אזור"}
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em" }}>{heading}</h1>
        <p className="mt-3 text-stone-600 leading-8" style={{ maxWidth: "60ch" }}>
          {isOnline ? (
            <>
              כל הפסיכולוגים והמטפלים שמציעים טיפול נפשי אונליין דרך טיפול חכם - בזום או בשיחת וידאו,
              מכל מקום בארץ או בחו"ל. מתלבטים אם טיפול מרחוק בכלל מתאים לכם?{" "}
              <Link href="/research/online-therapy" className="font-semibold hover:underline" style={{ color: "var(--teal-dark)" }}>
                כתבנו על מה שהמחקר אומר ולמי זה מתאים
              </Link>
              , ואפשר גם למלא שאלון קצר ולקבל התאמה אישית.
            </>
          ) : (
            `רשימת מטפלים לטיפול פסיכולוגי ונפשי ב${label}: כל הפסיכולוגים והמטפלים המאומתים דרך טיפול חכם, להשוואה ולפנייה ישירה. אפשר גם למלא שאלון קצר ולקבל התאמה אישית - בחינם וללא התחייבות.`
          )}
        </p>
      </div>

      {/* Prominent quiz CTA - offer the matching quiz as an alternative to
          browsing. Both audiences land on a region page, so it offers both
          questionnaires rather than assuming everyone is looking for themselves. */}
      <QuizCta
        body={isOnline
          ? "ענו על שאלון קצר מבוסס מחקר שנבנה על ידי פסיכולוגים, נאתר את הצורך ואת אישיות המטפל, ונתאים לכם מטפל/ת אונליין."
          : "ענו על שאלון קצר מבוסס מחקר שנבנה על ידי פסיכולוגים, נאתר את הצורך ואת אישיות המטפל, ונתאים לכם מטפל/ת באזורכם או באונליין."}
      />

      {list.length === 0 ? (
        <div className="rounded-2xl border border-[#E8E0D8] bg-[var(--surface)] p-6 text-stone-600">
          עדיין אין מטפלים מוצגים {isOnline ? "לטיפול אונליין" : `ב${label}`}. אפשר לעיין ב<Link href="/therapists" className="font-semibold text-[#2e7d8c] hover:underline">כל המטפלים</Link> או למלא <Link href="/adults" className="font-semibold text-[#2e7d8c] hover:underline">שאלון התאמה</Link>.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => <TherapistResultCard key={t.id} t={t} backHref={`/therapists/region/${regionParam}`} contextRegion={isOnline ? undefined : r.region} />)}
        </div>
      )}

      {/* Online×topic children - "טיפול בחרדה אונליין" etc. */}
      {onlineTopics.length > 0 && (
        <div className="mt-12 pt-8 border-t border-[var(--line)]">
          <h2 className="text-base font-extrabold text-stone-800 mb-3">טיפול אונליין לפי נושא</h2>
          <div className="flex flex-wrap gap-2">
            {onlineTopics.map((t) => (
              <Link
                key={t.slug}
                href={`/therapists/online/${t.slug}`}
                className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
                style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}
              >
                {t.name} אונליין
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* SEO content - below the listings (patients rarely scroll here; crawlers do) */}
      {!isOnline && REGION_INTRO[r.region] && (
        <section className="mt-14 pt-10 border-t border-[var(--line)]" style={{ maxWidth: "72ch" }}>
          <h2 className="text-xl font-extrabold mb-4" style={{ color: "var(--text)" }}>על אזור {r.region}</h2>
          <p className="text-[15px] leading-8 text-stone-600">{REGION_INTRO[r.region]}</p>
        </section>
      )}

      <CitySeoSection
        placeName={isOnline ? "אונליין" : `אזור ${r.kind === "region" ? r.region : ""}`}
        kind={isOnline ? "online" : "region"}
        therapists={list}
        regionName={isOnline ? null : r.region}
        articles={localArticles}
      />

      {/* Cities within this region (internal linking → city pages) */}
      {regionCities.length > 0 && (
        <div className="mt-12 pt-8 border-t border-[var(--line)]">
          <h2 className="text-base font-extrabold text-stone-800 mb-3">ערים ב{label}</h2>
          <div className="flex flex-wrap gap-2">
            {regionCities.map((city) => (
              <Link key={city} href={`/therapists/city/${regionToSlug(city)}`} className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
                style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>{city}</Link>
            ))}
          </div>
        </div>
      )}

      {/* Internal linking to other regions + online */}
      <div className="mt-12 pt-8 border-t border-[var(--line)]">
        <h2 className="text-base font-extrabold text-stone-800 mb-3">אזורים נוספים</h2>
        <div className="flex flex-wrap gap-2">
          {!isOnline && (
            <Link href={`/therapists/region/${ONLINE_SLUG}`} className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
              style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>🌐 טיפול אונליין</Link>
          )}
          {otherRegions.map((reg) => (
            <Link key={reg} href={`/therapists/region/${regionToSlug(reg)}`} className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
              style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>{reg}</Link>
          ))}
        </div>
      </div>

      {/* Specialty landing pages (internal linking / crawl discovery) */}
      <div className="mt-8 pt-6 border-t border-[var(--line)]">
        <h2 className="text-base font-extrabold text-stone-800 mb-3">לפי התמחות</h2>
        <div className="flex flex-wrap gap-2">
          {SPECIALTY_LIST.slice(0, 12).map((s) => (
            <Link key={s} href={`/therapists/specialty/${specialtyToSlug(s)}`} className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
              style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>{s}</Link>
          ))}
        </div>
      </div>

      {/* Evidence block - online page only, at the foot: the listing and the
          quiz serve someone ready to act; this serves the reader still
          deciding, and is what gives the page unique indexable prose. */}
      {isOnline && <OnlineEvidenceSection />}
    </main>
  );
}
