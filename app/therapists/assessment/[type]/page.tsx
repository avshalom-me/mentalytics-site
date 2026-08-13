import { notFound } from "next/navigation";
import { listingItemSchema } from "@/app/lib/listing-schema";
import Link from "next/link";
import type { Metadata } from "next";
import { loadPublicTherapists, countListed, MIN_LISTED_FOR_INDEX } from "@/app/lib/therapist-directory";
import { ASSESSMENTS, assessmentBySlug } from "@/app/lib/assessments";
import { ONLINE_SLUG } from "@/app/lib/regions";
import TherapistResultCard from "@/app/components/TherapistResultCard";
import PageViewTracker from "@/app/components/PageViewTracker";
import { introPlusOffer } from "@/app/lib/meta-description";

// Assessment landing pages. See app/lib/assessments.ts for why this family
// exists and why each page carries editorial content rather than only a list.

const BASE = "https://www.mentalytics.co.il";

export const revalidate = 300;

export function generateStaticParams() {
  return ASSESSMENTS.map((a) => ({ type: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }): Promise<Metadata> {
  const { type } = await params;
  const a = assessmentBySlug(type);
  if (!a) return { title: "אבחון לא נמצא" };
  const url = `${BASE}/therapists/assessment/${encodeURIComponent(a.slug)}`;
  // Same thin-page gate as cities, specialties and topics: no page without real
  // supply behind it.
  const count = await countListed({ assessmentType: a.value });
  // No quiz offer here on purpose - the matching quiz routes to therapists, not
  // to diagnosticians, so promising it on an assessment page would mislead.
  // What the page really does carry is intro / whoFor / performedBy, so the
  // richest tier promises exactly those three.
  const who = count >= MIN_LISTED_FOR_INDEX ? `${count} מאבחנים מוסמכים` : "מאבחנים מוסמכים";
  const description = introPlusOffer(
    a.intro,
    `רשימת ${who} - מה האבחון בודק, מי מוסמך לבצע אותו ולמי הוא מתאים.`,
    `רשימת ${who} לפנייה ישירה.`
  );
  const robots = count < MIN_LISTED_FOR_INDEX ? { index: false as const, follow: true } : undefined;
  return {
    title: a.searchTitle,
    description,
    alternates: { canonical: url },
    robots,
    openGraph: { title: a.searchTitle, description, url },
  };
}

export default async function AssessmentPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const a = assessmentBySlug(type);
  if (!a) notFound();

  const list = await loadPublicTherapists({ assessmentType: a.value });
  const onlineHere = list.filter((t) => t.online).length;
  const url = `${BASE}/therapists/assessment/${encodeURIComponent(a.slug)}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: a.searchTitle,
    description: a.intro.slice(0, 200),
    inLanguage: "he",
    url,
    hasPart: list.slice(0, 50).map(listingItemSchema),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "בית", item: BASE },
      { "@type": "ListItem", position: 2, name: "המטפלים שלנו", item: `${BASE}/therapists` },
      { "@type": "ListItem", position: 3, name: "אבחונים", item: `${BASE}/therapists/assessment` },
      { "@type": "ListItem", position: 4, name: a.name, item: url },
    ],
  };

  const others = ASSESSMENTS.filter((x) => x.slug !== a.slug);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />
      <PageViewTracker page={`assessment:${a.value}`} source="assessment" />

      <Link href="/therapists/assessment" className="text-sm text-stone-500 hover:underline mb-6 inline-block">
        ← כל האבחונים
      </Link>

      <div className="mb-8">
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "8px" }}>
          אבחון והערכה
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em" }}>
          {a.searchTitle}
        </h1>
        {list.length >= MIN_LISTED_FOR_INDEX && (
          <p className="mt-2 text-sm text-stone-500">
            {`בטיפול חכם ${list.length} מאבחנים מאומתים${onlineHere > 0 ? `, ${onlineHere} מהם זמינים גם אונליין` : ""}.`}
          </p>
        )}
      </div>

      {/* The editorial half - what the searcher actually asked. */}
      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <p className="text-[15.5px] leading-8 text-stone-700">{a.intro}</p>
        </div>
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl p-5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
            <p className="text-sm font-black text-stone-900 mb-1">למי זה מתאים</p>
            <p className="text-[14px] leading-7 text-stone-600">{a.whoFor}</p>
          </div>
          <div className="rounded-2xl p-5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
            <p className="text-sm font-black text-stone-900 mb-1">מי מוסמך לבצע</p>
            <p className="text-[14px] leading-7 text-stone-600">{a.performedBy}</p>
          </div>
        </div>
      </div>

      {a.related.length > 0 && (
        <div className="mb-10 flex flex-wrap items-center gap-2">
          <span style={{ fontSize: "12.5px", color: "var(--faint)" }}>להעמקה:</span>
          {a.related.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="rounded-full px-3.5 py-1.5 text-sm font-semibold"
              style={{ background: "var(--teal-pale)", color: "var(--teal-dark)", textDecoration: "none" }}
            >
              {r.label}
            </Link>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <div className="rounded-2xl border border-[#E8E0D8] bg-[var(--surface)] p-6 text-stone-600">
          עדיין אין מאבחנים מוצגים בסוג האבחון הזה. אפשר לעיין ב
          <Link href="/therapists" className="font-semibold text-[#2e7d8c] hover:underline">כל המטפלים</Link> או למלא{" "}
          <Link href="/adults" className="font-semibold text-[#2e7d8c] hover:underline">שאלון התאמה</Link>.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => (
            <TherapistResultCard key={t.id} t={t} backHref={`/therapists/assessment/${encodeURIComponent(a.slug)}`} />
          ))}
        </div>
      )}

      <div className="mt-10 pt-6 border-t border-[var(--line)]">
        <h2 className="text-base font-extrabold text-stone-800 mb-3">סוגי אבחון נוספים</h2>
        <div className="flex flex-wrap gap-2">
          {others.map((x) => (
            <Link
              key={x.slug}
              href={`/therapists/assessment/${x.slug}`}
              className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
              style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}
            >
              {x.name}
            </Link>
          ))}
          <Link
            href={`/therapists/region/${ONLINE_SLUG}`}
            className="rounded-full px-3.5 py-1.5 text-sm font-semibold hover:bg-[var(--teal-pale)]"
            style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}
          >
            🌐 טיפול אונליין
          </Link>
        </div>
      </div>
    </main>
  );
}
