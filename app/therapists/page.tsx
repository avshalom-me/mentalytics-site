"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ALL_REGIONS, CITY_TO_REGION } from "@/app/lib/regions";
import { genderTitle } from "@/app/lib/gender-text";

function trackClick(therapistId: string, clickType: "whatsapp" | "phone" | "email") {
  fetch("/api/track-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ therapist_id: therapistId, click_type: clickType, source: "directory" }),
  }).catch(() => {});
}

type PublicTherapist = {
  id: string;
  full_name: string;
  email: string;
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

export default function TherapistsPage() {
  const [therapists, setTherapists] = useState<PublicTherapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [regionFilter, setRegionFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadTherapists() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch("/api/public-therapists", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load therapists");
        if (!cancelled) setTherapists(json.therapists ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadTherapists();
    return () => { cancelled = true; };
  }, []);

  const filtered = regionFilter
    ? therapists.filter((t) =>
        t.regions.some((city) => CITY_TO_REGION[city] === regionFilter)
      )
    : therapists;

  if (loading) return <div className="p-6 text-center">טוען מטפלים...</div>;
  if (error) return <div className="p-6 text-center text-red-600">שגיאה: {error}</div>;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 pb-20" dir="rtl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-stone-900">המטפלים שלנו</h1>
        <Link href="/therapists/signup"
          className="rounded-xl bg-[#2e7d8c] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          כניסת מטפלים / רישום ▸
        </Link>
      </div>

      {/* Filter */}
      <div className="mb-6 flex items-center gap-3">
        <label className="text-sm font-semibold text-stone-700">סינון לפי אזור:</label>
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="rounded-xl border border-[#E0D5C8] bg-white px-3 py-2 text-sm text-stone-800 focus:border-[#2e7d8c] focus:outline-none"
        >
          <option value="">כל הארץ</option>
          {ALL_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {regionFilter && (
          <button onClick={() => setRegionFilter("")}
            className="text-xs text-stone-500 underline hover:text-stone-700">
            נקה
          </button>
        )}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-500 py-10">לא נמצאו מטפלים באזור זה.</p>
      )}

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => {
          const showImage = t.profile_photo_url && !brokenImages[t.id];
          const bioSnippet = t.bio ? t.bio.split(/[.\n]/)[0].trim() : "";

          return (
            <div key={t.id}
              className="rounded-2xl border border-[#E8E0D8] bg-white overflow-hidden"
              style={{ boxShadow: "0 2px 10px rgba(100,60,30,.07)" }}>

              {/* Photo — clickable to profile */}
              <Link href={`/therapists/${t.id}`} className="block">
                <div className="relative h-72 w-full overflow-hidden bg-gray-100">
                  <img
                    src={showImage ? t.profile_photo_url! : (t.gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg")}
                    alt={t.full_name}
                    className="h-full w-full object-cover object-center"
                    onError={() => setBrokenImages((p) => ({ ...p, [t.id]: true }))}
                  />
                </div>

                {/* Name + bio snippet */}
                <div className="px-4 pt-4 pb-3">
                  <div className="font-extrabold text-stone-900 text-base leading-tight">{t.full_name}</div>
                  {t.therapist_types.length > 0 && (
                    <div className="mt-0.5 text-xs text-stone-500">{genderTitle(t.therapist_types[0], t.gender)}</div>
                  )}
                  {bioSnippet && (
                    <p className="mt-1.5 text-xs text-stone-600 leading-relaxed line-clamp-2">{bioSnippet}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {t.online && (
                      <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs text-blue-700">🌐 אונליין</span>
                    )}
                    {t.regions[0] && (
                      <span className="rounded-full bg-stone-100 border border-stone-200 px-2 py-0.5 text-xs text-stone-600">📍 {t.regions[0]}</span>
                    )}
                  </div>
                </div>
              </Link>

              {/* Actions */}
              <div className="px-4 pb-4 flex items-center gap-2 border-t border-stone-100 pt-3">
                {t.phone && (
                  <a href={`tel:${t.phone}`}
                    onClick={() => trackClick(t.id, "phone")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-stone-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-stone-800">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.06 6.06l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    התקשר/י
                  </a>
                )}
                {t.phone && (
                  <a href={`https://wa.me/972${t.phone.replace(/^0/, "").replace(/[-\s]/g, "")}?text=${encodeURIComponent('שלום, הגעתי אלייך דרך אתר "טיפול חכם", אשמח לשמוע פרטים לגבי הטיפול')}`}
                    target="_blank" rel="noopener noreferrer"
                    onClick={() => trackClick(t.id, "whatsapp")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-green-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    וואטסאפ
                  </a>
                )}
                <Link href={`/therapists/${t.id}`} className="mr-auto text-xs font-semibold text-[#2e7d8c] hover:underline">
                  פרופיל מלא ←
                </Link>
              </div>
            </div>
          );
        })}
      </div>

    </main>
  );
}
