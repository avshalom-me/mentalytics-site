import Link from "next/link";
import type { Metadata } from "next";
import { ARRANGEMENT_PAGES } from "@/app/lib/arrangements";
import { countListed, MIN_LISTED_FOR_INDEX } from "@/app/lib/therapist-directory";

const BASE = "https://www.mentalytics.co.il";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "מי מממן טיפול נפשי - קופות חולים, משרד הביטחון וביטוח לאומי | טיפול חכם",
  description:
    "טיפול דרך קופת חולים, אגף השיקום במשרד הביטחון, ביטוח לאומי או ביטוח פרטי: למי כל מסלול פתוח, מה כדאי לברר לפני שקובעים, ואילו מטפלים עובדים מול כל גוף.",
  alternates: { canonical: `${BASE}/therapists/arrangement` },
  openGraph: {
    title: "מי מממן טיפול נפשי - כל מסלולי המימון",
    description: "למי כל מסלול פתוח, מה לברר לפני שקובעים, ואילו מטפלים עובדים מול כל גוף מממן.",
    url: `${BASE}/therapists/arrangement`,
  },
};

export default async function ArrangementHubPage() {
  const counted = await Promise.all(
    ARRANGEMENT_PAGES.map(async (a) => ({ a, count: await countListed({ arrangement: a.value }) }))
  );
  const listed = counted.filter((c) => c.count >= MIN_LISTED_FOR_INDEX).sort((x, y) => y.count - x.count);

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "מסלולי מימון לטיפול נפשי",
    url: `${BASE}/therapists/arrangement`,
    inLanguage: "he",
    isPartOf: { "@type": "WebSite", name: "טיפול חכם", url: BASE },
    hasPart: listed.map((c) => ({
      "@type": "CollectionPage" as const,
      name: c.a.name,
      url: `${BASE}/therapists/arrangement/${encodeURIComponent(c.a.slug)}`,
    })),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "בית", item: BASE },
      { "@type": "ListItem", position: 2, name: "המטפלים שלנו", item: `${BASE}/therapists` },
      { "@type": "ListItem", position: 3, name: "מסלולי מימון", item: `${BASE}/therapists/arrangement` },
    ],
  };

  return (
    <main className="mx-auto max-w-4xl px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />

      <Link href="/therapists" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← כל המטפלים</Link>

      <div className="mb-8">
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "8px" }}>
          מסלולי מימון
        </p>
        <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em" }}>
          מי מממן טיפול נפשי
        </h1>
        <p className="mt-3 text-stone-600 leading-8" style={{ maxWidth: "62ch" }}>
          המחיר הוא הסיבה הנפוצה ביותר לדחות טיפול, ולעיתים קרובות קיים מסלול מימון שהפונה פשוט לא ידע עליו.
          לכל גוף מממן יש קריטריונים משלו, תהליך אישור משלו ורשימת מטפלים משלו. בחרו מסלול כדי להבין למי הוא
          פתוח ומה כדאי לברר לפני שקובעים תור.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {listed.map(({ a, count }) => (
          <Link
            key={a.slug}
            href={`/therapists/arrangement/${a.slug}`}
            className="rounded-2xl bg-white p-5 transition hover:shadow-md hover:-translate-y-0.5"
            style={{ border: "1px solid var(--line)", textDecoration: "none" }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-lg font-black text-stone-900">{a.name}</div>
              <div className="text-xs shrink-0" style={{ color: "var(--faint)" }}>
                {count} מטפלים
              </div>
            </div>
            <div className="text-sm text-stone-500 mt-1 leading-6">{a.whoFor}</div>
          </Link>
        ))}
      </div>

      <p className="mt-6 text-xs text-stone-500">
        הרשימות מבוססות על הצהרת המטפלים. תנאי הזכאות והסכומים משתנים מעת לעת, והפרטים המחייבים הם של הגוף
        המממן עצמו.
      </p>

      <div className="mt-8 rounded-2xl p-6" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }}>
        <p className="font-black" style={{ color: "var(--teal-dark)", fontSize: "16px" }}>
          לא בטוחים לאיזה מסלול אתם שייכים?
        </p>
        <p className="text-sm mt-1 leading-7" style={{ color: "var(--teal-dark)" }}>
          התחילו מהשאלון - הוא ממפה את הקושי וממליץ על סוג הטיפול, ומשם קל יותר לברר מול הגוף המממן מה מכוסה.
          בחינם, אנונימי וללא התחייבות.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/adults" className="rounded-full px-4 py-2 text-sm font-bold" style={{ background: "var(--teal)", color: "#fff", textDecoration: "none" }}>
            לשאלון למבוגרים ←
          </Link>
          <Link href="/kids" className="rounded-full px-4 py-2 text-sm font-bold" style={{ background: "var(--bg)", color: "var(--teal-dark)", border: "1px solid var(--teal-mid)", textDecoration: "none" }}>
            לשאלון לילדים ונוער ←
          </Link>
          <Link href="/research/kupa-guide" className="rounded-full px-4 py-2 text-sm font-bold" style={{ background: "var(--bg)", color: "var(--teal-dark)", border: "1px solid var(--teal-mid)", textDecoration: "none" }}>
            המדריך לטיפול דרך הקופה
          </Link>
        </div>
      </div>
    </main>
  );
}
