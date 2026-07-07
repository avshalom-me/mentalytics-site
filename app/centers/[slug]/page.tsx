import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { MapPin, Globe, Phone, Users, ArrowLeft, Sparkles } from "lucide-react";
import { getPublicCenterBySlug } from "@/app/lib/center-public";
import { loadPublicTherapists } from "@/app/lib/therapist-directory";
import { therapistPath } from "@/app/lib/therapist-url";
import TherapistResultCard from "@/app/components/TherapistResultCard";

// עמוד מרכז ציבורי (SEO) — הטבה במסלול הממומן. מוצג רק למרכז פעיל שהעמוד שלו
// מודלק (getPublicCenterBySlug אוכף זאת). כולל מידע על המרכז, שמות המנהלים,
// יצירת קשר, ורשימת כל המטפלים המשויכים — מקושרים לפרופילים.

const BASE = "https://www.mentalytics.co.il";

// מתחדש כל 5 דקות — מטפל חדש/עדכון תוכן נכנס בלי פריסה, ונשאר סטטי ומהיר לזחלנים.
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const center = await getPublicCenterBySlug(slug);
  if (!center) return { title: "מרכז לא נמצא", robots: { index: false, follow: false } };

  const cityPart = center.public_city ? ` ב${center.public_city}` : "";
  const title = `${center.name} — מרכז טיפולי${cityPart} | טיפול חכם`;
  const description =
    (center.public_description?.trim()?.slice(0, 155)) ||
    `${center.name} — מרכז טיפולי${cityPart}. הכירו את המטפלים של המרכז וקבעו התאמה אישית דרך טיפול חכם.`;
  const url = `${BASE}/centers/${center.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
  };
}

export default async function CenterPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const center = await getPublicCenterBySlug(slug);
  if (!center) notFound();

  const therapists = await loadPublicTherapists({ centerId: center.id });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalOrganization",
    name: center.name,
    inLanguage: "he",
    url: `${BASE}/centers/${center.slug}`,
    ...(center.public_description ? { description: center.public_description } : {}),
    ...(center.public_city ? { address: { "@type": "PostalAddress", addressLocality: center.public_city, addressCountry: "IL" } } : {}),
    ...(center.public_website ? { sameAs: [center.public_website] } : {}),
    ...(center.public_phone ? { telephone: center.public_phone } : {}),
    ...(therapists.length > 0
      ? { employee: therapists.map((t) => ({ "@type": "Person", name: t.full_name, url: `${BASE}${therapistPath(t.id, t.full_name)}` })) }
      : {}),
  };

  const website = center.public_website?.trim();
  const websiteHref = website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : null;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <Link href="/therapists" className="text-sm text-stone-500 hover:underline mb-6 inline-block">← כל המטפלים</Link>

      {/* Hero */}
      <header className="mb-8">
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "8px" }}>
          מרכז טיפולי
        </p>
        <h1 style={{ fontSize: "clamp(1.9rem,3.4vw,2.6rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em" }}>
          {center.name}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-stone-600">
          {center.public_city && (
            <span className="inline-flex items-center gap-1.5"><MapPin size={15} style={{ color: "var(--teal)" }} /> {center.public_city}</span>
          )}
          {websiteHref && (
            <a href={websiteHref} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 hover:underline" style={{ color: "var(--teal-dark)" }}>
              <Globe size={15} style={{ color: "var(--teal)" }} /> אתר המרכז
            </a>
          )}
          {center.public_phone && (
            <a href={`tel:${center.public_phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 hover:underline" style={{ color: "var(--teal-dark)" }}>
              <Phone size={15} style={{ color: "var(--teal)" }} /> {center.public_phone}
            </a>
          )}
        </div>

        {center.public_description && (
          <p className="mt-5 text-stone-700 leading-8 whitespace-pre-line" style={{ maxWidth: "68ch" }}>
            {center.public_description}
          </p>
        )}

        {center.public_managers && (
          <p className="mt-4 text-sm text-stone-600">
            <span className="font-bold text-stone-800">ניהול המרכז:</span> {center.public_managers}
          </p>
        )}
      </header>

      {/* Therapists */}
      <section>
        <h2 className="mb-5 flex items-center gap-2 text-xl font-black text-stone-900">
          <Users size={20} style={{ color: "var(--teal)" }} /> המטפלים של {center.name}
        </h2>
        {therapists.length === 0 ? (
          <div className="rounded-2xl border border-[#E8E0D8] bg-[var(--surface)] p-6 text-stone-600">
            רשימת המטפלים של המרכז תתעדכן בקרוב. בינתיים אפשר למלא{" "}
            <Link href="/adults" className="font-semibold text-[#2e7d8c] hover:underline">שאלון התאמה</Link> ולקבל התאמה אישית.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {therapists.map((t) => <TherapistResultCard key={t.id} t={t} />)}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="mt-12 rounded-3xl p-6 text-center"
        style={{ background: "linear-gradient(135deg,#F0F7FA 0%,#E6F4F7 50%,#F5E8DC 100%)", border: "1px solid #D8E4E8" }}>
        <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase mb-3"
          style={{ background: "var(--teal-pale)", color: "var(--teal-dark)", border: "1px solid var(--teal-mid)" }}>
          <Sparkles size={12} /> התאמה אישית
        </div>
        <h2 className="text-2xl font-black text-stone-900">לא בטוחים לאיזה מטפל לפנות?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-stone-700">
          מלאו שאלון קצר ומערכת ההתאמה החכמה תפנה אתכם למטפל/ת המתאים/ה ביותר במרכז {center.name} — לפי סוג הקושי, הגישה והאזור.
        </p>
        <Link href="/adults" className="mt-5 inline-flex items-center gap-2 rounded-full px-7 py-3 text-base font-bold text-white transition hover:opacity-95"
          style={{ background: "linear-gradient(135deg,var(--teal-dark),var(--teal))" }}>
          למילוי שאלון התאמה <ArrowLeft size={16} />
        </Link>
      </section>
    </main>
  );
}
