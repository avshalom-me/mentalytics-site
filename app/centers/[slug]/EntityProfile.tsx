import Link from "next/link";
import { MapPin, Globe, Phone, ArrowLeft, BadgeCheck, Clock, Accessibility, Languages, Handshake, Navigation } from "lucide-react";
import { treatmentExplainer } from "@/app/lib/treatment-explainers";
import type { PublicCenter } from "@/app/lib/center-public";
import TrackView from "@/app/therapists/[id]/TrackView";
import CenterMessageButton from "./CenterMessageButton";
import CenterPhoneLink from "./CenterPhoneLink";

// עמוד ציבורי למרכז מסלול-2 (מרכז כישות) - עיצוב "הקשתות": המנהלים למעלה
// בפורטרטים גדולים בצורת קשת (מוטיב ה-ח' מהלוגו), פסי צבע מלאים עם כיפות
// מעוגלות, פס עובדות "גשר", CTA כהה ופס קשר דביק בתחתית. כל סקציה נעלמת
// בשקט כשהשדות שלה לא מולאו בעורך הפרופיל - אין תוכן מומצא.

const BASE = "https://www.mentalytics.co.il";

const REGION_LABELS: Record<string, string> = {
  center: "מרכז", sharon: "שרון", jerusalem: "ירושלים", haifa: "חיפה",
  north: "צפון", south: "דרום", online: "אונליין", other: "אחר",
};
const regionLabel = (r: string) => REGION_LABELS[r] ?? r;

const AV_GRADIENTS = [
  "linear-gradient(140deg,#3D8C8A,#2A6462)",
  "linear-gradient(140deg,#D49018,#A87010)",
  "linear-gradient(140deg,#5AA6A0,#3D8C8A)",
  "linear-gradient(140deg,#4E9C93,#2A6462)",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).trim() || "•";
}

type EntityRow = {
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

type Assets = {
  logoUrl: string | null;
  team: { name: string; role: string; photoUrl: string | null }[];
  gallery: { path: string; caption: string | null; url: string | null }[];
  directorPhotoUrl: string | null;
};

// כותרת סקציה עם קשת זהב קטנה מתחת - חתימת העיצוב, במקום קו ישר.
function ArcTitle({ title, sub, arcColor = "var(--gold)" }: { title: string; sub?: string; arcColor?: string }) {
  return (
    <div className="mx-auto mb-10 max-w-[640px] px-5 text-center">
      <h2 className="relative inline-block pb-4 text-[clamp(1.55rem,2.6vw,2.05rem)] font-black tracking-tight text-[var(--text)]">
        {title}
        <span aria-hidden className="absolute bottom-0 left-1/2 h-[10px] w-16 -translate-x-1/2 rounded-t-[64px] border-2 border-b-0 opacity-85"
          style={{ borderColor: arcColor }} />
      </h2>
      {sub && <p className="mt-3 text-[15.5px] text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

export default function EntityProfile({ center, entity, assets, viewSource }: {
  center: PublicCenter;
  entity: EntityRow | null;
  assets: Assets;
  viewSource: "match" | "directory";
}) {
  const offerChips = Array.from(
    new Set([...(entity?.training_areas ?? []), ...(entity?.therapist_types ?? [])].map((s) => String(s).trim()).filter(Boolean)),
  );
  const regionChips = (entity?.regions ?? []).map((r) => String(r)).filter(Boolean);
  const showOffer = offerChips.length > 0 || regionChips.length > 0 || !!entity?.online;

  const website = center.public_website?.trim();
  const websiteHref = website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : null;

  const canMessage = !!(
    entity && entity.email && ["approved", "paying"].includes(entity.status) && entity.accepting_new_patients !== false
  );
  const galleryPhotos = assets.gallery.filter((g) => g.url);

  const yearsActive = center.public_founded_year ? Math.max(0, new Date().getFullYear() - center.public_founded_year) : null;
  const locationsCount = Math.max(1, Math.floor(Number(center.num_locations) || 1));
  const facts: { value: string; label: string }[] = [
    ...(yearsActive && yearsActive >= 2 ? [{ value: String(yearsActive), label: "שנות פעילות" }] : []),
    ...(center.public_team_size ? [{ value: String(center.public_team_size), label: "אנשי צוות" }] : []),
    ...(locationsCount > 1 ? [{ value: String(locationsCount), label: "סניפים" }] : []),
    ...(offerChips.length >= 3 ? [{ value: String(offerChips.length), label: "תחומי טיפול" }] : []),
  ];

  // המנהל/ת + הצוות המוביל = "האנשים שמובילים את המרכז" בקשתות למעלה.
  // המנהל/ת מופיעים כקשת רק כשיש להם תמונה או כשאין צוות בכלל: בפועל יש
  // מרכזים שרושמים בשדה המנהל את שני השמות יחד בלי תמונה, והתמונות האישיות
  // אצל חברי הצוות - קשת אינציאלים כפולה לצדם רק מרעישה. הציטוט תמיד מיוחס
  // למנהל/ת גם בלי קשת. כפילות שם מדויקת עם חבר צוות לא מוצגת פעמיים.
  const dirName = center.public_director?.name?.trim() || null;
  const teamPeople = assets.team
    .filter((m) => m.name?.trim() && m.name.trim() !== dirName)
    .map((m) => ({ name: m.name.trim(), role: m.role?.trim() ?? "", photoUrl: m.photoUrl, isDirector: false }));
  const includeDirector = !!dirName && (!!assets.directorPhotoUrl || teamPeople.length === 0);
  const people: { name: string; role: string; photoUrl: string | null; isDirector: boolean }[] = [
    ...(includeDirector && dirName ? [{
      name: dirName,
      role: center.public_director?.role?.trim() ?? "",
      photoUrl: assets.directorPhotoUrl,
      isDirector: true,
    }] : []),
    ...teamPeople,
  ];
  const quoteText = dirName ? (center.public_director?.note?.trim() || null) : null;

  const description = center.public_description?.trim() || null;
  const managers = center.public_managers?.trim() || null;

  const explainedChips = offerChips
    .map((c) => ({ label: c, text: treatmentExplainer(c) }))
    .filter((c): c is { label: string; text: string } => !!c.text);

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
    ...(description ? { description } : {}),
    ...(center.public_founded_year ? { foundingDate: String(center.public_founded_year) } : {}),
    ...(center.public_team_size ? { numberOfEmployees: { "@type": "QuantitativeValue", value: center.public_team_size } } : {}),
    ...(center.public_city || center.public_address
      ? { address: { "@type": "PostalAddress", ...(center.public_address ? { streetAddress: center.public_address } : {}), ...(center.public_city ? { addressLocality: center.public_city } : {}), addressCountry: "IL" } }
      : {}),
    ...(websiteHref ? { sameAs: [websiteHref] } : {}),
    ...(center.public_phone ? { telephone: center.public_phone } : {}),
  };

  const phone = center.public_phone?.trim() || null;
  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null;

  return (
    <main dir="rtl" className="pb-32" style={{ fontFamily: "'Heebo', sans-serif" }}>
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
      {/* צפייה בעמוד נספרת כצפייה בפרופיל הישות (דה-דופ session בצד השרת) */}
      {entity && <TrackView therapistId={entity.id} source={viewSource} />}

      {/* זהות המרכז - ממורכז */}
      <header className="mx-auto max-w-[880px] px-5 pt-10 text-center">
        <Link href="/centers" className="mb-7 inline-block text-[13px] text-[var(--muted)] hover:underline">← לכל המרכזים הטיפוליים</Link>
        <div className="mb-6 flex justify-center">
          {assets.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={assets.logoUrl} alt={`הלוגו של ${center.name}`}
              className="h-[104px] w-[104px] rounded-[26px] border border-[var(--line)] bg-white object-contain p-2.5 shadow-[0_10px_30px_rgba(42,100,98,.10)]" />
          ) : (
            <div className="flex h-[104px] w-[104px] items-center justify-center rounded-[26px] text-3xl font-black text-white shadow-[0_10px_30px_rgba(42,100,98,.14)]"
              style={{ background: "linear-gradient(140deg,var(--teal),var(--teal-dark))" }}>
              {initials(center.name)}
            </div>
          )}
        </div>
        <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--teal-pale)] px-4 py-1.5 text-[12.5px] font-extrabold uppercase tracking-[.16em] text-[var(--teal)]">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--teal)]" />
          מרכז טיפולי{center.public_city ? ` · ${center.public_city}` : ""}
        </p>
        <h1 className="text-[clamp(2.2rem,4.4vw,3.4rem)] font-black leading-[1.07] tracking-tight text-[var(--text)]">{center.name}</h1>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-[15.5px] text-[var(--text-2)]">
          {center.public_city && (
            <span className="inline-flex items-center gap-1.5"><MapPin size={16} style={{ color: "var(--teal)" }} /> {center.public_city}</span>
          )}
          {phone && telHref && (entity ? (
            <CenterPhoneLink entityId={entity.id} phone={phone}
              className="inline-flex items-center gap-1.5 hover:underline" style={{ color: "var(--teal-dark)" }}>
              <Phone size={16} style={{ color: "var(--teal)" }} /> {phone}
            </CenterPhoneLink>
          ) : (
            <a href={telHref} className="inline-flex items-center gap-1.5 hover:underline" style={{ color: "var(--teal-dark)" }}>
              <Phone size={16} style={{ color: "var(--teal)" }} /> {phone}
            </a>
          ))}
          {websiteHref && (
            <a href={websiteHref} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 hover:underline" style={{ color: "var(--teal-dark)" }}>
              <Globe size={16} style={{ color: "var(--teal)" }} /> אתר המרכז
            </a>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E9D6A6] px-3.5 py-1 text-xs font-extrabold"
            style={{ background: "var(--gold-pale)", color: "var(--gold-dark)" }}>
            <BadgeCheck size={14} /> מרכז מאומת
          </span>
        </div>
      </header>

      {/* פס האנשים - המנהל/ת והצוות המוביל בקשתות גדולות */}
      {people.length > 0 && (
        <section className="relative mt-11 px-5"
          style={{
            background: "linear-gradient(180deg,#F2FAF8 0%,var(--teal-pale) 100%)",
            borderRadius: "50% 50% 0 0 / 64px 64px 0 0",
            paddingTop: "72px",
            paddingBottom: facts.length > 0 ? "126px" : "64px",
          }}>
          <div className="mx-auto max-w-[1100px] text-center">
            <p className="mb-9 text-xs font-extrabold uppercase tracking-[.2em] text-[var(--teal-dark)]">האנשים שמובילים את המרכז</p>
            <div className="flex flex-wrap items-end justify-center gap-x-[clamp(26px,5vw,72px)] gap-y-10">
              {people.map((p, i) => (
                <div key={`${p.name}-${i}`}
                  className={`w-[min(238px,68vw)] ${people.length > 1 && i % 2 === 1 ? "sm:translate-y-[26px]" : ""}`}>
                  <div className="overflow-hidden border-8 border-white bg-white"
                    style={{
                      borderRadius: "999px 999px 26px 26px",
                      aspectRatio: "1 / 1.22",
                      boxShadow: p.isDirector ? "0 24px 56px rgba(42,100,98,.22)" : "0 18px 44px rgba(42,100,98,.16)",
                    }}>
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[44px] font-extrabold text-white"
                        style={{ background: AV_GRADIENTS[i % AV_GRADIENTS.length] }}>
                        {initials(p.name)}
                      </div>
                    )}
                  </div>
                  <p className="mt-5 text-[1.22rem] font-black tracking-tight text-[var(--text)]">{p.name}</p>
                  {p.role && <p className="mt-0.5 text-[14px] leading-6 text-[var(--text-2)]">{p.role}</p>}
                  {p.isDirector && (
                    <span className="mt-2.5 inline-block rounded-full bg-[var(--teal)] px-3.5 py-1 text-[11.5px] font-extrabold text-white">ניהול המרכז</span>
                  )}
                </div>
              ))}
            </div>

            {/* ה"אני מאמין" - רק כשמולאו שם + טקסט */}
            {quoteText && dirName && (
              <figure className="mx-auto mt-16 max-w-[60ch]">
                <span aria-hidden className="mb-5 block text-[64px] font-black leading-[.4] text-[var(--gold)]" style={{ fontFamily: "Georgia, serif" }}>”</span>
                <blockquote className="whitespace-pre-line text-[clamp(1.12rem,1.9vw,1.4rem)] font-light leading-[1.9] text-[var(--text)]">{quoteText}</blockquote>
                <figcaption className="mt-4 text-[14px] text-[var(--muted)]">
                  <b className="font-extrabold text-[var(--text)]">{dirName}</b>
                  {center.public_director?.role?.trim() ? ` · ${center.public_director.role.trim()}` : ""}
                </figcaption>
              </figure>
            )}
          </div>
        </section>
      )}

      {/* פס עובדות "גשר" - צף על תחתית פס האנשים כשהוא קיים */}
      {facts.length > 0 && (
        <div className={`px-5 ${people.length > 0 ? "relative z-[3] -mt-16" : "mt-12"}`}>
          <div className={`mx-auto grid max-w-[940px] gap-y-5 rounded-[26px] border border-[var(--line)] bg-white px-4 py-7 text-center shadow-[0_18px_44px_rgba(42,100,98,.12)] ${facts.length === 2 ? "grid-cols-2" : facts.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
            {facts.map((f) => (
              <div key={f.label}>
                <div className="text-[clamp(1.9rem,3vw,2.5rem)] font-black leading-none text-[var(--teal)]">{f.value}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-[var(--text-2)]">{f.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* על המרכז */}
      {(description || managers) && (
        <section className="mx-auto max-w-[1120px] px-5 pt-20">
          <ArcTitle title="על המרכז" />
          {description && (
            <p className="mx-auto max-w-[66ch] whitespace-pre-line text-center text-[17px] leading-[1.95] text-[var(--text-2)]">{description}</p>
          )}
          {managers && (
            <p className="mx-auto mt-5 max-w-[66ch] text-center text-[14.5px] text-[var(--text-2)]">
              <span className="font-bold text-[var(--text)]">ניהול המרכז:</span> {managers}
            </p>
          )}
        </section>
      )}

      {/* מה המרכז מציע */}
      {showOffer && (
        <section className="mx-auto max-w-[1120px] px-5 pt-20">
          <ArcTitle title="מה המרכז מציע" sub="התאמות מהשאלון מגיעות למרכז לפי התחומים והאזורים הבאים." />
          <div className="mx-auto flex max-w-[860px] flex-wrap justify-center gap-2.5">
            {offerChips.map((c) => (
              <span key={c} className="rounded-full border-[1.5px] border-[var(--teal-mid)] bg-white px-5 py-2 text-[14.5px] font-bold text-[var(--teal-dark)]">{c}</span>
            ))}
            {regionChips.map((r) => (
              <span key={r} className="rounded-full border border-[var(--line)] bg-white px-5 py-2 text-[14.5px] font-semibold text-[var(--text-2)]">📍 {regionLabel(r)}</span>
            ))}
            {entity?.online && (
              <span className="rounded-full border border-[var(--line)] bg-white px-5 py-2 text-[14.5px] font-semibold text-[var(--text-2)]">💻 אונליין</span>
            )}
          </div>

          {/* מילון הגישות - הסבר בשפה פשוטה (תוכן פלטפורמה) */}
          {explainedChips.length > 0 && (
            <div className="mx-auto mt-9 max-w-[860px] overflow-hidden rounded-[20px] border border-[var(--line)] bg-white">
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

      {/* גלריית המרכז - מסגרות קשת */}
      {galleryPhotos.length > 0 && (
        <section className="mx-auto max-w-[1120px] px-5 pt-20">
          <ArcTitle title="המרכז שלנו" sub="הצצה למרחב שבו מתקיימים הטיפולים." />
          <div className={`mx-auto grid gap-6 ${galleryPhotos.length === 1 ? "max-w-[360px] grid-cols-1" : galleryPhotos.length === 2 ? "max-w-[720px] grid-cols-2" : "max-w-[1020px] grid-cols-1 sm:grid-cols-3"}`}>
            {galleryPhotos.map((g) => (
              <figure key={g.path} className="text-center">
                <div className="overflow-hidden border border-[var(--line)] shadow-[0_10px_26px_rgba(42,100,98,.08)]"
                  style={{ borderRadius: "130px 130px 20px 20px", aspectRatio: "1 / 1.05" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.url!} alt={g.caption || `תמונה מ${center.name}`} loading="lazy" className="h-full w-full object-cover" />
                </div>
                {g.caption && <figcaption className="mt-3 text-[13px] font-bold text-[var(--text-2)]">{g.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* מידע פרקטי - פס זהב עם כיפה */}
      {hasPractical && (
        <section className="mt-24 px-5 py-[84px]"
          style={{ background: "linear-gradient(180deg,var(--gold-pale) 0%,#FBF3DE 100%)", borderRadius: "50% 50% 0 0 / 58px 58px 0 0" }}>
          <ArcTitle title="מידע פרקטי" sub="כל מה שכדאי לדעת לפני שמגיעים." arcColor="var(--teal)" />
          <div className="mx-auto grid max-w-[1080px] gap-4 sm:grid-cols-2">
            {practicalRows.address && (
              <div className="flex items-start gap-3.5 rounded-[20px] border border-[#EFE3C8] bg-white p-6 shadow-[0_6px_18px_rgba(168,112,16,.07)]">
                <MapPin size={18} className="mt-0.5 flex-shrink-0" style={{ color: "var(--gold-dark)" }} />
                <div>
                  <p className="text-[13.5px] font-extrabold text-[var(--text)]">כתובת</p>
                  <p className="mt-0.5 whitespace-pre-line text-[15px] leading-7 text-[var(--text-2)]">{practicalRows.address}</p>
                  {mapsHref && (
                    <a href={mapsHref} target="_blank" rel="noopener noreferrer nofollow"
                      className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-bold hover:underline" style={{ color: "var(--teal-dark)" }}>
                      <Navigation size={13} /> ניווט במפות
                    </a>
                  )}
                </div>
              </div>
            )}
            {practicalRows.hours && (
              <div className="flex items-start gap-3.5 rounded-[20px] border border-[#EFE3C8] bg-white p-6 shadow-[0_6px_18px_rgba(168,112,16,.07)]">
                <Clock size={18} className="mt-0.5 flex-shrink-0" style={{ color: "var(--gold-dark)" }} />
                <div>
                  <p className="text-[13.5px] font-extrabold text-[var(--text)]">שעות פעילות</p>
                  <p className="mt-0.5 whitespace-pre-line text-[15px] leading-7 text-[var(--text-2)]">{practicalRows.hours}</p>
                </div>
              </div>
            )}
            {practicalRows.accessibility && (
              <div className="flex items-start gap-3.5 rounded-[20px] border border-[#EFE3C8] bg-white p-6 shadow-[0_6px_18px_rgba(168,112,16,.07)]">
                <Accessibility size={18} className="mt-0.5 flex-shrink-0" style={{ color: "var(--gold-dark)" }} />
                <div>
                  <p className="text-[13.5px] font-extrabold text-[var(--text)]">נגישות</p>
                  <p className="mt-0.5 whitespace-pre-line text-[15px] leading-7 text-[var(--text-2)]">{practicalRows.accessibility}</p>
                </div>
              </div>
            )}
            {practicalRows.languages.length > 0 && (
              <div className="flex items-start gap-3.5 rounded-[20px] border border-[#EFE3C8] bg-white p-6 shadow-[0_6px_18px_rgba(168,112,16,.07)]">
                <Languages size={18} className="mt-0.5 flex-shrink-0" style={{ color: "var(--gold-dark)" }} />
                <div>
                  <p className="text-[13.5px] font-extrabold text-[var(--text)]">שפות טיפול</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {practicalRows.languages.map((l) => (
                      <span key={l} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-0.5 text-[12.5px] font-semibold text-[var(--text-2)]">{l}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {practicalRows.arrangements.length > 0 && (
              <div className="flex items-start gap-3.5 rounded-[20px] border border-[#EFE3C8] bg-white p-6 shadow-[0_6px_18px_rgba(168,112,16,.07)] sm:col-span-2">
                <Handshake size={18} className="mt-0.5 flex-shrink-0" style={{ color: "var(--gold-dark)" }} />
                <div>
                  <p className="text-[13.5px] font-extrabold text-[var(--text)]">הסדרים והחזרים</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {practicalRows.arrangements.map((a) => (
                      <span key={a} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-0.5 text-[12.5px] font-semibold text-[var(--text-2)]">{a}</span>
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
        <section className="mx-auto max-w-[1120px] px-5 pt-20">
          <ArcTitle title="שאלות נפוצות" sub="תשובות מהמרכז לשאלות שחוזרות אצל פונים." />
          <div className="mx-auto max-w-[760px]">
            {faqItems.map((f, i) => (
              <details key={i} className="group mb-2.5 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] transition-colors open:border-[var(--teal)] open:bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-[15.5px] font-bold text-[var(--text)] [&::-webkit-details-marker]:hidden" style={{ paddingInline: "22px" }}>
                  {f.q}
                  <span className="flex-shrink-0 text-[var(--faint)] transition-transform group-open:rotate-180">▾</span>
                </summary>
                <p className="whitespace-pre-line text-[14.5px] leading-7 text-[var(--text-2)]" style={{ paddingInline: "22px", paddingBottom: "18px" }}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* CTA כהה - הסגירה */}
      <section className="relative mt-24 overflow-hidden px-5 py-24 text-center"
        style={{ background: "linear-gradient(135deg,#245654 0%,var(--teal-dark) 55%,#31716F 100%)", borderRadius: "50% 50% 0 0 / 58px 58px 0 0" }}>
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 1400 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <path d="M 100 400 A 420 420 0 0 1 940 400" fill="none" stroke="rgba(255,255,255,.10)" strokeWidth="2" />
          <path d="M 500 400 A 380 380 0 0 1 1260 400" fill="none" stroke="rgba(243,201,107,.18)" strokeWidth="2" />
        </svg>
        <div className="relative mx-auto max-w-[720px]">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[rgba(243,201,107,.4)] px-4 py-1.5 text-[11.5px] font-extrabold uppercase tracking-[.18em] text-[#F3C96B]">
            ✦ פנייה למרכז
          </span>
          <h2 className="text-[clamp(1.7rem,3vw,2.4rem)] font-black tracking-tight text-white">
            מתאימים לך את הטיפול הנכון ב{center.name}
          </h2>
          <p className="mx-auto mt-3.5 max-w-[52ch] text-[16px] leading-[1.9] text-[#CFE5E3]">
            מלאו שאלון קצר ומערכת ההתאמה החכמה תפנה אתכם למרכז - לפי סוג הקושי, הגישה והאזור.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/adults" className="inline-flex items-center gap-2 rounded-full bg-[var(--gold)] px-8 py-3.5 text-base font-extrabold text-white shadow-[0_10px_28px_rgba(0,0,0,.25)] transition hover:bg-[#C4850F]">
              למילוי שאלון התאמה <ArrowLeft size={16} />
            </Link>
            {canMessage && entity && (
              <CenterMessageButton entityId={entity.id} centerName={center.name}
                className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[rgba(255,255,255,.45)] bg-transparent px-7 py-3.5 text-base font-bold text-white transition hover:bg-[rgba(255,255,255,.1)]" />
            )}
            {phone && telHref && (entity ? (
              <CenterPhoneLink entityId={entity.id} phone={phone}
                className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[rgba(255,255,255,.45)] px-7 py-3.5 text-base font-bold text-white transition hover:bg-[rgba(255,255,255,.1)]">
                <Phone size={16} /> {phone}
              </CenterPhoneLink>
            ) : (
              <a href={telHref} className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[rgba(255,255,255,.45)] px-7 py-3.5 text-base font-bold text-white transition hover:bg-[rgba(255,255,255,.1)]">
                <Phone size={16} /> {phone}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* פס קשר דביק - קבוע בתחתית המסך */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-white/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto flex max-w-[720px] items-center justify-center gap-2.5 px-4 py-2.5">
          <Link href="/adults"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[14px] font-bold text-white transition hover:opacity-95 sm:flex-none sm:px-7"
            style={{ background: "linear-gradient(135deg,var(--teal-dark),var(--teal))", boxShadow: "0 6px 16px rgba(42,100,98,.22)" }}>
            לשאלון התאמה
          </Link>
          {canMessage && entity && (
            <CenterMessageButton entityId={entity.id} centerName={center.name} label="הודעה למרכז"
              className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[var(--teal-mid)] bg-white px-4 py-2.5 text-[14px] font-bold text-[var(--teal-dark)] transition hover:bg-[var(--teal-pale)] sm:px-6" />
          )}
          {phone && telHref && (entity ? (
            <CenterPhoneLink entityId={entity.id} phone={phone}
              className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[var(--teal-mid)] bg-white px-4 py-2.5 text-[14px] font-bold text-[var(--teal-dark)] transition hover:bg-[var(--teal-pale)] sm:px-6">
              <Phone size={15} /> חיוג
            </CenterPhoneLink>
          ) : (
            <a href={telHref} className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[var(--teal-mid)] bg-white px-4 py-2.5 text-[14px] font-bold text-[var(--teal-dark)] transition hover:bg-[var(--teal-pale)] sm:px-6">
              <Phone size={15} /> חיוג
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
