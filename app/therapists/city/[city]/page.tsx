import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { loadPublicTherapists, countListed, MIN_LISTED_FOR_INDEX } from "@/app/lib/therapist-directory";
import { genderTitle } from "@/app/lib/gender-text";
import { therapistPath } from "@/app/lib/therapist-url";
import { slugToCity, regionToSlug, CITY_SEO_LIST, CITY_TO_REGION, REGION_CITIES, ONLINE_SLUG } from "@/app/lib/regions";
import TherapistResultCard from "@/app/components/TherapistResultCard";

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
  const description = `מצאו פסיכולוגים ומטפלים מאומתים ב${city} — מותאם אישית דרך טיפול חכם.`;
  const url = `${BASE}/therapists/city/${cityParam}`;
  // A city page is unique/valuable only once it has real in-city therapists;
  // below the threshold it's near-empty (and near-duplicate of the region page),
  // so keep it out of the index until it fills up.
  const count = await countListed({ city });
  const robots = count < MIN_LISTED_FOR_INDEX ? { index: false, follow: true } : undefined;
  return { title, description, alternates: { canonical: url }, robots, openGraph: { title, description, url } };
}

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: cityParam } = await params;
  const city = slugToCity(cityParam);
  if (!city) notFound();

  const inCity = await loadPublicTherapists({ city });
  const region = CITY_TO_REGION[city] ?? null;

  // Region fallback so a thin/empty city page still offers nearby options.
  let nearby: Awaited<ReturnType<typeof loadPublicTherapists>> = [];
  if (region && inCity.length < 6) {
    const regionList = await loadPublicTherapists({ region });
    const ids = new Set(inCity.map((t) => t.id));
    nearby = regionList.filter((t) => !ids.has(t.id));
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

  const otherCities = (region ? REGION_CITIES[region] ?? [] : [])
    .filter((c) => c !== city && (CITY_SEO_LIST as readonly string[]).includes(c));

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <Link href="/therapists" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← כל המטפלים</Link>

      <div className="mb-8">
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "8px" }}>לפי עיר</p>
        <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em" }}>פסיכולוגים ומטפלים ב{city}</h1>
        <p className="mt-3 text-stone-600 leading-8" style={{ maxWidth: "60ch" }}>
          מטפלים ופסיכולוגים מאומתים ב{city}{region ? ` ובאזור ${region}` : ""}. אפשר גם למלא שאלון קצר ולקבל התאמה אישית, או לבחור טיפול אונליין.
        </p>
      </div>

      {inCity.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-10">
          {inCity.map((t) => <TherapistResultCard key={t.id} t={t} />)}
        </div>
      )}

      {nearby.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-extrabold text-stone-800 mb-1">מטפלים נוספים באזור {region}</h2>
          <p className="text-sm text-stone-500 mb-4">פעילים באזור (לא ציינו את {city} ספציפית) — לרבים מהם נוחות גם לתושבי {city}.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nearby.map((t) => <TherapistResultCard key={t.id} t={t} />)}
          </div>
        </div>
      )}

      {inCity.length === 0 && nearby.length === 0 && (
        <div className="rounded-2xl border border-[#E8E0D8] bg-[var(--surface)] p-6 text-stone-600">
          עדיין אין מטפלים מוצגים ב{city}. אפשר לעיין ב<Link href="/therapists" className="font-semibold text-[#2e7d8c] hover:underline">כל המטפלים</Link>, לבחור <Link href={`/therapists/region/${ONLINE_SLUG}`} className="font-semibold text-[#2e7d8c] hover:underline">טיפול אונליין</Link>, או למלא <Link href="/adults" className="font-semibold text-[#2e7d8c] hover:underline">שאלון התאמה</Link>.
        </div>
      )}

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
