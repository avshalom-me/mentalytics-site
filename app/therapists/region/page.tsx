import Link from "next/link";
import type { Metadata } from "next";
import { ALL_REGIONS, regionToSlug, ONLINE_SLUG } from "@/app/lib/regions";
import PageViewTracker from "@/app/components/PageViewTracker";

const BASE = "https://www.mentalytics.co.il";

export const metadata: Metadata = {
  title: "מטפלים ופסיכולוגים לפי אזור | טיפול חכם",
  description: "בחרו אזור כדי למצוא פסיכולוגים ומטפלים מאומתים בקרבתכם, או עברו לטיפול אונליין - דרך טיפול חכם.",
  alternates: { canonical: `${BASE}/therapists/region` },
};

export default function RegionHubPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-12 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <PageViewTracker page="hub:region" source="hub" />
      <Link href="/therapists" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← כל המטפלים</Link>
      <div className="mb-8">
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "8px" }}>לפי אזור</p>
        <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em" }}>מטפלים ופסיכולוגים לפי אזור</h1>
        <p className="mt-3 text-stone-600 leading-8" style={{ maxWidth: "60ch" }}>בחרו את האזור שלכם כדי לראות את המטפלים המאומתים בקרבתכם, או עברו לטיפול אונליין.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link href={`/therapists/region/${ONLINE_SLUG}`} className="rounded-2xl bg-white p-5 transition hover:shadow-md hover:-translate-y-0.5"
          style={{ border: "1px solid var(--teal-mid)", background: "var(--teal-pale)" }}>
          <div className="text-lg font-black" style={{ color: "var(--teal-dark)" }}>🌐 טיפול אונליין</div>
          <div className="text-sm mt-1" style={{ color: "var(--teal-dark)" }}>מטפלים שמקבלים מכל הארץ</div>
        </Link>
        {ALL_REGIONS.map((region) => (
          <Link key={region} href={`/therapists/region/${regionToSlug(region)}`} className="rounded-2xl bg-white p-5 transition hover:shadow-md hover:-translate-y-0.5"
            style={{ border: "1px solid var(--line)", textDecoration: "none" }}>
            <div className="text-lg font-black text-stone-900">{region}</div>
            <div className="text-sm text-stone-500 mt-1">פסיכולוגים ומטפלים ב{region}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
