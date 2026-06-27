"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import { ALL_REGIONS, CITY_TO_REGION, regionToSlug, ONLINE_SLUG } from "@/app/lib/regions";
import { therapistPath } from "@/app/lib/therapist-url";
import { genderTitle } from "@/app/lib/gender-text";
import { usePageView, useFilterTrack, useImpressionTrack } from "@/app/lib/useTrack";
import SiteMessageModal from "./SiteMessageModal";

function trackClick(therapistId: string, clickType: "whatsapp" | "phone" | "email") {
  fetch("/api/track-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ therapist_id: therapistId, click_type: clickType, source: "directory" }),
  }).catch(() => {});
}

export type PublicTherapist = {
  id: string;
  full_name: string;
  phone: string;
  bio: string;
  gender: string;
  online: boolean;
  therapist_types: string[];
  training_areas: string[];
  regions: string[];
  cultural_prefs: string[];
  arrangements: string[];
  profile_photo_path: string | null;
  profile_photo_url: string | null;
};

function TherapistCard({
  t,
  position,
  eager,
  brokenImages,
  setBrokenImages,
}: {
  t: PublicTherapist;
  position: number;
  eager: boolean;
  brokenImages: Record<string, boolean>;
  setBrokenImages: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const impressionRef = useImpressionTrack(t.id, position);
  const retryCount = useRef(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const showImage = t.profile_photo_url && !brokenImages[t.id];
  const bioSnippet = t.bio ? t.bio.split(/[.\n]/)[0].trim() : "";

  const handleImageError = () => {
    if (retryCount.current < 2 && imgRef.current && t.profile_photo_url) {
      retryCount.current += 1;
      setTimeout(() => {
        if (imgRef.current) {
          imgRef.current.src = t.profile_photo_url + "&retry=" + retryCount.current;
        }
      }, 1000 * retryCount.current);
    } else {
      setBrokenImages((p) => ({ ...p, [t.id]: true }));
    }
  };

  return (
    <div
      ref={impressionRef}
      className="rounded-2xl bg-white overflow-hidden transition hover:shadow-lg hover:-translate-y-0.5"
      style={{ border: "1px solid var(--line)", boxShadow: "0 2px 10px rgba(61,140,138,.06)" }}
    >
      <Link href={therapistPath(t.id, t.full_name)} className="block">
        <div className="relative h-80 w-full overflow-hidden bg-gray-100">
          <img
            ref={imgRef}
            src={showImage ? t.profile_photo_url! : (t.gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg")}
            alt={t.full_name}
            className="h-full w-full object-cover object-center"
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            onError={handleImageError}
          />
          <span className="absolute top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-bold"
            style={{ insetInlineStart: "12px", color: "var(--teal-dark)", boxShadow: "0 1px 4px rgba(0,0,0,.12)" }}>✓ מאומת</span>
        </div>
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-baseline justify-between gap-2">
            <div className="font-black text-stone-900 text-lg leading-tight truncate">{t.full_name}</div>
          </div>
          {t.therapist_types.length > 0 && (
            <div className="mt-1 text-sm font-semibold" style={{ color: "var(--teal)" }}>{genderTitle(t.therapist_types[0], t.gender)}</div>
          )}
          {bioSnippet && (
            <p className="mt-2 text-sm text-stone-600 leading-relaxed line-clamp-2">{bioSnippet}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {t.online && (
              <span className="rounded-full px-3 py-1 text-[13px] font-semibold" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)", color: "var(--teal-dark)" }}>🌐 אונליין</span>
            )}
            {t.regions[0] && (
              <span className="rounded-full px-3 py-1 text-[13px] font-semibold" style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text-2)" }}>📍 {t.regions[0]}</span>
            )}
            {t.training_areas[0] && (
              <span className="rounded-full px-3 py-1 text-[13px] font-semibold" style={{ background: "var(--gold-pale)", border: "1px solid #f0e0b8", color: "var(--gold-dark)" }}>{t.training_areas[0]}</span>
            )}
          </div>
        </div>
      </Link>
      <div className="px-5 pb-5 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
        {t.phone && (
          <a href={`https://wa.me/972${t.phone.replace(/^0/, "").replace(/[-\s]/g, "")}?text=${encodeURIComponent('שלום, הגעתי אלייך דרך אתר "טיפול חכם", אשמח לשמוע פרטים לגבי הטיפול')}`}
            target="_blank" rel="noopener noreferrer"
            onClick={() => trackClick(t.id, "whatsapp")}
            className="inline-flex items-center gap-1.5 rounded-full bg-green-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-green-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            וואטסאפ
          </a>
        )}
        {t.phone && (
          <a href={`tel:${t.phone}`}
            onClick={() => trackClick(t.id, "phone")}
            className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-4 py-2 text-[13px] font-bold text-stone-700 hover:bg-stone-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.06 6.06l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            חיוג
          </a>
        )}
        <button
          type="button"
          onClick={() => setMessageOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold text-white hover:opacity-90" style={{ background: "var(--teal)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          הודעה
        </button>
        <Link href={therapistPath(t.id, t.full_name)} className="text-[13px] font-bold hover:underline" style={{ color: "var(--teal)", marginInlineStart: "auto" }}>
          פרופיל מלא ←
        </Link>
      </div>
      <SiteMessageModal
        therapistId={t.id}
        therapistName={t.full_name}
        source="directory"
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
      />
    </div>
  );
}

export default function TherapistsClient({ therapists }: { therapists: PublicTherapist[] }) {
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [regionFilter, setRegionFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);

  usePageView("directory");
  const trackFilter = useFilterTrack();

  const availableCities = useMemo(() => {
    const cities = new Set<string>();
    for (const t of therapists) {
      for (const city of t.regions) {
        if (regionFilter && CITY_TO_REGION[city] !== regionFilter) continue;
        cities.add(city);
      }
    }
    return Array.from(cities).sort((a, b) => a.localeCompare(b, "he"));
  }, [therapists, regionFilter]);

  // Order is preserved from the server (promoted/paying therapists first), so
  // any filter — including online-only — keeps promoted therapists at the top.
  const filtered = therapists.filter((t) => {
    if (onlineOnly && !t.online) return false;
    if (regionFilter && !t.regions.some((c) => CITY_TO_REGION[c] === regionFilter)) return false;
    if (cityFilter && !t.regions.includes(cityFilter)) return false;
    return true;
  });

  const handleRegionChange = (value: string) => {
    setRegionFilter(value);
    if (value && cityFilter && CITY_TO_REGION[cityFilter] !== value) {
      setCityFilter("");
    }
    if (value) trackFilter("region", value);
  };

  const handleCityChange = (value: string) => {
    setCityFilter(value);
    if (value && !regionFilter) {
      const inferredRegion = CITY_TO_REGION[value];
      if (inferredRegion) setRegionFilter(inferredRegion);
    }
    if (value) trackFilter("city", value);
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 pb-20" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: ".16em", marginBottom: "8px" }}>
          המטפלים שלנו
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em" }}>
            מצאו את המטפל המתאים לכם
          </h1>
          <Link href="/therapists/join" style={{
            background: "var(--teal)", color: "white", borderRadius: "50px",
            padding: "9px 22px", fontSize: "14px", fontWeight: 700, transition: "background .2s",
          }} className="hover:bg-[var(--teal-dark)] whitespace-nowrap">
            לאנשי מקצוע ▸
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-7 flex flex-wrap items-center gap-3 p-4 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)" }}>סינון לפי:</span>
        <select
          value={regionFilter}
          onChange={(e) => handleRegionChange(e.target.value)}
          className="rounded-xl bg-white px-3 py-2 text-sm focus:outline-none"
          style={{ border: "1px solid var(--line)", color: "var(--text)" }}
        >
          <option value="">כל האזורים</option>
          {ALL_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={cityFilter}
          onChange={(e) => handleCityChange(e.target.value)}
          disabled={availableCities.length === 0}
          className="rounded-xl bg-white px-3 py-2 text-sm focus:outline-none disabled:opacity-50"
          style={{ border: "1px solid var(--line)", color: "var(--text)" }}
        >
          <option value="">כל הערים</option>
          {availableCities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          type="button"
          onClick={() => { const v = !onlineOnly; setOnlineOnly(v); if (v) trackFilter("online", "true"); }}
          aria-pressed={onlineOnly}
          className="rounded-xl px-3 py-2 text-sm font-semibold border transition-colors"
          style={onlineOnly
            ? { background: "var(--teal)", color: "white", borderColor: "var(--teal)" }
            : { background: "white", color: "var(--text-2)", borderColor: "var(--line)" }}
        >
          🌐 אונליין בלבד
        </button>
        {(regionFilter || cityFilter || onlineOnly) && (
          <button
            onClick={() => { setRegionFilter(""); setCityFilter(""); setOnlineOnly(false); }}
            style={{ fontSize: "12px", color: "var(--muted)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}
          >
            נקה
          </button>
        )}
      </div>

      {/* Browse-by-region links (internal linking + SEO landing pages) */}
      <div className="mb-7 -mt-2">
        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)", marginInlineEnd: "8px" }}>עיון לפי אזור:</span>
        <span className="inline-flex flex-wrap gap-1.5 align-middle">
          <Link href={`/therapists/region/${ONLINE_SLUG}`} className="rounded-full px-3 py-1 text-xs font-semibold hover:bg-[var(--teal-pale)]"
            style={{ border: "1px solid var(--teal-mid)", color: "var(--teal-dark)", background: "var(--teal-pale)" }}>🌐 אונליין</Link>
          {ALL_REGIONS.map((region) => (
            <Link key={region} href={`/therapists/region/${regionToSlug(region)}`} className="rounded-full px-3 py-1 text-xs font-semibold hover:bg-[var(--surface)]"
              style={{ border: "1px solid var(--line)", color: "var(--text-2)" }}>{region}</Link>
          ))}
        </span>
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-500 py-10">לא נמצאו מטפלים בסינון זה.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t, i) => (
          <TherapistCard
            key={t.id}
            t={t}
            position={i}
            eager={i < 9}
            brokenImages={brokenImages}
            setBrokenImages={setBrokenImages}
          />
        ))}
      </div>
    </main>
  );
}
