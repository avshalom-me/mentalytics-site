import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { MapPin, Globe, Phone, Users, ArrowLeft, Sparkles, BadgeCheck, Layers, Camera, Clock, Accessibility, Languages, Handshake, HelpCircle, Navigation } from "lucide-react";
import { treatmentExplainer } from "@/app/lib/treatment-explainers";
import { getPublicCenterBySlug, signCenterAssets } from "@/app/lib/center-public";
import { loadPublicTherapists } from "@/app/lib/therapist-directory";
import { therapistPath } from "@/app/lib/therapist-url";
import TherapistResultCard from "@/app/components/TherapistResultCard";
import TrackView from "@/app/therapists/[id]/TrackView";
import CenterMessageButton from "./CenterMessageButton";
import CenterPhoneLink from "./CenterPhoneLink";
import EntityProfile from "./EntityProfile";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// עמוד מרכז ציבורי (SEO). מסלול 1 - מציג את מטפלי המרכז. מסלול 2 (מרכז כישות)
// - מציג את הפרופיל הויזואלי: לוגו, מה המרכז מציע (מתוך שורת הישות), וצוות/ראשי
// המרכז. גלוי רק למרכז פעיל (getPublicCenterBySlug אוכף).

const BASE = "https://www.mentalytics.co.il";

export const revalidate = 300;

const REGION_LABELS: Record<string, string> = {
  center: "מרכז", sharon: "שרון", jerusalem: "ירושלים", haifa: "חיפה",
  north: "צפון", south: "דרום", online: "אונליין", other: "אחר",
};
const regionLabel = (r: string) => REGION_LABELS[r] ?? r;

type CenterEntity = {
  id: string;
  status: string;
  email: string | null;
  accepting_new_patients: boolean | null;
  therapist_types: string[] | null;
  training_areas: string[] | null;
  regions: string[] | null;
  online: boolean | null;
  languages: string[] | null;
  arrangements: string[] | null;
};

async function getCenterEntity(centerId: string): Promise<CenterEntity | null> {
  const { data } = await supabaseAdmin
    .from("therapists")
    .select("id, status, email, accepting_new_patients, therapist_types, training_areas, regions, online, languages, arrangements")
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
  // בלי "| טיפול חכם" - תבנית ה-layout כבר מוסיפה את המותג (אחרת הוא מוכפל).
  const title = `${center.name} - מרכז טיפולי${cityPart}`;
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

export default async function CenterPublicPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const center = await getPublicCenterBySlug(slug);
  if (!center) notFound();

  // הגעה מתוצאות ההתאמות (?from=match) - הצפייה נרשמת כ-match ולא directory,
  // כדי שמשפך המרכז בפורטל (הופעה→כניסה) יהיה קוהרנטי.
  const sp = searchParams ? await searchParams : undefined;
  const viewSource: "match" | "directory" = sp?.from === "match" ? "match" : "directory";

  const isEntity = center.billing_track === "center_entity";
  const [assets, entity, therapists] = await Promise.all([
    signCenterAssets(center),
    isEntity ? getCenterEntity(center.id) : Promise.resolve(null),
    isEntity ? Promise.resolve([]) : loadPublicTherapists({ centerId: center.id }),
  ]);

  // מרכז מסלול-2 (ישות אחת) מקבל את עיצוב "הקשתות"; מסלול 1 (פרופילים
  // מרובים) נשאר בפריסה הישנה - הפנייה אליו נעשית ממילא דרך המטפלים.
  if (isEntity) {
    return <EntityProfile center={center} entity={entity} assets={assets} viewSource={viewSource} />;
  }

  // צ'יפים של "מה המרכז מציע" - תחומי המומחיות + סוגי הטיפול של הישות.
  const offerChips = Array.from(
    new Set([...(entity?.training_areas ?? []), ...(entity?.therapist_types ?? [])].map((s) => String(s).trim()).filter(Boolean)),
  );
  const regionChips = (entity?.regions ?? []).map((r) => String(r)).filter(Boolean);
  const showOffer = isEntity && (offerChips.length > 0 || regionChips.length > 0 || entity?.online);

  const website = center.public_website?.trim();
  const websiteHref = website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : null;

  // הודעה למרכז דרך מערכת ההודעות - רק כשהישות חיה (בהתאמות) ויש לה מייל.
  const canMessage = !!(
    entity && entity.email && ["approved", "paying"].includes(entity.status) && entity.accepting_new_patients !== false
  );
  const galleryPhotos = assets.gallery.filter((g) => g.url);

  // פס עובדות-אמון - רק עובדות שמולאו, בלי המצאות.
  const yearsActive = center.public_founded_year ? Math.max(0, new Date().getFullYear() - center.public_founded_year) : null;
  const locationsCount = Math.max(1, Math.floor(Number(center.num_locations) || 1));
  const facts: { value: string; label: string }[] = [
    ...(yearsActive && yearsActive >= 2 ? [{ value: String(yearsActive), label: "שנות פעילות" }] : []),
    ...(center.public_team_size ? [{ value: String(center.public_team_size), label: "אנשי צוות" }] : []),
    ...(locationsCount > 1 ? [{ value: String(locationsCount), label: "סניפים" }] : []),
    ...(offerChips.length >= 3 ? [{ value: String(offerChips.length), label: "תחומי טיפול" }] : []),
  ];

  // דבר המנהל/ת - מוצג רק כשיש שם + טקסט.
  const director = center.public_director;
  const showDirector = !!(director?.name?.trim() && director?.note?.trim());

  // מילון הגישות - רק לצ'יפים שיש להם הסבר (תוכן פלטפורמה).
  const explainedChips = offerChips
    .map((c) => ({ label: c, text: treatmentExplainer(c) }))
    .filter((c): c is { label: string; text: string } => !!c.text);

  // מידע פרקטי - רק שורות עם תוכן.
  const practicalRows = {
    address: center.public_address?.trim() || null,
    hours: center.public_hours?.trim() || null,
    accessibility: center.public_accessibility?.trim() || null,
    languages: (entity?.languages ?? []).filter(Boolean),
    arrangements: (entity?.arrangements ?? []).filter(Boolean),
  };
  const hasPractical = !!(practicalRows.address || practicalRows.hours || practicalRows.accessibility
    || practicalRows.languages.length > 0 || practicalRows.arrangements.length > 0);
  const mapsHref = practicalRows.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(practicalRows.address)}`
    : null;

  const faqItems = (center.public_faq ?? []).filter((f) => f.q?.trim() && f.a?.trim());

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalOrganization",
    name: center.name,
    inLanguage: "he",
    url: `${BASE}/centers/${center.slug}`,
    // בלי logo: ה-URL חתום ל-24 שעות - קישור מת בקאש של הקרולרים + churn בתוכן
    ...(center.public_description ? { description: center.public_description } : {}),
    ...(center.public_founded_year ? { foundingDate: String(center.public_founded_year) } : {}),
    ...(center.public_team_size ? { numberOfEmployees: { "@type": "QuantitativeValue", value: center.public_team_size } } : {}),
    ...(center.public_city || center.public_address
      ? { address: { "@type": "PostalAddress", ...(center.public_address ? { streetAddress: center.public_address } : {}), ...(center.public_city ? { addressLocality: center.public_city } : {}), addressCountry: "IL" } }
      : {}),
    ...(websiteHref ? { sameAs: [websiteHref] } : {}), // מנורמל עם https - "example.com" גולמי אינו URL תקין בסכמה
    ...(center.public_phone ? { telephone: center.public_phone } : {}),
    ...(therapists.length > 0
      ? { employee: therapists.map((t) => ({ "@type": "Person", name: t.full_name, url: `${BASE}${therapistPath(t.id, t.full_name)}` })) }
      : {}),
  };

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 pb-24" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      {faqItems.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqItems.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }).replace(/</g, "\\u003c"),
        }} />
      )}
      {/* מסלול 2: צפייה בעמוד המרכז נספרת כצפייה בפרופיל הישות - מזינה את
          "צפיות בפרופיל" בפורטל המרכז (דה-דופ לפי session בצד השרת). */}
      {isEntity && entity && <TrackView therapistId={entity.id} source={viewSource} />}

      <Link href="/therapists" className="mb-6 inline-block text-sm text-[var(--muted)] hover:underline">← כל המטפלים</Link>

      {/* Hero */}
      <header className="flex flex-wrap items-start gap-6">
        {assets.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={assets.logoUrl} alt={`הלוגו של ${center.name}`}
            className="h-[120px] w-[120px] flex-shrink-0 rounded-3xl border border-[var(--line)] bg-white object-contain p-2.5 shadow-sm md:h-[150px] md:w-[150px]" />
        ) : (
          <div className="flex h-[120px] w-[120px] flex-shrink-0 items-center justify-center rounded-3xl text-4xl font-black text-white shadow-sm md:h-[150px] md:w-[150px]"
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
            {center.public_phone && (isEntity && entity ? (
              // לחיצת טלפון על מרכז-ישות נספרת בפורטל כלחיצת-קשר (כמו אצל מטפל)
              <CenterPhoneLink entityId={entity.id} phone={center.public_phone}
                className="inline-flex items-center gap-1.5 hover:underline" style={{ color: "var(--teal-dark)" }}>
                <Phone size={15} style={{ color: "var(--teal)" }} /> {center.public_phone}
              </CenterPhoneLink>
            ) : (
              <a href={`tel:${center.public_phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 hover:underline" style={{ color: "var(--teal-dark)" }}>
                <Phone size={15} style={{ color: "var(--teal)" }} /> {center.public_phone}
              </a>
            ))}
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

      {/* פס עובדות-אמון - מספרים גדולים, רק עובדות שמולאו */}
      {facts.length > 0 && (
        <section className="mt-10 rounded-[20px] border border-[var(--line)] bg-[var(--surface)] px-6 py-6">
          <div className={`grid gap-6 text-center ${facts.length === 2 ? "grid-cols-2" : facts.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
            {facts.map((f) => (
              <div key={f.label}>
                <div className="text-[clamp(1.9rem,3.4vw,2.6rem)] font-black leading-none" style={{ color: "var(--teal)" }}>{f.value}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-[var(--text-2)]">{f.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* דבר מנהל/ת המרכז - ה"אני מאמין": פנים ושם מאחורי המרכז */}
      {showDirector && (
        <section className="mt-10">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[.16em]" style={{ color: "var(--gold-dark)" }}>
            ה"אני מאמין" של המרכז
          </p>
          <div className="rounded-[22px] border border-[var(--line)] bg-white p-7 shadow-sm md:p-9"
            style={{ borderInlineStart: "4px solid var(--gold)" }}>
            <div className="flex flex-wrap items-start gap-5">
              {assets.directorPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={assets.directorPhotoUrl} alt={director.name ?? ""} className="h-[96px] w-[96px] flex-shrink-0 rounded-full object-cover shadow-sm" />
              ) : (
                <div className="flex h-[96px] w-[96px] flex-shrink-0 items-center justify-center rounded-full text-2xl font-extrabold text-white"
                  style={{ background: "linear-gradient(140deg,var(--teal),var(--teal-dark))" }}>
                  {initials(director.name ?? "")}
                </div>
              )}
              <div className="min-w-[240px] flex-1">
                <p className="whitespace-pre-line text-[16.5px] font-light leading-8 text-[var(--text)]">&ldquo;{director.note?.trim()}&rdquo;</p>
                <p className="mt-4 text-[15px] font-extrabold text-[var(--text)]">{director.name}</p>
                {director.role && <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{director.role}</p>}
              </div>
            </div>
          </div>
        </section>
      )}

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

          {/* מילון הגישות - הסבר בשפה פשוטה לכל גישה שהמרכז מציע (תוכן פלטפורמה) */}
          {explainedChips.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-[18px] border border-[var(--line)] bg-white">
              <p className="border-b border-[var(--line)] bg-[var(--surface)] px-5 py-3 text-[13px] font-extrabold text-[var(--text-2)]">
                📖 מה זה אומר בעצם? הסבר קצר על כל גישה
              </p>
              {explainedChips.map((c, i) => (
                <details key={c.label} className={`group ${i > 0 ? "border-t border-[var(--line)]" : ""}`}>
                  <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 text-[14.5px] font-bold text-[var(--text)] hover:bg-[var(--surface)] [&::-webkit-details-marker]:hidden">
                    {c.label}
                    <span className="text-[var(--faint)] transition-transform group-open:rotate-180">▾</span>
                  </summary>
                  <p className="px-5 pb-4 text-[14px] leading-7 text-[var(--text-2)]">{c.text}</p>
                </details>
              ))}
            </div>
          )}
        </section>
      )}

      {/* גלריית המרכז - תמונות אמיתיות של המקום (הכניסה, חדרי הטיפול) */}
      {galleryPhotos.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-1 flex items-center gap-2 text-[1.28rem] font-black tracking-tight text-[var(--text)]">
            <Camera size={20} style={{ color: "var(--teal)" }} /> המרכז שלנו
          </h2>
          <p className="mb-5 text-sm text-[var(--muted)]">הצצה למרחב שבו מתקיימים הטיפולים.</p>
          <div className={`grid gap-3 ${galleryPhotos.length === 1 ? "grid-cols-1 sm:max-w-xl" : galleryPhotos.length === 2 ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3"}`}>
            {galleryPhotos.map((g) => (
              <figure key={g.path} className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-white shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.url!} alt={g.caption || `תמונה מ${center.name}`} loading="lazy"
                  className="h-52 w-full object-cover md:h-56" />
                {g.caption && (
                  <figcaption className="px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--text-2)]">{g.caption}</figcaption>
                )}
              </figure>
            ))}
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

      {/* מידע פרקטי - השאלות הקונקרטיות של פונה: איפה, מתי, איך */}
      {hasPractical && (
        <section className="mt-14">
          <h2 className="mb-1 flex items-center gap-2 text-[1.28rem] font-black tracking-tight text-[var(--text)]">
            <MapPin size={20} style={{ color: "var(--teal)" }} /> מידע פרקטי
          </h2>
          <p className="mb-5 text-sm text-[var(--muted)]">כל מה שכדאי לדעת לפני שמגיעים.</p>
          <div className="grid gap-4 rounded-[20px] border border-[var(--line)] bg-white p-6 shadow-sm sm:grid-cols-2">
            {practicalRows.address && (
              <div className="flex items-start gap-3">
                <MapPin size={17} className="mt-0.5 flex-shrink-0" style={{ color: "var(--teal)" }} />
                <div>
                  <p className="text-[13px] font-extrabold text-[var(--text)]">כתובת</p>
                  <p className="mt-0.5 text-[14px] leading-6 text-[var(--text-2)]">{practicalRows.address}</p>
                  {mapsHref && (
                    <a href={mapsHref} target="_blank" rel="noopener noreferrer nofollow"
                      className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-bold hover:underline" style={{ color: "var(--teal-dark)" }}>
                      <Navigation size={12} /> ניווט במפות
                    </a>
                  )}
                </div>
              </div>
            )}
            {practicalRows.hours && (
              <div className="flex items-start gap-3">
                <Clock size={17} className="mt-0.5 flex-shrink-0" style={{ color: "var(--teal)" }} />
                <div>
                  <p className="text-[13px] font-extrabold text-[var(--text)]">שעות פעילות</p>
                  <p className="mt-0.5 whitespace-pre-line text-[14px] leading-6 text-[var(--text-2)]">{practicalRows.hours}</p>
                </div>
              </div>
            )}
            {practicalRows.accessibility && (
              <div className="flex items-start gap-3">
                <Accessibility size={17} className="mt-0.5 flex-shrink-0" style={{ color: "var(--teal)" }} />
                <div>
                  <p className="text-[13px] font-extrabold text-[var(--text)]">נגישות</p>
                  <p className="mt-0.5 whitespace-pre-line text-[14px] leading-6 text-[var(--text-2)]">{practicalRows.accessibility}</p>
                </div>
              </div>
            )}
            {practicalRows.languages.length > 0 && (
              <div className="flex items-start gap-3">
                <Languages size={17} className="mt-0.5 flex-shrink-0" style={{ color: "var(--teal)" }} />
                <div>
                  <p className="text-[13px] font-extrabold text-[var(--text)]">שפות טיפול</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {practicalRows.languages.map((l) => (
                      <span key={l} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-0.5 text-[12.5px] font-semibold text-[var(--text-2)]">{l}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {practicalRows.arrangements.length > 0 && (
              <div className="flex items-start gap-3 sm:col-span-2">
                <Handshake size={17} className="mt-0.5 flex-shrink-0" style={{ color: "var(--teal)" }} />
                <div>
                  <p className="text-[13px] font-extrabold text-[var(--text)]">הסדרים והחזרים</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {practicalRows.arrangements.map((a) => (
                      <span key={a} className="rounded-full border border-[#E9D6A6] px-2.5 py-0.5 text-[12.5px] font-semibold"
                        style={{ background: "var(--gold-pale)", color: "var(--gold-dark)" }}>{a}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* שאלות נפוצות */}
      {faqItems.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-1 flex items-center gap-2 text-[1.28rem] font-black tracking-tight text-[var(--text)]">
            <HelpCircle size={20} style={{ color: "var(--teal)" }} /> שאלות נפוצות
          </h2>
          <p className="mb-5 text-sm text-[var(--muted)]">תשובות מהמרכז לשאלות שחוזרות אצל פונים.</p>
          <div className="overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface)]">
            {faqItems.map((f, i) => (
              <details key={i} className={`group ${i > 0 ? "border-t border-[var(--line)]" : ""}`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 text-[15px] font-bold text-[var(--text)] hover:bg-white [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="flex-shrink-0 text-[var(--faint)] transition-transform group-open:rotate-180">▾</span>
                </summary>
                <p className="whitespace-pre-line bg-white px-6 pb-5 pt-1 text-[14.5px] leading-7 text-[var(--text-2)]">{f.a}</p>
              </details>
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
          מלאו שאלון קצר ומערכת ההתאמה החכמה תפנה אתכם ל{isEntity ? "מרכז" : "מטפל/ת המתאים/ה ביותר במרכז"} - לפי סוג הקושי, הגישה והאזור.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/adults" className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-base font-bold text-white transition hover:opacity-95"
            style={{ background: "linear-gradient(135deg,var(--teal-dark),var(--teal))", boxShadow: "0 8px 20px rgba(45,100,98,.25)" }}>
            למילוי שאלון התאמה <ArrowLeft size={16} />
          </Link>
          {canMessage && entity && (
            <CenterMessageButton entityId={entity.id} centerName={center.name} />
          )}
          {center.public_phone && (isEntity && entity ? (
            <CenterPhoneLink entityId={entity.id} phone={center.public_phone}
              className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[var(--teal-mid)] bg-white px-7 py-3 text-base font-bold transition hover:bg-[var(--teal-pale)]"
              style={{ color: "var(--teal-dark)" }}>
              <Phone size={16} /> יצירת קשר ישירה
            </CenterPhoneLink>
          ) : (
            <a href={`tel:${center.public_phone.replace(/[^\d+]/g, "")}`}
              className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[var(--teal-mid)] bg-white px-7 py-3 text-base font-bold transition hover:bg-[var(--teal-pale)]"
              style={{ color: "var(--teal-dark)" }}>
              <Phone size={16} /> יצירת קשר ישירה
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
