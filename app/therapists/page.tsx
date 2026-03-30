"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

  useEffect(() => {
    let cancelled = false;

    async function loadTherapists() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/public-therapists", {
          cache: "no-store",
        });

        const json = await res.json();

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to load therapists");
        }

        if (!cancelled) {
          setTherapists(json.therapists ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTherapists();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="p-6 text-center">טוען מטפלים...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-600">שגיאה: {error}</div>;
  }

  return (
    <main className="mx-auto max-w-5xl p-6" dir="rtl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">מטפלים</h1>
        <Link href="/therapists/signup" className="rounded-xl bg-[#2e7d8c] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          הצטרפות למאגר המטפלים ▸
        </Link>
      </div>

      {therapists.length === 0 && (
        <p className="text-center text-gray-500">לא נמצאו מטפלים מאושרים.</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {therapists.map((therapist) => {
          const showImage =
            therapist.profile_photo_url && !brokenImages[therapist.id];

          return (
            <div
              key={therapist.id}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              {showImage ? (
                <div className="mb-4 flex h-56 w-full items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                  <img
                    src={therapist.profile_photo_url!}
                    alt={therapist.full_name}
                    className="h-full w-full object-contain"
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setBrokenImages((prev) => ({
                        ...prev,
                        [therapist.id]: true,
                      }))
                    }
                  />
                </div>
              ) : (
                <div className="mb-4 flex h-56 w-full items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                  <img
                    src={therapist.gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg"}
                    alt="תמונת פרופיל"
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              <h2 className="text-right text-xl font-semibold">
                {therapist.full_name}
              </h2>

              {therapist.bio && (
                <p className="mt-3 whitespace-pre-line text-right text-sm text-gray-700">
                  {therapist.bio}
                </p>
              )}

              <div className="mt-4 space-y-2 text-right text-sm text-gray-800">
                {therapist.gender && (
                  <div>
                    <span className="font-medium">מגדר:</span> {therapist.gender}
                  </div>
                )}

                <div>
                  <span className="font-medium">אונליין:</span>{" "}
                  {therapist.online ? "כן" : "לא"}
                </div>

                {therapist.therapist_types.length > 0 && (
                  <div>
                    <span className="font-medium">סוג מטפל:</span>{" "}
                    {therapist.therapist_types.join(", ")}
                  </div>
                )}

                {therapist.training_areas.length > 0 && (
                  <div>
                    <span className="font-medium">תחומי טיפול:</span>{" "}
                    {therapist.training_areas.join(", ")}
                  </div>
                )}

                {therapist.regions.length > 0 && (
                  <div>
                    <span className="font-medium">אזור:</span>{" "}
                    {therapist.regions.join(", ")}
                  </div>
                )}

                {therapist.cultural_prefs.length > 0 && (
                  <div>
                    <span className="font-medium">העדפות תרבותיות:</span>{" "}
                    {therapist.cultural_prefs.join(", ")}
                  </div>
                )}

                {therapist.arrangements.length > 0 && (
                  <div>
                    <span className="font-medium">הסדרים:</span>{" "}
                    {therapist.arrangements.join(", ")}
                  </div>
                )}
              </div>

              {(therapist.phone || therapist.email) && (
                <div className="mt-5 flex flex-wrap gap-2 justify-end">
                  {therapist.phone && (
                    <a
                      href={`https://wa.me/972${therapist.phone.replace(/^0/, "").replace(/[-\s]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      וואטסאפ
                    </a>
                  )}
                  {therapist.email && (
                    <a
                      href={`mailto:${therapist.email}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#2e7d8c] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="16" x="2" y="4" rx="2"/>
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                      </svg>
                      שלח מייל
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}