import Link from "next/link";
import type { Metadata } from "next";
import { ASSESSMENTS } from "@/app/lib/assessments";
import { countListed, MIN_LISTED_FOR_INDEX } from "@/app/lib/therapist-directory";
import PageViewTracker from "@/app/components/PageViewTracker";

const BASE = "https://www.mentalytics.co.il";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "אבחונים והערכות פסיכולוגיות - מאבחנים מוסמכים | טיפול חכם",
  description:
    "אבחון פסיכודידקטי, פסיכודיאגנוסטי, נוירופסיכולוגי, אבחון אוטיזם והערכת בשלות לגן: מה כל אחד בודק, מי מוסמך לבצע אותו, ורשימת מאבחנים מאומתים.",
  alternates: { canonical: `${BASE}/therapists/assessment` },
  openGraph: {
    title: "אבחונים והערכות פסיכולוגיות - מאבחנים מוסמכים",
    description: "מה כל סוג אבחון בודק, מי מוסמך לבצע אותו, ורשימת מאבחנים מאומתים - דרך טיפול חכם.",
    url: `${BASE}/therapists/assessment`,
  },
};

export default async function AssessmentHubPage() {
  const counted = await Promise.all(
    ASSESSMENTS.map(async (a) => ({ a, count: await countListed({ assessmentType: a.value }) }))
  );
  // Only link on to pages that clear the gate - a hub pointing at noindex pages
  // just spends crawl budget.
  const listed = counted.filter((c) => c.count >= MIN_LISTED_FOR_INDEX).sort((x, y) => y.count - x.count);

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "אבחונים והערכות פסיכולוגיות",
    url: `${BASE}/therapists/assessment`,
    inLanguage: "he",
    isPartOf: { "@type": "WebSite", name: "טיפול חכם", url: BASE },
    hasPart: listed.map((c) => ({
      "@type": "CollectionPage" as const,
      name: c.a.name,
      url: `${BASE}/therapists/assessment/${encodeURIComponent(c.a.slug)}`,
    })),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "בית", item: BASE },
      { "@type": "ListItem", position: 2, name: "המטפלים שלנו", item: `${BASE}/therapists` },
      { "@type": "ListItem", position: 3, name: "אבחונים", item: `${BASE}/therapists/assessment` },
    ],
  };

  return (
    <main className="mx-auto max-w-4xl px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <PageViewTracker page="hub:assessment" source="hub" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />

      <Link href="/therapists" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← כל המטפלים</Link>

      <div className="mb-8">
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "8px" }}>
          אבחון והערכה
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em" }}>
          אבחונים והערכות פסיכולוגיות
        </h1>
        <p className="mt-3 text-stone-600 leading-8" style={{ maxWidth: "62ch" }}>
          לכל סוג אבחון יש שאלה אחרת שהוא עונה עליה, ומאבחן אחר שמוסמך לבצע אותו. הטעות היקרה ביותר היא לעשות
          אבחון מלא כשהיה מספיק אבחון ממוקד - או להפך. בחרו סוג כדי לקרוא מה הוא בודק ולראות מאבחנים מאומתים.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {listed.map(({ a, count }) => (
          <Link
            key={a.slug}
            href={`/therapists/assessment/${a.slug}`}
            className="rounded-2xl bg-white p-5 transition hover:shadow-md hover:-translate-y-0.5"
            style={{ border: "1px solid var(--line)", textDecoration: "none" }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-lg font-black text-stone-900">{a.name}</div>
              <div className="text-xs shrink-0" style={{ color: "var(--faint)" }}>
                {count} מאבחנים
              </div>
            </div>
            <div className="text-sm text-stone-500 mt-1 leading-6">{a.whoFor}</div>
          </Link>
        ))}
      </div>

      <div className="mt-10 rounded-2xl p-6" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }}>
        <p className="font-black" style={{ color: "var(--teal-dark)", fontSize: "16px" }}>
          לא בטוחים איזה אבחון אתם צריכים?
        </p>
        <p className="text-sm mt-1 leading-7" style={{ color: "var(--teal-dark)" }}>
          זו השאלה הנפוצה ביותר, והתשובה תלויה במי שאליו מגישים את הדוח. השאלון שלנו ממפה את הקושי וגם מפנה
          לאבחון כשצריך - בחינם, אנונימי וללא התחייבות.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/adults" className="rounded-full px-4 py-2 text-sm font-bold" style={{ background: "var(--teal)", color: "#fff", textDecoration: "none" }}>
            לשאלון למבוגרים ←
          </Link>
          <Link href="/kids" className="rounded-full px-4 py-2 text-sm font-bold" style={{ background: "var(--bg)", color: "var(--teal-dark)", border: "1px solid var(--teal-mid)", textDecoration: "none" }}>
            לשאלון לילדים ונוער ←
          </Link>
          <Link href="/research/assessments" className="rounded-full px-4 py-2 text-sm font-bold" style={{ background: "var(--bg)", color: "var(--teal-dark)", border: "1px solid var(--teal-mid)", textDecoration: "none" }}>
            השוואה בין כל האבחונים
          </Link>
        </div>
      </div>
    </main>
  );
}
