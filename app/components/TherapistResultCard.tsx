import Link from "next/link";
import { genderTitle } from "@/app/lib/gender-text";
import { therapistPath } from "@/app/lib/therapist-url";
import { CITY_TO_REGION } from "@/app/lib/regions";
import CardImpression from "@/app/components/CardImpression";
import type { PublicTherapist } from "@/app/therapists/TherapistsClient";

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
  const type = t.therapist_types[0] ? genderTitle(t.therapist_types[0], t.gender) : "";
  const avatar = t.gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg";
  const bioSnippet = t.bio ? t.bio.split(/[.\n]/)[0].trim() : "";
  // "ret" lets the profile's back link return to THIS listing page (region /
  // city / online / center) rather than the generic /therapists directory.
  const profileHref = backHref
    ? `${therapistPath(t.id, t.full_name)}?ret=${encodeURIComponent(backHref)}`
    : therapistPath(t.id, t.full_name);
  return (
    <CardImpression therapistId={t.id}>
    <Link href={profileHref} className="group block rounded-2xl bg-white overflow-hidden transition hover:shadow-lg hover:-translate-y-0.5"
      style={{ border: "1px solid var(--line)", boxShadow: "0 2px 10px rgba(61,140,138,.06)", textDecoration: "none" }}>
      <div style={{ height: "260px", overflow: "hidden", background: "var(--surface)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={t.profile_photo_url ?? avatar} alt={t.full_name}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }} loading="lazy" />
      </div>
      <div style={{ padding: "16px 18px" }}>
        <h2 className="text-lg font-black text-stone-900 leading-tight group-hover:underline">{t.full_name}</h2>
        {type && <div className="mt-1 text-sm font-semibold" style={{ color: "var(--teal)" }}>{type}</div>}
        {bioSnippet && <p className="mt-2 text-sm text-stone-600 leading-relaxed line-clamp-2">{bioSnippet}</p>}
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
    </Link>
    </CardImpression>
  );
}
