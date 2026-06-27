import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { loadPublicTherapists } from "@/app/lib/therapist-directory";
import { slugToRegion, regionToSlug, ONLINE_SLUG, ALL_REGIONS } from "@/app/lib/regions";
import { genderTitle } from "@/app/lib/gender-text";

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
  const title = isOnline
    ? "מטפלים ופסיכולוגים לטיפול אונליין | טיפול חכם"
    : `פסיכולוגים ומטפלים ב${label} | טיפול חכם`;
  const description = isOnline
    ? "רשימת מטפלים ופסיכולוגים המציעים טיפול אונליין — מותאמת אישית דרך טיפול חכם."
    : `מצאו פסיכולוגים ומטפלים מאומתים ב${label} — מותאם אישית דרך טיפול חכם.`;
  const url = `${BASE}/therapists/region/${regionParam}`;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url } };
}

function TherapistCard({ t }: { t: Awaited<ReturnType<typeof loadPublicTherapists>>[number] }) {
  const type = t.therapist_types[0] ? genderTitle(t.therapist_types[0], t.gender) : "";
  const avatar = t.gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg";
  const bioSnippet = t.bio ? t.bio.split(/[.\n]/)[0].trim() : "";
  return (
    <Link href={`/therapists/${t.id}`} className="group block rounded-2xl bg-white overflow-hidden transition hover:shadow-lg hover:-translate-y-0.5"
      style={{ border: "1px solid var(--line)", boxShadow: "0 2px 10px rgba(61,140,138,.06)", textDecoration: "none" }}>
      <div style={{ height: "260px", overflow: "hidden", background: "var(--surface)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={t.profile_photo_url ?? avatar} alt={t.full_name}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }} loading="lazy" />
      </div>
      <div style={{ padding: "16px 18px" }}>
        <h2 className="text-lg font-black text-stone-900 leading-tight group-hover:underline">{t.full_name}</h2>
        {type && <div className="mt-1 text-sm font-semibold" style={{ color: "var(--teal)" }}>{type}</div>}
        {bioSnippet && <p className="mt-2 text-sm text-stone-600 leading-relaxed line-clamp-2">{bioSnippet}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {t.online && (
            <span className="rounded-full px-3 py-1 text-[13px] font-semibold" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)", color: "var(--teal-dark)" }}>🌐 אונליין</span>
          )}
          {t.regions[0] && (
            <span className="rounded-full px-3 py-1 text-[13px] font-semibold" style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text-2)" }}>📍 {t.regions[0]}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default async function RegionPage({ params }: { params: Promise<{ region: string }> }) {
  const { region: regionParam } = await params;
  const r = resolve(regionParam);
  if (!r) notFound();

  const isOnline = r.kind === "online";
  const list = await loadPublicTherapists(isOnline ? { online: true } : { region: r.region });
  const label = isOnline ? "טיפול אונליין" : r.region;
  const heading = isOnline ? "מטפלים ופסיכולוגים לטיפול אונליין" : `פסיכולוגים ומטפלים ב${label}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: heading,
    inLanguage: "he",
    url: `${BASE}/therapists/region/${regionParam}`,
    hasPart: list.slice(0, 50).map((t) => ({
      "@type": "Person",
      name: t.full_name,
      jobTitle: t.therapist_types[0] ? genderTitle(t.therapist_types[0], t.gender) : undefined,
      url: `${BASE}/therapists/${t.id}`,
    })),
  };

  // Other regions for internal linking.
  const otherRegions = ALL_REGIONS.filter((reg) => !(r.kind === "region" && reg === r.region));

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <Link href="/therapists" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← כל המטפלים</Link>

      <div className="mb-8">
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "8px" }}>
          {isOnline ? "טיפול מרחוק" : "לפי אזור"}
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em" }}>{heading}</h1>
        <p className="mt-3 text-stone-600 leading-8" style={{ maxWidth: "60ch" }}>
          {isOnline
            ? "כל המטפלים והפסיכולוגים שמציעים טיפול אונליין דרך טיפול חכם. אפשר גם למלא שאלון קצר ולקבל התאמה אישית."
            : `כל המטפלים והפסיכולוגים המאומתים ב${label} דרך טיפול חכם. אפשר גם למלא שאלון קצר ולקבל התאמה אישית לפי הצורך, הגישה והאזור.`}
        </p>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-[#E8E0D8] bg-[var(--surface)] p-6 text-stone-600">
          עדיין אין מטפלים מוצגים {isOnline ? "לטיפול אונליין" : `ב${label}`}. אפשר לעיין ב<Link href="/therapists" className="font-semibold text-[#2e7d8c] hover:underline">כל המטפלים</Link> או למלא <Link href="/adults" className="font-semibold text-[#2e7d8c] hover:underline">שאלון התאמה</Link>.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => <TherapistCard key={t.id} t={t} />)}
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
    </main>
  );
}
