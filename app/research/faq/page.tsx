import Link from "next/link";
import { FAQS } from "./faqs";
import { ResearchBreadcrumbLd } from "@/app/components/ResearchBreadcrumbLd";
import { ResearchArticleLd } from "@/app/components/ResearchArticleLd";
import { DetailsCard } from "@/app/components/DetailsCard";

// Server component. Previously "use client" with a useState accordion, which
// meant not one answer reached the HTML - the page served 184 words. See the
// note in DetailsCard.

const FURTHER = [
  { href: "/research/which-therapy", label: "איזה טיפול פסיכולוגי מתאים לי?" },
  { href: "/research/therapist-types", label: "סוגי המטפלים בישראל" },
  { href: "/research/choosing-therapist", label: "מה חשוב לבדוק כשבוחרים מטפל?" },
  { href: "/research/online-therapy", label: "טיפול אונליין - כן או לא?" },
];

export default function FAQPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <ResearchBreadcrumbLd slug="faq" title="שאלות נפוצות" />
      <ResearchArticleLd
        slug="faq"
        headline="שאלות נפוצות על טיפול נפשי"
        description="תשובות לשאלות שעולות לפני, במהלך ואחרי הטיפול: איך בוחרים, כמה זה עולה, כמה זמן זה לוקח ומה קורה במפגש הראשון."
        section="שאלות חשובות"
      />

      <Link href="/research" className="mb-6 inline-block text-sm hover:underline" style={{ color: "var(--muted)" }}>
        ← חזרה למאמרים ומידע שימושי
      </Link>

      <h1 className="mb-3 text-3xl font-black" style={{ color: "var(--text)" }}>
        שאלות נפוצות
      </h1>
      <p className="mb-10 leading-7" style={{ color: "var(--text-2)" }}>
        תשובות לשאלות שעולות לפני, במהלך ואחרי הטיפול.
      </p>

      <div className="space-y-3">
        {FAQS.map((item, idx) => (
          // The first one starts open: it gives a reader landing here a visible
          // answer instead of a wall of closed rows.
          <DetailsCard key={item.q} summary={item.q} defaultOpen={idx === 0}>
            <p className="text-sm leading-7" style={{ color: "var(--text-2)" }}>
              {item.a}
            </p>
            {item.link && (
              <Link
                href={item.link}
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
                style={{ color: "var(--teal-dark)" }}
              >
                {item.linkLabel} →
              </Link>
            )}
          </DetailsCard>
        ))}
      </div>

      <div className="mt-10 rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <h2 className="mb-4 text-base font-extrabold" style={{ color: "var(--text)" }}>
          קריאה נוספת
        </h2>
        <ul className="space-y-2 text-sm">
          {FURTHER.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="hover:underline" style={{ color: "var(--teal-dark)" }}>
                ← {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
