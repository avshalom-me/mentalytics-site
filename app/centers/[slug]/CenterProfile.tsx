import Link from "next/link";
import { MapPin, Globe, Phone, BadgeCheck, Clock, Accessibility, Languages, Handshake, Navigation, ArrowLeft } from "lucide-react";
import { treatmentExplainer } from "@/app/lib/treatment-explainers";
import type { PublicCenter } from "@/app/lib/center-public";
import { telHref as telHrefFor, phoneNationalDigits } from "@/app/lib/phone";
import { therapistPath } from "@/app/lib/therapist-url";
import type { PublicTherapist } from "@/app/therapists/TherapistsClient";
import TherapistResultCard from "@/app/components/TherapistResultCard";
import TrackView from "@/app/therapists/[id]/TrackView";
import { CenterPageView, CenterWebsiteLink } from "@/app/components/CenterTracking";
import CenterMessageButton from "./CenterMessageButton";
import CenterPhoneLink from "./CenterPhoneLink";
import CenterWhatsAppLink from "./CenterWhatsAppLink";

// העמוד הציבורי של מרכז טיפולי, בעיצוב "הקשתות": המנהלים למעלה בפורטרטים
// גדולים בצורת קשת (מוטיב ה-ח' מהלוגו), פס אנשים עם כיפה מעוגלת, פס עובדות
// "גשר", עמודת צד דביקה בדסקטופ (לוגו גדול, יצירת קשר ומידע פרקטי), CTA כהה
// ופס קשר דביק במובייל. משרת את שני המסלולים, עם הבדל מהותי אחד:
//   מסלול 2 (מרכז כישות)  - הפנייה ישירה למרכז (וואטסאפ/הודעה/טלפון עם מעקב
//                            על ישות-המרכז), בלי שאלון התאמה ובלי רשימת מטפלים.
//   מסלול 1 (מטפלים בנפרד) - רשימת המטפלים עם קישור לעמוד האישי היא הלב;
//                            שאלון ההתאמה נשאר (ההתאמות מגיעות למטפלים), אין
//                            הודעה/מעקב ברמת המרכז (אין שורת ישות).
// כל סקציה נעלמת בשקט כשהשדות שלה לא מולאו בעורך הפרופיל - אין תוכן מומצא.

const BASE = "https://www.mentalytics.co.il";

const REGION_LABELS: Record<string, string> = {
  center: "מרכז", sharon: "שרון", jerusalem: "ירושלים", haifa: "חיפה",
  north: "צפון", south: "דרום", online: "אונליין", other: "אחר",
};
const regionLabel = (r: string) => REGION_LABELS[r] ?? r;

// מטפל/ת ללא תמונה מקבל/ת שרטוט כללי במקום ראשי תיבות. המגדר נלקח מהתפקיד
// שהמרכז עצמו כתב על אותו אדם ("מרכזת תחום אוטיזם" מול "מרכז תחום קשב") -
// מילים של המרכז, לא ניחוש מהשם הפרטי, שבו קל לטעות ולהציג אדם כמין שאינו
// שלו. כשאין סימן מגדרי ברור - שרטוט ניטרלי, לא ברירת מחדל גברית.
//
// הנשי נבדק ראשון: "מנהלת" מכילה את "מנהל" כתת-מחרוזת, וסדר הפוך היה מסמן כל
// מנהלת כגבר.
const FEMININE_ROLE = /(מנהלת|מרכזת|רכזת|מטפלת|פסיכולוגית|פסיכיאטרית|עובדת|יועצת|מדריכה|אחראית|סגנית|מייסדת|שותפה|קלינאית|דיאטנית|מאבחנת|מומחית|מרצה|רופאה)/;
const MASCULINE_ROLE = /(מנהל|מרכז|רכז|מטפל|פסיכולוג|פסיכיאטר|עובד|יועץ|מדריך|אחראי|סגן|מייסד|שותף|קלינאי|דיאטן|מאבחן|מומחה|רופא)/;
// רשומה אחת שמאגדת שני אנשים ("שני כהן וד\"ר איתי אדרס") - כל שרטוט מגדרי
// יהיה שגוי לגבי אחד מהם.
const PAIRED_NAME = /\sו[א-ת"']/;

function avatarFor(name: string, role: string): string {
  if (PAIRED_NAME.test(name)) return "/avatar-neutral.svg";
  if (FEMININE_ROLE.test(role)) return "/avatar-female.svg";
  if (MASCULINE_ROLE.test(role)) return "/avatar-male.svg";
  return "/avatar-neutral.svg";
}

// נוסח הפתיחה בוואטסאפ - גרסת מרכז (רבים) לנוסח של מטפל בודד מ-phone.ts.
const CENTER_WHATSAPP_MESSAGE = 'שלום, הגעתי אליכם דרך אתר "טיפול חכם", אשמח לשמוע פרטים לגבי טיפול במרכז';

const WA_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

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
    <div className="mx-auto mb-10 max-w-[680px] px-5 text-center">
      <h2 className="relative inline-block pb-4 text-[clamp(1.7rem,2.6vw,2.2rem)] font-black tracking-tight text-[var(--text)]">
        {title}
        <span aria-hidden className="absolute bottom-0 left-1/2 h-[10px] w-16 -translate-x-1/2 rounded-t-[64px] border-2 border-b-0 opacity-85"
          style={{ borderColor: arcColor }} />
      </h2>
      {sub && <p className="mt-3 text-[16px] text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

export default function CenterProfile({ center, entity, assets, viewSource, therapists }: {
  center: PublicCenter;
  entity: EntityRow | null;
  assets: Assets;
  viewSource: "match" | "directory";
  therapists: PublicTherapist[];
}) {
  const isEntity = center.billing_track === "center_entity";
  const offerChips = Array.from(
    new Set([...(entity?.training_areas ?? []), ...(entity?.therapist_types ?? [])].map((s) => String(s).trim()).filter(Boolean)),
  );
  const regionChips = (entity?.regions ?? []).map((r) => String(r)).filter(Boolean);
  const showOffer = offerChips.length > 0 || regionChips.length > 0 || !!entity?.online;

  const website = center.public_website?.trim();
  const websiteHref = website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : null;

  // הודעה דרך האתר, בשני המסלולים:
  //   מסלול 2 - דרך שורת הישות, כך שהפנייה נספרת גם בסטטיסטיקות הפורטל.
  //   מסלול 1 - אין שורת ישות; הפנייה נשלחת למייל המרכז דרך /api/contact-center.
  const canMessageEntity = !!(
    entity && entity.email && ["approved", "paying"].includes(entity.status) && entity.accepting_new_patients !== false
  );
  const canMessageCenter = !isEntity && center.has_contact_email;
  const canMessage = canMessageEntity || canMessageCenter;
  // ה-props שכפתור ההודעה מקבל - ישות אם יש, אחרת חשבון המרכז.
  const messageTarget = canMessageEntity && entity ? { entityId: entity.id } : { centerId: center.id };
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
    ...(therapists.length > 0
      ? { employee: therapists.map((t) => ({ "@type": "Person", name: t.full_name, url: `${BASE}${therapistPath(t.id, t.full_name)}` })) }
      : {}),
  };

  const phone = center.public_phone?.trim() || null;
  // ולידציה כמו אצל מטפלים (phone.ts): שדה חופשי עם מייל/טקסט לא מייצר כפתור מת.
  const telHref = telHrefFor(phone);
  const waDigits = phoneNationalDigits(phone);
  const waHref = waDigits ? `https://wa.me/972${waDigits}?text=${encodeURIComponent(CENTER_WHATSAPP_MESSAGE)}` : null;

  // כפתורי קשר משותפים (פס דביק במובייל + CTA). מוצג רק מה שקיים בפועל.
  const hasAnyContact = !!(waHref || telHref || canMessage);

  return (
    <main dir="rtl" className="pb-28 lg:pb-0"
      style={{
        fontFamily: "'Heebo', sans-serif",
        background:
          "radial-gradient(ellipse at 88% 0%, rgba(212,144,24,.07) 0%, transparent 46%), radial-gradient(ellipse at 6% 34%, rgba(61,140,138,.07) 0%, transparent 44%), radial-gradient(ellipse at 92% 78%, rgba(240,168,172,.05) 0%, transparent 40%), #FBFAF7",
      }}>
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
      {/* תנועת העמוד הציבורי - אחיד לשני המסלולים; במסלול 1 זה מדד הצפיות
          היחיד של העמוד (אין שורת ישות). ראו המיגרציה 20260820. */}
      <CenterPageView centerId={center.id} track={isEntity ? "center_entity" : "per_therapist"} />

      <div className="mx-auto max-w-[1380px] px-5 lg:grid lg:grid-cols-[minmax(0,1fr)_364px] lg:items-start lg:gap-9">

        {/* ===== עמודת התוכן ===== */}
        <div className="min-w-0">

          {/* זהות המרכז */}
          <header className="pt-9 text-center">
            {/* /therapists ולא /centers - זה האינדקס למטופלים; /centers הוא עמוד שיווקי למרכזים */}
            <Link href="/therapists" className="mb-7 inline-block text-[13.5px] text-[var(--muted)] hover:underline">← כל המטפלים</Link>
            {/* במובייל הלוגו כאן; בדסקטופ הוא גדול ודביק בעמודת הצד */}
            <div className="mb-6 flex justify-center lg:hidden">
              {assets.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={assets.logoUrl} alt={`הלוגו של ${center.name}`}
                  className="h-[112px] w-[112px] rounded-[26px] border border-[var(--line)] bg-white object-contain p-2.5 shadow-[0_10px_30px_rgba(42,100,98,.10)]" />
              ) : (
                <div className="flex h-[112px] w-[112px] items-center justify-center rounded-[26px] text-3xl font-black text-white shadow-[0_10px_30px_rgba(42,100,98,.14)]"
                  style={{ background: "linear-gradient(140deg,var(--teal),var(--teal-dark))" }}>
                  {initials(center.name)}
                </div>
              )}
            </div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--teal-pale)] py-1.5 text-[13px] font-extrabold uppercase tracking-[.16em] text-[var(--teal)]" style={{ paddingInline: "18px" }}>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--teal)]" />
              מרכז טיפולי{center.public_city ? ` · ${center.public_city}` : ""}
            </p>
            <h1 className="text-[clamp(2.4rem,4.5vw,3.6rem)] font-black leading-[1.07] tracking-tight text-[var(--text)]">{center.name}</h1>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[16px] text-[var(--text-2)]">
              {center.public_city && (
                <span className="inline-flex items-center gap-1.5"><MapPin size={17} style={{ color: "var(--teal)" }} /> {center.public_city}</span>
              )}
              {phone && telHref && (
                <CenterPhoneLink entityId={entity?.id} centerId={center.id} phone={phone}
                  className="inline-flex items-center gap-1.5 hover:underline" style={{ color: "var(--teal-dark)" }}>
                  <Phone size={17} style={{ color: "var(--teal)" }} /> {phone}
                </CenterPhoneLink>
              )}
              {websiteHref && (
                <CenterWebsiteLink centerId={center.id} href={websiteHref} className="inline-flex items-center gap-1.5 hover:underline" style={{ color: "var(--teal-dark)" }}>
                  <Globe size={17} style={{ color: "var(--teal)" }} /> אתר המרכז
                </CenterWebsiteLink>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E9D6A6] px-3.5 py-1 text-[12.5px] font-extrabold"
                style={{ background: "var(--gold-pale)", color: "var(--gold-dark)" }}>
                <BadgeCheck size={15} /> מרכז מאומת
              </span>
            </div>
          </header>

          {/* פס האנשים - המנהל/ת והצוות המוביל בקשתות גדולות */}
          {people.length > 0 && (
            <section className="relative mt-11 px-5"
              style={{
                background: "linear-gradient(180deg,#F0FAF7 0%,var(--teal-pale) 100%)",
                borderRadius: "50% 50% 30px 30px / 64px 64px 30px 30px",
                paddingTop: "72px",
                paddingBottom: facts.length > 0 ? "126px" : "64px",
              }}>
              <div className="mx-auto max-w-[1100px] text-center">
                <p className="mb-9 text-[12.5px] font-extrabold uppercase tracking-[.2em] text-[var(--teal-dark)]">האנשים שמובילים את המרכז</p>
                <div className="flex flex-wrap items-end justify-center gap-x-[clamp(26px,4.5vw,64px)] gap-y-10">
                  {people.map((p, i) => (
                    <div key={`${p.name}-${i}`}
                      className={`w-[min(248px,68vw)] ${people.length > 1 && i % 2 === 1 ? "sm:translate-y-[26px]" : ""}`}>
                      <div className="overflow-hidden border-8 border-white bg-white"
                        style={{
                          borderRadius: "20px",
                          aspectRatio: "1 / 1",
                          boxShadow: p.isDirector ? "0 24px 56px rgba(42,100,98,.22)" : "0 18px 44px rgba(42,100,98,.16)",
                        }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.photoUrl ?? avatarFor(p.name, p.role)} alt={p.name}
                          className="h-full w-full object-cover" />
                      </div>
                      <p className="mt-5 text-[1.3rem] font-black tracking-tight text-[var(--text)]">{p.name}</p>
                      {p.role && <p className="mt-1 text-[15px] leading-6 text-[var(--text-2)]">{p.role}</p>}
                      {p.isDirector && (
                        <span className="mt-2.5 inline-block rounded-full bg-[var(--teal)] px-3.5 py-1 text-[12px] font-extrabold text-white">ניהול המרכז</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* ה"אני מאמין" - רק כשמולאו שם + טקסט */}
                {quoteText && dirName && (
                  <figure className="mx-auto mt-16 max-w-[62ch]">
                    <span aria-hidden className="mb-5 block text-[68px] font-black leading-[.4] text-[var(--gold)]" style={{ fontFamily: "Georgia, serif" }}>”</span>
                    <blockquote className="whitespace-pre-line text-[clamp(1.2rem,2vw,1.5rem)] font-light leading-[1.9] text-[var(--text)]">{quoteText}</blockquote>
                    <figcaption className="mt-4 text-[15px] text-[var(--muted)]">
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
            <div className={`px-2 sm:px-5 ${people.length > 0 ? "relative z-[3] -mt-16" : "mt-12"}`}>
              <div className={`mx-auto grid max-w-[940px] gap-y-5 rounded-[26px] border border-[var(--line)] bg-white px-4 py-8 text-center shadow-[0_18px_44px_rgba(42,100,98,.12)] ${facts.length === 2 ? "grid-cols-2" : facts.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
                {facts.map((f) => (
                  <div key={f.label}>
                    <div className="text-[clamp(2.1rem,3vw,2.7rem)] font-black leading-none text-[var(--teal)]">{f.value}</div>
                    <div className="mt-2 text-[14px] font-semibold text-[var(--text-2)]">{f.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* על המרכז */}
          {(description || managers) && (
            <section className="pt-20">
              <ArcTitle title="על המרכז" />
              {description && (
                <p className="mx-auto max-w-[72ch] whitespace-pre-line text-center text-[18px] leading-[2] text-[var(--text-2)]">{description}</p>
              )}
              {managers && (
                <p className="mx-auto mt-6 max-w-[72ch] text-center text-[15.5px] text-[var(--text-2)]">
                  <span className="font-bold text-[var(--text)]">ניהול המרכז:</span> {managers}
                </p>
              )}
            </section>
          )}

          {/* המטפלים של המרכז (מסלול 1) - הלב של העמוד: לכל מטפל/ת עמוד אישי */}
          {!isEntity && (
            <section id="therapists" className="pt-20" style={{ scrollMarginTop: "90px" }}>
              <ArcTitle title={`המטפלים של ${center.name}`} sub="לכל מטפל/ת עמוד אישי עם פרטים מלאים ויצירת קשר ישירה." />
              {therapists.length === 0 ? (
                <div className="mx-auto max-w-[680px] rounded-2xl border border-[var(--line)] bg-white p-6 text-center text-[15.5px] leading-8 text-[var(--text-2)]">
                  רשימת המטפלים של המרכז תתעדכן בקרוב. בינתיים אפשר למלא{" "}
                  <Link href="/adults" className="font-semibold text-[var(--teal-dark)] hover:underline">שאלון התאמה</Link> ולקבל התאמה אישית.
                </div>
              ) : (
                <div className={`grid gap-4 ${therapists.length === 1 ? "mx-auto max-w-[380px]" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
                  {therapists.map((t) => <TherapistResultCard key={t.id} t={t} backHref={`/centers/${center.slug}`} />)}
                </div>
              )}
            </section>
          )}

          {/* מה המרכז מציע */}
          {showOffer && (
            <section className="pt-20">
              <ArcTitle title="מה המרכז מציע" sub="התאמות מהשאלון מגיעות למרכז לפי התחומים והאזורים הבאים." />
              <div className="mx-auto flex max-w-[920px] flex-wrap justify-center gap-2.5">
                {offerChips.map((c) => (
                  <span key={c} className="rounded-full border-[1.5px] border-[var(--teal-mid)] bg-white px-5 py-2 text-[15px] font-bold text-[var(--teal-dark)]">{c}</span>
                ))}
                {regionChips.map((r) => (
                  <span key={r} className="rounded-full border border-[var(--line)] bg-white px-5 py-2 text-[15px] font-semibold text-[var(--text-2)]">📍 {regionLabel(r)}</span>
                ))}
                {entity?.online && (
                  <span className="rounded-full border border-[var(--line)] bg-white px-5 py-2 text-[15px] font-semibold text-[var(--text-2)]">💻 אונליין</span>
                )}
              </div>

              {/* מילון הגישות - הסבר בשפה פשוטה (תוכן פלטפורמה) */}
              {explainedChips.length > 0 && (
                <div className="mx-auto mt-9 max-w-[920px] overflow-hidden rounded-[20px] border border-[var(--line)] bg-white">
                  <p className="border-b border-[var(--line)] bg-[var(--surface)] px-6 py-3.5 text-[14px] font-extrabold text-[var(--text-2)]">
                    📖 מה זה אומר בעצם? הסבר קצר על כל גישה
                  </p>
                  {explainedChips.map((c, i) => (
                    <details key={c.label} className={`group ${i > 0 ? "border-t border-[var(--line)]" : ""}`}>
                      <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-4 text-[15.5px] font-bold text-[var(--text)] hover:bg-[var(--surface)] [&::-webkit-details-marker]:hidden">
                        {c.label}
                        <span className="text-[var(--faint)] transition-transform group-open:rotate-180">▾</span>
                      </summary>
                      <p className="px-6 text-[15px] leading-8 text-[var(--text-2)]" style={{ paddingBottom: "18px" }}>{c.text}</p>
                    </details>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* גלריית המרכז - מסגרות קשת */}
          {galleryPhotos.length > 0 && (
            <section className="pt-20">
              <ArcTitle title="המרכז שלנו" sub="הצצה למרחב שבו מתקיימים הטיפולים." />
              <div className={`mx-auto grid gap-6 ${galleryPhotos.length === 1 ? "max-w-[380px] grid-cols-1" : galleryPhotos.length === 2 ? "max-w-[760px] grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}>
                {galleryPhotos.map((g) => (
                  <figure key={g.path} className="text-center">
                    <div className="overflow-hidden border border-[var(--line)] bg-white shadow-[0_10px_26px_rgba(42,100,98,.08)]"
                      style={{ borderRadius: "130px 130px 20px 20px", aspectRatio: "1 / 1.05" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g.url!} alt={g.caption || `תמונה מ${center.name}`} loading="lazy" className="h-full w-full object-cover" />
                    </div>
                    {g.caption && <figcaption className="mt-3 text-[13.5px] font-bold text-[var(--text-2)]">{g.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            </section>
          )}

          {/* שאלות נפוצות */}
          {faqItems.length > 0 && (
            <section className="pt-20">
              <ArcTitle title="שאלות נפוצות" sub="תשובות מהמרכז לשאלות שחוזרות אצל פונים." />
              <div className="mx-auto max-w-[800px]">
                {faqItems.map((f, i) => (
                  <details key={i} className="group mb-2.5 rounded-[16px] border border-[var(--line)] bg-white transition-colors open:border-[var(--teal)]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-[16.5px] font-bold text-[var(--text)] [&::-webkit-details-marker]:hidden" style={{ paddingInline: "22px" }}>
                      {f.q}
                      <span className="flex-shrink-0 text-[var(--faint)] transition-transform group-open:rotate-180">▾</span>
                    </summary>
                    <p className="whitespace-pre-line text-[15px] leading-8 text-[var(--text-2)]" style={{ paddingInline: "22px", paddingBottom: "18px" }}>{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ===== עמודת הצד (דסקטופ: דביקה; מובייל: המידע הפרקטי בלבד, בסוף הזרימה).
            בלי מידע פרקטי אין לה מה להציג במובייל - מוסתרת כדי לא להשאיר רווח ריק ===== */}
        <aside className={`mt-16 lg:sticky lg:top-24 lg:mt-9 lg:self-start lg:block ${hasPractical ? "" : "hidden"}`}>
          <div className="flex flex-col gap-5">

            {/* הלוגו - גדול, נשאר על המסך בגלילה */}
            <div className="hidden rounded-[24px] border border-[var(--line)] bg-white p-7 text-center shadow-[0_14px_36px_rgba(42,100,98,.09)] lg:block">
              {assets.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={assets.logoUrl} alt={`הלוגו של ${center.name}`} className="mx-auto h-[188px] w-full object-contain" />
              ) : (
                <div className="mx-auto flex h-[168px] w-[168px] items-center justify-center rounded-[32px] text-5xl font-black text-white"
                  style={{ background: "linear-gradient(140deg,var(--teal),var(--teal-dark))" }}>
                  {initials(center.name)}
                </div>
              )}
              <p className="mt-5 text-[17px] font-black tracking-tight text-[var(--text)]">{center.name}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#E9D6A6] px-3.5 py-1 text-[12px] font-extrabold"
                style={{ background: "var(--gold-pale)", color: "var(--gold-dark)" }}>
                <BadgeCheck size={14} /> מרכז מאומת
              </span>
            </div>

            {/* יצירת קשר */}
            {hasAnyContact && (
              <div className="hidden rounded-[24px] border border-[var(--line)] bg-white p-6 shadow-[0_14px_36px_rgba(42,100,98,.09)] lg:block">
                <p className="mb-4 text-[13px] font-extrabold uppercase tracking-[.14em] text-[var(--muted)]">יצירת קשר</p>
                {phone && telHref && (
                  <CenterPhoneLink entityId={entity?.id} centerId={center.id} phone={phone} className="block text-[1.55rem] font-black tracking-wide text-[var(--text)] hover:text-[var(--teal-dark)]">
                    {phone}
                  </CenterPhoneLink>
                )}
                <div className="mt-4 flex flex-col gap-2.5">
                  {waHref && (
                    <CenterWhatsAppLink entityId={entity?.id} centerId={center.id} href={waHref}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-green-500 px-5 py-3 text-[15px] font-extrabold text-white transition hover:bg-green-600">
                      {WA_SVG} שליחת וואטסאפ
                    </CenterWhatsAppLink>
                  )}
                  {canMessage && (
                    <CenterMessageButton {...messageTarget} centerName={center.name} label="הודעה דרך האתר"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border-[1.5px] border-[var(--teal-mid)] bg-white px-5 py-3 text-[15px] font-extrabold text-[var(--teal-dark)] transition hover:bg-[var(--teal-pale)]" />
                  )}
                  {telHref && (
                    <CenterPhoneLink entityId={entity?.id} centerId={center.id} phone={phone!}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--teal)] px-5 py-3 text-[15px] font-extrabold text-white transition hover:bg-[var(--teal-dark)]">
                      <Phone size={17} /> חיוג למרכז
                    </CenterPhoneLink>
                  )}
                </div>
                {websiteHref && (
                  <CenterWebsiteLink centerId={center.id} href={websiteHref}
                    className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-[var(--teal-dark)] hover:underline">
                    <Globe size={14} /> לאתר המרכז
                  </CenterWebsiteLink>
                )}
              </div>
            )}

            {/* המטפלים במרכז (מסלול 1) - מונה + קפיצה לרשימה; עזר ניווט לדסקטופ */}
            {!isEntity && therapists.length > 0 && (
              <div className="hidden rounded-[24px] border border-[var(--line)] bg-white p-6 text-center shadow-[0_14px_36px_rgba(42,100,98,.09)] lg:block">
                <p className="text-[13px] font-extrabold uppercase tracking-[.14em] text-[var(--muted)]">המטפלים במרכז</p>
                <p className="mt-3 text-[2.2rem] font-black leading-none text-[var(--teal)]">{therapists.length}</p>
                <p className="mt-1.5 text-[13px] font-semibold text-[var(--text-2)]">
                  {therapists.length === 1 ? "מטפל/ת עם עמוד אישי באתר" : "מטפלים עם עמוד אישי באתר"}
                </p>
                <a href="#therapists"
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border-[1.5px] border-[var(--teal-mid)] bg-white px-5 py-2.5 text-[14px] font-extrabold text-[var(--teal-dark)] transition hover:bg-[var(--teal-pale)]">
                  לרשימת המטפלים ↓
                </a>
              </div>
            )}

            {/* מידע פרקטי - בדסקטופ בצד; במובייל בסוף העמוד */}
            {hasPractical && (
              <div className="rounded-[24px] border border-[var(--line)] bg-white p-6 shadow-[0_14px_36px_rgba(42,100,98,.09)]">
                <p className="mb-1 text-[13px] font-extrabold uppercase tracking-[.14em] text-[var(--muted)]">מידע פרקטי</p>
                {practicalRows.address && (
                  <div className="flex items-start gap-3 border-b border-[var(--surface-2)] py-4">
                    <MapPin size={17} className="mt-1 flex-shrink-0" style={{ color: "var(--gold-dark)" }} />
                    <div>
                      <p className="text-[13.5px] font-extrabold text-[var(--text)]">כתובת</p>
                      <p className="mt-0.5 whitespace-pre-line text-[15px] leading-7 text-[var(--text-2)]">{practicalRows.address}</p>
                      {mapsHref && (
                        <a href={mapsHref} target="_blank" rel="noopener noreferrer nofollow"
                          className="mt-1 inline-flex items-center gap-1 text-[13px] font-bold hover:underline" style={{ color: "var(--teal-dark)" }}>
                          <Navigation size={13} /> ניווט במפות
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {practicalRows.hours && (
                  <div className="flex items-start gap-3 border-b border-[var(--surface-2)] py-4">
                    <Clock size={17} className="mt-1 flex-shrink-0" style={{ color: "var(--gold-dark)" }} />
                    <div>
                      <p className="text-[13.5px] font-extrabold text-[var(--text)]">שעות פעילות</p>
                      <p className="mt-0.5 whitespace-pre-line text-[15px] leading-7 text-[var(--text-2)]">{practicalRows.hours}</p>
                    </div>
                  </div>
                )}
                {practicalRows.accessibility && (
                  <div className="flex items-start gap-3 border-b border-[var(--surface-2)] py-4">
                    <Accessibility size={17} className="mt-1 flex-shrink-0" style={{ color: "var(--gold-dark)" }} />
                    <div>
                      <p className="text-[13.5px] font-extrabold text-[var(--text)]">נגישות</p>
                      <p className="mt-0.5 whitespace-pre-line text-[15px] leading-7 text-[var(--text-2)]">{practicalRows.accessibility}</p>
                    </div>
                  </div>
                )}
                {practicalRows.languages.length > 0 && (
                  <div className="flex items-start gap-3 border-b border-[var(--surface-2)] py-4">
                    <Languages size={17} className="mt-1 flex-shrink-0" style={{ color: "var(--gold-dark)" }} />
                    <div>
                      <p className="text-[13.5px] font-extrabold text-[var(--text)]">שפות טיפול</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {practicalRows.languages.map((l) => (
                          <span key={l} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-0.5 text-[13px] font-semibold text-[var(--text-2)]">{l}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {practicalRows.arrangements.length > 0 && (
                  <div className="flex items-start gap-3 py-4">
                    <Handshake size={17} className="mt-1 flex-shrink-0" style={{ color: "var(--gold-dark)" }} />
                    <div>
                      <p className="text-[13.5px] font-extrabold text-[var(--text)]">הסדרים והחזרים</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {practicalRows.arrangements.map((a) => (
                          <span key={a} className="rounded-full border border-[#E9D6A6] px-3 py-0.5 text-[13px] font-semibold"
                            style={{ background: "var(--gold-pale)", color: "var(--gold-dark)" }}>{a}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* CTA כהה - הסגירה, ברוחב מלא. מסלול 2: פנייה ישירה; מסלול 1: שאלון
          ההתאמה (ההתאמות מגיעות למטפלי המרכז) לצד ערוצי הקשר של המרכז */}
      {(isEntity ? hasAnyContact : true) && (
        <section className="relative mt-24 overflow-hidden px-5 py-24 text-center"
          style={{ background: "linear-gradient(135deg,#245654 0%,var(--teal-dark) 55%,#31716F 100%)", borderRadius: "50% 50% 0 0 / 58px 58px 0 0" }}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 1400 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
            <path d="M 100 400 A 420 420 0 0 1 940 400" fill="none" stroke="rgba(255,255,255,.10)" strokeWidth="2" />
            <path d="M 500 400 A 380 380 0 0 1 1260 400" fill="none" stroke="rgba(243,201,107,.18)" strokeWidth="2" />
          </svg>
          <div className="relative mx-auto max-w-[760px]">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[rgba(243,201,107,.4)] px-4 py-1.5 text-[12px] font-extrabold uppercase tracking-[.18em] text-[#F3C96B]">
              ✦ {isEntity ? "פנייה למרכז" : "הצעד הבא"}
            </span>
            <h2 className="text-[clamp(1.8rem,3vw,2.5rem)] font-black tracking-tight text-white">
              {isEntity ? `יצירת קשר עם ${center.name}` : `מתאימים לך את הטיפול הנכון ב${center.name}`}
            </h2>
            <p className="mx-auto mt-4 max-w-[54ch] text-[16.5px] leading-[1.9] text-[#CFE5E3]">
              {isEntity
                ? "אפשר לכתוב בוואטסאפ, לשלוח הודעה דרך האתר או להתקשר - והצוות יחזור אליכם לתיאום."
                : "מלאו שאלון קצר ומערכת ההתאמה החכמה תפנה אתכם למטפל/ת המתאים/ה ביותר במרכז - לפי סוג הקושי, הגישה והאזור."}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {!isEntity && (
                <Link href="/adults"
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--gold)] px-8 py-3.5 text-base font-extrabold text-white shadow-[0_10px_28px_rgba(0,0,0,.25)] transition hover:bg-[#C4850F]">
                  למילוי שאלון התאמה <ArrowLeft size={16} />
                </Link>
              )}
              {waHref && (
                <CenterWhatsAppLink entityId={entity?.id} centerId={center.id} href={waHref}
                  className="inline-flex items-center gap-2 rounded-full bg-green-500 px-8 py-3.5 text-base font-extrabold text-white shadow-[0_10px_28px_rgba(0,0,0,.25)] transition hover:bg-green-600">
                  {WA_SVG} שליחת וואטסאפ
                </CenterWhatsAppLink>
              )}
              {canMessage && (
                <CenterMessageButton {...messageTarget} centerName={center.name}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-extrabold text-[var(--teal-dark)] transition hover:bg-[var(--teal-pale)]" />
              )}
              {phone && telHref && (
                <CenterPhoneLink entityId={entity?.id} centerId={center.id} phone={phone}
                  className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[rgba(255,255,255,.45)] px-7 py-3.5 text-base font-bold text-white transition hover:bg-[rgba(255,255,255,.1)]">
                  <Phone size={16} /> {phone}
                </CenterPhoneLink>
              )}
            </div>
          </div>
        </section>
      )}

      {/* פס קשר דביק - מובייל בלבד (בדסקטופ עמודת הצד הדביקה ממלאת את התפקיד).
          מסלול 1 מקבל גם את שאלון ההתאמה כפעולה הראשית */}
      {(isEntity ? hasAnyContact : true) && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-white/95 backdrop-blur lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="mx-auto flex max-w-[720px] items-center justify-center gap-2 px-4 py-2.5">
            {!isEntity && (
              <Link href="/adults"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[14px] font-extrabold text-white transition hover:opacity-95"
                style={{ background: "linear-gradient(135deg,var(--teal-dark),var(--teal))" }}>
                לשאלון התאמה
              </Link>
            )}
            {waHref && (
              <CenterWhatsAppLink entityId={entity?.id} centerId={center.id} href={waHref}
                className={`inline-flex ${isEntity ? "flex-1" : ""} items-center justify-center gap-1.5 rounded-full bg-green-500 px-4 py-2.5 text-[14px] font-extrabold text-white transition hover:bg-green-600`}>
                {WA_SVG} וואטסאפ
              </CenterWhatsAppLink>
            )}
            {telHref && (
              <CenterPhoneLink entityId={entity?.id} centerId={center.id} phone={phone!}
                className={`inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--teal)] px-4 py-2.5 text-[14px] font-extrabold text-white transition hover:bg-[var(--teal-dark)] ${waHref ? "" : "flex-1"}`}>
                <Phone size={15} /> חיוג
              </CenterPhoneLink>
            )}
            {canMessage && (
              <CenterMessageButton {...messageTarget} centerName={center.name} label="הודעה"
                className={`inline-flex items-center justify-center gap-1.5 rounded-full border-[1.5px] border-[var(--teal-mid)] bg-white px-4 py-2.5 text-[14px] font-bold text-[var(--teal-dark)] transition hover:bg-[var(--teal-pale)] ${waHref || telHref ? "" : "flex-1"}`} />
            )}
          </div>
        </div>
      )}
    </main>
  );
}
