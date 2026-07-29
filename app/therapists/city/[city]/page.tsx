import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { loadPublicTherapists, countListed, cityIsIndexable } from "@/app/lib/therapist-directory";
import { genderTitle } from "@/app/lib/gender-text";
import { therapistPath } from "@/app/lib/therapist-url";
import { slugToCity, regionToSlug, CITY_SEO_LIST, CITY_TO_REGION, REGION_CITIES, ONLINE_SLUG, neighborsOf, CITY_INTRO } from "@/app/lib/regions";
import TherapistResultCard from "@/app/components/TherapistResultCard";
import PageViewTracker from "@/app/components/PageViewTracker";
import CitySeoSection from "@/app/therapists/CitySeoSection";
import { loadCityArticles } from "@/app/lib/local-articles";

const BASE = "https://www.mentalytics.co.il";

export const revalidate = 300;

export function generateStaticParams() {
  return CITY_SEO_LIST.map((c) => ({ city: regionToSlug(c) }));
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city: cityParam } = await params;
  const city = slugToCity(cityParam);
  if (!city) return { title: "עיר לא נמצאה" };
  const title = `פסיכולוגים ומטפלים ב${city} | טיפול חכם`;
  const description = `מצאו פסיכולוגים ומטפלים מאומתים ב${city} - מותאם אישית דרך טיפול חכם.`;
  const url = `${BASE}/therapists/city/${cityParam}`;
  // A city page earns indexing either on real in-city supply, or on a real
  // pool of therapists in ADJACENT cities (a 10-20 minute drive, per
  // CITY_NEIGHBORS). Below both bars it's near-empty and a near-duplicate of
  // the region page, so keep it out of the index until it fills up.
  const neighbors = neighborsOf(city);
  const [count, pool] = await Promise.all([
    countListed({ city }),
    neighbors.length ? countListed({ citiesAny: [city, ...neighbors] }) : Promise.resolve(0),
  ]);
  const robots = cityIsIndexable(city, count, pool) ? undefined : { index: false, follow: true };
  return { title, description, alternates: { canonical: url }, robots, openGraph: { title, description, url } };
}

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: cityParam } = await params;
  const city = slugToCity(cityParam);
  if (!city) notFound();

  const inCity = await loadPublicTherapists({ city });
  const region = CITY_TO_REGION[city] ?? null;
  const onlineCount = await countListed({ online: true });
  const { articles: localArticles, scope: articlesScope } = await loadCityArticles(city, region);

  // Adjacent cities first (a real 10-20 minute drive, named explicitly), and
  // only if that is still thin, the wider region. A resident of גני תקווה is
  // served by "קריית אונו, 7 דקות" far better than by "מטפלים נוספים בגוש דן".
  const neighbors = neighborsOf(city);
  const seen = new Set(inCity.map((t) => t.id));

  let nearbyCities: Awaited<ReturnType<typeof loadPublicTherapists>> = [];
  if (neighbors.length > 0 && inCity.length < 6) {
    nearbyCities = (await loadPublicTherapists({ citiesAny: neighbors })).filter((t) => !seen.has(t.id));
    for (const t of nearbyCities) seen.add(t.id);
  }
  // Which neighbours actually contributed - so the heading names real places.
  const nearbyCityNames = neighbors.filter((n) => nearbyCities.some((t) => t.regions.includes(n)));

  let nearbyRegion: Awaited<ReturnType<typeof loadPublicTherapists>> = [];
  if (region && inCity.length + nearbyCities.length < 6) {
    nearbyRegion = (await loadPublicTherapists({ region })).filter((t) => !seen.has(t.id));
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `פסיכולוגים ומטפלים ב${city}`,
    inLanguage: "he",
    url: `${BASE}/therapists/city/${cityParam}`,
    hasPart: inCity.slice(0, 50).map((t) => ({
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
      { "@type": "ListItem", position: 3, name: city, item: `${BASE}/therapists/city/${cityParam}` },
    ],
  };

  // Adjacent cities lead the internal-link row (most useful next click for a
  // resident), then the rest of the region.
  const otherCities = [
    ...neighbors,
    ...(region ? REGION_CITIES[region] ?? [] : []).filter((c) => !neighbors.includes(c)),
  ].filter((c) => c !== city && (CITY_SEO_LIST as readonly string[]).includes(c));

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />
      {/* Count paid-search / directory landings in the patient funnel, tagged with channel (google_paid etc.). */}
      <PageViewTracker page={`city:${city}`} source="city" />

      <Link href="/therapists" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← כל המטפלים</Link>

      <div className="mb-8">
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "8px" }}>לפי עיר</p>
        <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em" }}>פסיכולוגים ומטפלים ב{city}</h1>
        <p className="mt-3 text-stone-600 leading-8" style={{ maxWidth: "60ch" }}>
          {inCity.length > 0
            ? `מטפלים ופסיכולוגים מאומתים ב${city}`
            : `מטפלים ופסיכולוגים מאומתים בטווח נסיעה קצר מ${city}`}
          {nearbyCityNames.length > 0 ? ` ובערים הצמודות (${nearbyCityNames.slice(0, 3).join(", ")})` : region ? ` ובאזור ${region}` : ""}. אפשר גם למלא שאלון קצר ולקבל התאמה אישית, או לבחור טיפול אונליין.
        </p>
      </div>

      {/* Prominent quiz CTA - same offer as the region/online pages, tailored to the city. */}
      <div
        className="mb-10 flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7"
        style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }}
      >
        <div>
          <p style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--teal-dark)" }}>
            לא בטוחים מי מתאים לכם?
          </p>
          <p className="mt-1.5 leading-7 text-stone-600" style={{ maxWidth: "48ch" }}>
            {"ענו על שאלון קצר מבוסס מחקר שנבנה על ידי פסיכולוגים, נאתר את הצורך ואת אישיות המטפל, ונתאים לכם מטפל/ת באזורכם או באונליין."}
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

      {inCity.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-10">
          {inCity.map((t) => <TherapistResultCard key={t.id} t={t} backHref={`/therapists/city/${cityParam}`} contextCity={city} contextRegion={region ?? undefined} />)}
        </div>
      )}

      {nearbyCities.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-extrabold text-stone-800 mb-1">מטפלים בערים צמודות ל{city}</h2>
          <p className="text-sm text-stone-500 mb-4">
            {nearbyCityNames.length > 0
              ? `מטפלים ב${nearbyCityNames.join(", ")} - נסיעה קצרה מ${city}.`
              : `מטפלים בערים הסמוכות ל${city}.`}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nearbyCities.map((t) => <TherapistResultCard key={t.id} t={t} backHref={`/therapists/city/${cityParam}`} contextRegion={region ?? undefined} />)}
          </div>
        </div>
      )}

      {nearbyRegion.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-extrabold text-stone-800 mb-1">מטפלים נוספים באזור {region}</h2>
          <p className="text-sm text-stone-500 mb-4">פעילים באזור (לא ציינו את {city} ספציפית) - לרבים מהם נוחות גם לתושבי {city}.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nearbyRegion.map((t) => <TherapistResultCard key={t.id} t={t} backHref={`/therapists/city/${cityParam}`} contextRegion={region ?? undefined} />)}
          </div>
        </div>
      )}

      {inCity.length === 0 && nearbyCities.length === 0 && nearbyRegion.length === 0 && (
        <div className="rounded-2xl border border-[#E8E0D8] bg-[var(--surface)] p-6 text-stone-600">
          עדיין אין מטפלים מוצגים ב{city}. אפשר לעיין ב<Link href="/therapists" className="font-semibold text-[#2e7d8c] hover:underline">כל המטפלים</Link>, לבחור <Link href={`/therapists/region/${ONLINE_SLUG}`} className="font-semibold text-[#2e7d8c] hover:underline">טיפול אונליין</Link>, או למלא <Link href="/adults" className="font-semibold text-[#2e7d8c] hover:underline">שאלון התאמה</Link>.
        </div>
      )}

      {/* SEO content - below the listings (patients rarely scroll here; crawlers do) */}
      {CITY_INTRO[city] && (
        <section className="mt-14 pt-10 border-t border-[var(--line)]" style={{ maxWidth: "72ch" }}>
          <h2 className="text-xl font-extrabold mb-4" style={{ color: "var(--text)" }}>טיפול נפשי ב{city}</h2>
          <p className="text-[15px] leading-8 text-stone-600">{CITY_INTRO[city]}</p>
        </section>
      )}

      <CitySeoSection
        placeName={city}
        kind="city"
        therapists={inCity}
        nearby={nearbyCities}
        nearbyPlaces={nearbyCityNames}
        onlineCount={onlineCount}
        regionName={region}
        articles={localArticles}
        articlesScope={articlesScope === "region" ? "region" : "place"}
      />

      {/* Internal linking */}
      <div className="mt-12 pt-8 border-t border-[var(--line)]">
        <div className="flex flex-wrap gap-2">
          {region && (
            <Link href={`/therapists/region/${regionToSlug(region)}`} className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
              style={{ border: "1px solid var(--teal-mid)", color: "var(--teal-dark)", background: "var(--teal-pale)" }}>כל אזור {region} ←</Link>
          )}
          {otherCities.map((c) => (
            <Link key={c} href={`/therapists/city/${regionToSlug(c)}`} className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
              style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>{c}</Link>
          ))}
        </div>
      </div>
    </main>
  );
}
