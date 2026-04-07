"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ALL_REGIONS, CITY_TO_REGION } from "@/app/lib/regions";

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
            <Link key={t.id} href={`/therapists/${t.id}`}
              className="rounded-2xl border border-[#E8E0D8] bg-white overflow-hidden block hover:shadow-md transition-shadow"
              style={{ boxShadow: "0 2px 10px rgba(100,60,30,.07)" }}>

              {/* Photo — full width */}
              <div className="relative h-52 w-full overflow-hidden bg-gray-100">
                <img
                  src={showImage ? t.profile_photo_url! : (t.gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg")}
                  alt={t.full_name}
                  className="h-full w-full object-cover object-top"
                  onError={() => setBrokenImages((p) => ({ ...p, [t.id]: true }))}
                />
              </div>

              {/* Name + bio snippet */}
              <div className="p-4">
                <div className="font-extrabold text-stone-900 text-base leading-tight">{t.full_name}</div>
                {t.therapist_types.length > 0 && (
                  <div className="mt-0.5 text-xs text-stone-500">{t.therapist_types[0]}</div>
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
                <div className="mt-3 text-xs font-semibold text-[#2e7d8c]">לפרופיל המלא ←</div>
              </div>
            </Link>
          );
        })}
      </div>

    </main>
  );
}
