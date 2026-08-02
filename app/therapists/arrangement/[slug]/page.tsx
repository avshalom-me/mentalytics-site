import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { loadPublicTherapists, countListed, MIN_LISTED_FOR_INDEX } from "@/app/lib/therapist-directory";
import { therapistPath } from "@/app/lib/therapist-url";
import { genderTitle } from "@/app/lib/gender-text";
import { ARRANGEMENT_PAGES, arrangementBySlug } from "@/app/lib/arrangements";
import { ONLINE_SLUG } from "@/app/lib/regions";
import TherapistResultCard from "@/app/components/TherapistResultCard";
import PageViewTracker from "@/app/components/PageViewTracker";

// Funding-route landing pages. See app/lib/arrangements.ts for why this family
// exists and why it carries editorial content rather than only a filtered list.

const BASE = "https://www.mentalytics.co.il";

export const revalidate = 300;

export function generateStaticParams() {
  return ARRANGEMENT_PAGES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = arrangementBySlug(slug);
  if (!a) return { title: "מסלול לא נמצא" };
  const description = `${a.intro.slice(0, 130)}… מטפלים מאומתים בטיפול חכם.`;
  const url = `${BASE}/therapists/arrangement/${encodeURIComponent(a.slug)}`;
  const count = await countListed({ arrangement: a.value });
  const robots = count < MIN_LISTED_FOR_INDEX ? { index: false as const, follow: true } : undefined;
  return {
    title: a.searchTitle,
    description,
    alternates: { canonical: url },
    robots,
    openGraph: { title: a.searchTitle, description, url },
  };
}

export default async function ArrangementPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = arrangementBySlug(slug);
  if (!a) notFound();

  const list = await loadPublicTherapists({ arrangement: a.value });
  const onlineHere = list.filter((t) => t.online).length;
  const url = `${BASE}/therapists/arrangement/${encodeURIComponent(a.slug)}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: a.searchTitle,
    description: a.intro.slice(0, 200),
    inLanguage: "he",
    url,
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
      { "@type": "ListItem", position: 3, name: "מסלולי מימון", item: `${BASE}/therapists/arrangement` },
      { "@type": "ListItem", position: 4, name: a.name, item: url },
    ],
  };

  const others = ARRANGEMENT_PAGES.filter((x) => x.slug !== a.slug);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />
      <PageViewTracker page={`arrangement:${a.value}`} source="arrangement" />

      <Link href="/therapists/arrangement" className="text-sm text-stone-500 hover:underline mb-6 inline-block">
        ← כל מסלולי המימון
      </Link>

      <div className="mb-8">
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "8px" }}>
          מסלול מימון
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em" }}>
          {a.searchTitle}
        </h1>
        {list.length >= MIN_LISTED_FOR_INDEX && (
          <p className="mt-2 text-sm text-stone-500">
            {`בטיפול חכם ${list.length} מטפלים שציינו שהם עובדים מול ${a.name}${onlineHere > 0 ? `, ${onlineHere} מהם זמינים גם אונליין` : ""}.`}
          </p>
        )}
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <p className="text-[15.5px] leading-8 text-stone-700">{a.intro}</p>
        </div>
        <div className="rounded-2xl p-5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
          <p className="text-sm font-black text-stone-900 mb-1">למי זה פתוח</p>
          <p className="text-[14px] leading-7 text-stone-600">{a.whoFor}</p>
        </div>
      </div>

      <div className="mb-8 rounded-2xl p-6" style={{ background: "var(--gold-pale)", border: "1px solid var(--gold)" }}>
        <h2 className="text-base font-black mb-3" style={{ color: "var(--gold-dark)" }}>
          מה כדאי לברר לפני שקובעים
        </h2>
        <ul className="space-y-2">
          {a.whatToAsk.map((q) => (
            <li key={q} className="text-[14.5px] leading-7 text-stone-700">
              · {q}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-stone-500">
          תנאי הזכאות והסכומים משתנים מעת לעת. הפרטים המחייבים הם תמיד של הגוף המממן עצמו.
        </p>
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
          עדיין אין מטפלים מוצגים במסלול הזה. אפשר לעיין ב
          <Link href="/therapists" className="font-semibold text-[#2e7d8c] hover:underline">כל המטפלים</Link> או למלא{" "}
          <Link href="/adults" className="font-semibold text-[#2e7d8c] hover:underline">שאלון התאמה</Link>.
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-stone-500">
            הרשימה מבוססת על הצהרת המטפלים. כדאי לוודא מולם ומול הגוף המממן שההסדר תקף לגביכם.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((t) => (
              <TherapistResultCard key={t.id} t={t} backHref={`/therapists/arrangement/${encodeURIComponent(a.slug)}`} />
            ))}
          </div>
        </>
      )}

      <div className="mt-10 pt-6 border-t border-[var(--line)]">
        <h2 className="text-base font-extrabold text-stone-800 mb-3">מסלולי מימון נוספים</h2>
        <div className="flex flex-wrap gap-2">
          {others.map((x) => (
            <Link
              key={x.slug}
              href={`/therapists/arrangement/${x.slug}`}
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
