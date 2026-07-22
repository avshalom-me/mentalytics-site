import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { MapPin, Globe, Phone, Users, ArrowLeft, Sparkles, BadgeCheck, Layers } from "lucide-react";
import { getPublicCenterBySlug, signCenterAssets } from "@/app/lib/center-public";
import { loadPublicTherapists } from "@/app/lib/therapist-directory";
import { therapistPath } from "@/app/lib/therapist-url";
import TherapistResultCard from "@/app/components/TherapistResultCard";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// עמוד מרכז ציבורי (SEO). מסלול 1 — מציג את מטפלי המרכז. מסלול 2 (מרכז כישות)
// — מציג את הפרופיל הויזואלי: לוגו, מה המרכז מציע (מתוך שורת הישות), וצוות/ראשי
// המרכז. גלוי רק למרכז פעיל (getPublicCenterBySlug אוכף).

const BASE = "https://www.mentalytics.co.il";

export const revalidate = 300;

const REGION_LABELS: Record<string, string> = {
  center: "מרכז", sharon: "שרון", jerusalem: "ירושלים", haifa: "חיפה",
  north: "צפון", south: "דרום", online: "אונליין", other: "אחר",
};
const regionLabel = (r: string) => REGION_LABELS[r] ?? r;

type CenterEntity = {
  therapist_types: string[] | null;
  training_areas: string[] | null;
  regions: string[] | null;
  online: boolean | null;
  languages: string[] | null;
};

async function getCenterEntity(centerId: string): Promise<CenterEntity | null> {
  const { data } = await supabaseAdmin
    .from("therapists")
    .select("therapist_types, training_areas, regions, online, languages")
    .eq("center_account_id", centerId)
    .eq("entity_type", "center")
    .maybeSingle();
  return (data as CenterEntity | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const center = await getPublicCenterBySlug(slug);
  if (!center) return { title: "מרכז לא נמצא", robots: { index: false, follow: false } };

  const cityPart = center.public_city ? ` ב${center.public_city}` : "";
  const title = `${center.name} - מרכז טיפולי${cityPart} | טיפול חכם`;
  const description =
    (center.public_description?.trim()?.slice(0, 155)) ||
    `${center.name} - מרכז טיפולי${cityPart}. הכירו את המרכז והצוות, וקבעו התאמה אישית דרך טיפול חכם.`;
  const url = `${BASE}/centers/${center.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", images: [{ url: `${BASE}/logo.svg.png`, alt: center.name }] },
  };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).trim() || "•";
}

const AV_GRADIENTS = [
  "linear-gradient(140deg,#3D8C8A,#2A6462)",
  "linear-gradient(140deg,#D49018,#A87010)",
  "linear-gradient(140deg,#5AA6A0,#3D8C8A)",
  "linear-gradient(140deg,#4E9C93,#2A6462)",
];

export default async function CenterPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const center = await getPublicCenterBySlug(slug);
  if (!center) notFound();

  const isEntity = center.billing_track === "center_entity";
  const [assets, entity, therapists] = await Promise.all([
    signCenterAssets(center),
    isEntity ? getCenterEntity(center.id) : Promise.resolve(null),
    isEntity ? Promise.resolve([]) : loadPublicTherapists({ centerId: center.id }),
  ]);

  // צ'יפים של "מה המרכז מציע" — תחומי המומחיות + סוגי הטיפול של הישות.
  const offerChips = Array.from(
    new Set([...(entity?.training_areas ?? []), ...(entity?.therapist_types ?? [])].map((s) => String(s).trim()).filter(Boolean)),
  );
  const regionChips = (entity?.regions ?? []).map((r) => String(r)).filter(Boolean);
  const showOffer = isEntity && (offerChips.length > 0 || regionChips.length > 0 || entity?.online);

  const website = center.public_website?.trim();
  const websiteHref = website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalOrganization",
    name: center.name,
    inLanguage: "he",
    url: `${BASE}/centers/${center.slug}`,
    ...(assets.logoUrl ? { logo: assets.logoUrl } : {}),
    ...(center.public_description ? { description: center.public_description } : {}),
    ...(center.public_city ? { address: { "@type": "PostalAddress", addressLocality: center.public_city, addressCountry: "IL" } } : {}),
    ...(center.public_website ? { sameAs: [center.public_website] } : {}),
    ...(center.public_phone ? { telephone: center.public_phone } : {}),
    ...(therapists.length > 0
      ? { employee: therapists.map((t) => ({ "@type": "Person", name: t.full_name, url: `${BASE}${therapistPath(t.id, t.full_name)}` })) }
      : {}),
  };

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 pb-24" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <Link href="/therapists" className="mb-6 inline-block text-sm text-[var(--muted)] hover:underline">← כל המטפלים</Link>

      {/* Hero */}
      <header className="flex flex-wrap items-start gap-6">
        {assets.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={assets.logoUrl} alt={`הלוגו של ${center.name}`}
            className="h-[104px] w-[104px] flex-shrink-0 rounded-3xl border border-[var(--line)] bg-white object-contain p-2 shadow-sm" />
        ) : (
          <div className="flex h-[104px] w-[104px] flex-shrink-0 items-center justify-center rounded-3xl text-4xl font-black text-white shadow-sm"
            style={{ background: "linear-gradient(140deg,var(--teal),var(--teal-dark))" }}>
            {initials(center.name)}
          </div>
        )}
        <div className="min-w-[260px] flex-1">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[.16em] text-[var(--teal)]">מרכז טיפולי</p>
          <h1 className="text-[clamp(1.9rem,3.6vw,2.7rem)] font-black leading-[1.05] tracking-tight text-[var(--text)]">{center.name}</h1>
          <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--text-2)]">
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
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E9D6A6] px-3 py-1 text-xs font-extrabold"
              style={{ background: "var(--gold-pale)", color: "var(--gold-dark)" }}>
              <BadgeCheck size={14} /> מרכז מאומת
            </span>
          </div>
          {center.public_description && (
            <p className="mt-5 max-w-[66ch] whitespace-pre-line text-[16px] leading-8 text-[var(--text-2)]">{center.public_description}</p>
          )}
          {center.public_managers && (
            <p className="mt-4 text-sm text-[var(--text-2)]"><span className="font-bold text-[var(--text)]">ניהול המרכז:</span> {center.public_managers}</p>
          )}
        </div>
      </header>

      {/* מה המרכז מציע (מסלול 2) */}
      {showOffer && (
        <section className="mt-14">
          <h2 className="mb-1 flex items-center gap-2 text-[1.28rem] font-black tracking-tight text-[var(--text)]">
            <Layers size={20} style={{ color: "var(--teal)" }} /> מה המרכז מציע
          </h2>
          <p className="mb-5 text-sm text-[var(--muted)]">התאמות מהשאלון מגיעות למרכז לפי התחומים והאזורים הבאים.</p>
          <div className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-5">
            {offerChips.length > 0 && (
              <>
                <p className="mb-2.5 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">גישות וסוגי טיפול</p>
                <div className="mb-1 flex flex-wrap gap-2">
                  {offerChips.map((c) => (
                    <span key={c} className="rounded-full border border-[var(--teal-mid)] bg-white px-3.5 py-1.5 text-[13.5px] font-semibold text-[var(--teal-dark)]">{c}</span>
                  ))}
                </div>
              </>
            )}
            {(regionChips.length > 0 || entity?.online) && (
              <>
                <p className="mb-2.5 mt-4 text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">אזורי מתן שירות</p>
                <div className="flex flex-wrap gap-2">
                  {regionChips.map((r) => (
                    <span key={r} className="rounded-full border border-[var(--line)] bg-white px-3.5 py-1.5 text-[13.5px] font-semibold text-[var(--text-2)]">📍 {regionLabel(r)}</span>
                  ))}
                  {entity?.online && (
                    <span className="rounded-full border border-[var(--line)] bg-white px-3.5 py-1.5 text-[13.5px] font-semibold text-[var(--text-2)]">💻 אונליין</span>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* הצוות המוביל (מסלול 2) */}
      {isEntity && assets.team.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-1 flex items-center gap-2 text-[1.28rem] font-black tracking-tight text-[var(--text)]">
            <Users size={20} style={{ color: "var(--teal)" }} /> הצוות המוביל
          </h2>
          <p className="mb-5 text-sm text-[var(--muted)]">ראשי המרכז ואנשי המקצוע הבכירים שמובילים את הטיפול.</p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {assets.team.map((m, i) => (
              <div key={i} className="rounded-[20px] border border-[var(--line)] bg-white p-5 text-center shadow-sm">
                {m.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.photoUrl} alt={m.name} className="mx-auto mb-3.5 h-[88px] w-[88px] rounded-full object-cover" />
                ) : (
                  <div className="mx-auto mb-3.5 flex h-[88px] w-[88px] items-center justify-center rounded-full text-[27px] font-extrabold text-white"
                    style={{ background: AV_GRADIENTS[i % AV_GRADIENTS.length] }}>
                    {initials(m.name)}
                  </div>
                )}
                <p className="text-[15px] font-extrabold tracking-tight text-[var(--text)]">{m.name}</p>
                {m.role && <p className="mt-1.5 text-[12.5px] leading-5 text-[var(--muted)]">{m.role}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* מטפלי המרכז (מסלול 1) */}
      {!isEntity && (
        <section className="mt-14">
          <h2 className="mb-5 flex items-center gap-2 text-xl font-black text-[var(--text)]">
            <Users size={20} style={{ color: "var(--teal)" }} /> המטפלים של {center.name}
          </h2>
          {therapists.length === 0 ? (
            <div className="rounded-2xl border border-[#E8E0D8] bg-[var(--surface)] p-6 text-[var(--text-2)]">
              רשימת המטפלים של המרכז תתעדכן בקרוב. בינתיים אפשר למלא{" "}
              <Link href="/adults" className="font-semibold text-[#2e7d8c] hover:underline">שאלון התאמה</Link> ולקבל התאמה אישית.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {therapists.map((t) => <TherapistResultCard key={t.id} t={t} backHref={`/centers/${center.slug}`} />)}
            </div>
          )}
        </section>
      )}

      {/* CTA */}
      <section className="mt-14 rounded-[26px] border border-[var(--teal-mid)] p-9 text-center"
        style={{ background: "linear-gradient(135deg,var(--teal-pale) 0%,#E6F4F7 48%,var(--gold-pale) 100%)" }}>
        <div className="mb-3.5 inline-flex items-center gap-2 rounded-full border border-[var(--teal-mid)] bg-white px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-wider"
          style={{ color: "var(--teal-dark)" }}>
          <Sparkles size={12} /> פנייה למרכז
        </div>
        <h2 className="text-[clamp(1.5rem,2.6vw,2rem)] font-black tracking-tight text-[var(--text)]">
          מתאימים לך את הטיפול הנכון ב{center.name}
        </h2>
        <p className="mx-auto mt-3 max-w-[52ch] text-[15px] leading-7 text-[var(--text-2)]">
          מלאו שאלון קצר ומערכת ההתאמה החכמה תפנה אתכם ל{isEntity ? "מרכז" : "מטפל/ת המתאים/ה ביותר במרכז"} — לפי סוג הקושי, הגישה והאזור.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/adults" className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-base font-bold text-white transition hover:opacity-95"
            style={{ background: "linear-gradient(135deg,var(--teal-dark),var(--teal))", boxShadow: "0 8px 20px rgba(45,100,98,.25)" }}>
            למילוי שאלון התאמה <ArrowLeft size={16} />
          </Link>
          {center.public_phone && (
            <a href={`tel:${center.public_phone.replace(/[^\d+]/g, "")}`}
              className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[var(--teal-mid)] bg-white px-7 py-3 text-base font-bold transition hover:bg-[var(--teal-pale)]"
              style={{ color: "var(--teal-dark)" }}>
              <Phone size={16} /> יצירת קשר ישירה
            </a>
          )}
        </div>
      </section>
    </main>
  );
}
