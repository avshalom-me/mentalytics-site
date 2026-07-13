import Link from "next/link";
import { genderTitle } from "@/app/lib/gender-text";
import { therapistPath } from "@/app/lib/therapist-url";
import CardImpression from "@/app/components/CardImpression";
import type { PublicTherapist } from "@/app/therapists/TherapistsClient";

// Server-rendered therapist card for the region / city SEO landing pages
// (links to the profile; contact clicks track on the profile). Wrapped in a
// client impression tracker so cards shown here count as "חשיפות" like the
// main directory's.
export default function TherapistResultCard({ t }: { t: PublicTherapist }) {
  const type = t.therapist_types[0] ? genderTitle(t.therapist_types[0], t.gender) : "";
  const avatar = t.gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg";
  const bioSnippet = t.bio ? t.bio.split(/[.\n]/)[0].trim() : "";
  return (
    <CardImpression therapistId={t.id}>
    <Link href={therapistPath(t.id, t.full_name)} className="group block rounded-2xl bg-white overflow-hidden transition hover:shadow-lg hover:-translate-y-0.5"
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
          {t.regions[0] && (
            <span className="rounded-full px-3 py-1 text-[13px] font-semibold" style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text-2)" }}>📍 {t.regions[0]}</span>
          )}
        </div>
      </div>
    </Link>
    </CardImpression>
  );
}
