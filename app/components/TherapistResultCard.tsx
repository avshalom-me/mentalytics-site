import Link from "next/link";
import { genderTitle } from "@/app/lib/gender-text";
import { therapistPath } from "@/app/lib/therapist-url";
import { CITY_TO_REGION } from "@/app/lib/regions";
import CardImpression from "@/app/components/CardImpression";
import type { PublicTherapist } from "@/app/therapists/TherapistsClient";
import { bioSnippet } from "@/app/lib/bio-snippet";

// Context-aware ordering for the card's city chip: on a city landing page the
// page's own city shows first (a Kfar-Saba visitor seeing "📍 נתניה" on a
// Kfar-Saba page read as a bug - regions[0] was just whatever city the
// therapist typed first), then other cities in the page's region, then the
// rest. All cities are shown (therapists list at most ~3), like the matching
// results already do.
function orderRegions(regions: string[], contextCity?: string, contextRegion?: string): string[] {
  if (regions.length < 2) return regions;
  const score = (c: string) =>
    c === contextCity ? 0 : contextRegion && (CITY_TO_REGION[c] === contextRegion || c === contextRegion) ? 1 : 2;
  return [...regions].sort((a, b) => score(a) - score(b));
}

// Server-rendered therapist card for the region / city SEO landing pages
// (links to the profile; contact clicks track on the profile). Wrapped in a
// client impression tracker so cards shown here count as "חשיפות" like the
// main directory's.
export default function TherapistResultCard({
  t,
  backHref,
  contextCity,
  contextRegion,
}: {
  t: PublicTherapist;
  backHref?: string;
  contextCity?: string;
  contextRegion?: string;
}) {
  // ישות-מרכז: עמוד המטפל שלה מחזיר 404 במכוון, אין לה מגדר ולרוב אין תמונה.
  const isCenter = t.is_center === true;
  const type = isCenter
    ? t.therapist_types.slice(0, 2).join(" · ")
    : t.therapist_types[0] ? genderTitle(t.therapist_types[0], t.gender) : "";
  const avatar = t.gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg";
  const snippet = bioSnippet(t.bio);
  // "ret" lets the profile's back link return to THIS listing page (region /
  // city / online / center) rather than the generic /therapists directory.
  const profileHref = isCenter
    ? (t.center_slug ? `/centers/${t.center_slug}` : null)
    : backHref
      ? `${therapistPath(t.id, t.full_name)}?ret=${encodeURIComponent(backHref)}`
      : therapistPath(t.id, t.full_name);
  const cardClass = "group block rounded-2xl bg-white overflow-hidden transition hover:shadow-lg hover:-translate-y-0.5";
  const cardStyle = { border: "1px solid var(--line)", boxShadow: "0 2px 10px rgba(61,140,138,.06)", textDecoration: "none" } as const;
  const Body = (
    <>
      <div style={{ height: "260px", overflow: "hidden", background: "var(--surface)", position: "relative" }}>
        {isCenter && !t.profile_photo_url ? (
          // אווטאר מגדרי על ישות עסקית הוא פשוט שגוי - סמל ניטרלי במקומו.
          <div className="flex h-full w-full items-center justify-center" style={{ background: "var(--teal-pale)" }}>
            <span style={{ fontSize: "56px" }} aria-hidden>🏢</span>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={t.profile_photo_url ?? avatar} alt={t.full_name}
            style={{ width: "100%", height: "100%", objectFit: isCenter ? "contain" : "cover", objectPosition: "center", display: "block", padding: isCenter ? "24px" : 0 }} loading="lazy" />
        )}
        {isCenter && (
          <span className="absolute top-3 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-bold"
            style={{ insetInlineStart: "12px", color: "var(--teal-dark)", boxShadow: "0 1px 4px rgba(0,0,0,.12)" }}>
            🏢 מרכז טיפולי
          </span>
        )}
      </div>
      <div style={{ padding: "16px 18px" }}>
        {/* A listing card is an item, not a section of the page. This was an
            <h2>, which meant the online page told Google it had 118 sections,
            111 of them a person's name - the heading outline is supposed to be
            the page's table of contents, and it was almost entirely noise.
            Rendered appearance is unchanged: size and weight come from the
            classes, not from the tag. */}
        <p className="text-lg font-black text-stone-900 leading-tight group-hover:underline">{t.full_name}</p>
        {type && <div className="mt-1 text-sm font-semibold" style={{ color: "var(--teal)" }}>{type}</div>}
        {snippet && <p className="mt-2 text-sm text-stone-600 leading-relaxed line-clamp-2">{snippet}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {t.online && (
            <span className="rounded-full px-3 py-1 text-[13px] font-semibold" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)", color: "var(--teal-dark)" }}>🌐 אונליין</span>
          )}
          {t.regions.length > 0 && (
            <span className="rounded-full px-3 py-1 text-[13px] font-semibold" style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text-2)" }}>
              📍 {orderRegions(t.regions, contextCity, contextRegion).join(", ")}
            </span>
          )}
        </div>
      </div>
    </>
  );
  return (
    <CardImpression therapistId={t.id}>
      {profileHref ? (
        <Link href={profileHref} className={cardClass} style={cardStyle}>{Body}</Link>
      ) : (
        // ישות בלי slug: אין יעד תקף, ועדיף כרטיס לא-לחיץ מקישור ל-404.
        <div className={cardClass} style={cardStyle}>{Body}</div>
      )}
    </CardImpression>
  );
}
