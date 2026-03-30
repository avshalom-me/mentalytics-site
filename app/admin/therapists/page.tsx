"use client";

import { useEffect, useState } from "react";

type AdminTherapist = {
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
  status: string;
  created_at: string | null;
};

export default function AdminTherapistsPage() {
  const [therapists, setTherapists] = useState<AdminTherapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [approvedSearch, setApprovedSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadTherapists() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/admin-therapists", {
          cache: "no-store",
        });

        const json = await res.json();

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to load admin therapists");
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

  async function deleteTherapist(id: string) {
    if (!window.confirm("האם למחוק את המטפל לצמיתות? פעולה זו אינה הפיכה.")) return;
    try {
      setActionLoadingId(id);
      setError("");
      const res = await fetch("/api/admin-therapists", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to delete");
      setTherapists((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function updateStatus(id: string, status: "approved" | "rejected" | "pending") {
    try {
      setActionLoadingId(id);
      setError("");

      const res = await fetch("/api/admin-therapists", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, status }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to update therapist status");
      }

      setTherapists((prev) =>
        prev.map((therapist) =>
          therapist.id === id ? { ...therapist, status } : therapist
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setActionLoadingId(null);
    }
  }

  if (loading) {
    return <div className="p-6 text-center">טוען מטפלים...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-600">שגיאה: {error}</div>;
  }

  if (therapists.length === 0) {
    return <div className="p-6 text-center">לא נמצאו מטפלים.</div>;
  }

  const pending = therapists.filter((t) => t.status !== "approved");
  const approved = therapists.filter((t) => t.status === "approved");
  const filteredApproved = approved.filter((t) =>
    t.full_name.toLowerCase().includes(approvedSearch.toLowerCase())
  );

  function TherapistCard({ therapist }: { therapist: AdminTherapist }) {
    const showImage = therapist.profile_photo_url && !brokenImages[therapist.id];
    const isBusy = actionLoadingId === therapist.id;

    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <div>
            {showImage ? (
              <div className="flex h-56 w-full items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                <img
                  src={therapist.profile_photo_url!}
                  alt={therapist.full_name}
                  className="h-full w-full object-contain"
                  referrerPolicy="no-referrer"
                  onError={() => setBrokenImages((prev) => ({ ...prev, [therapist.id]: true }))}
                />
              </div>
            ) : (
              <div className="flex h-56 w-full items-center justify-center rounded-xl bg-gray-100 text-gray-400">
                אין תמונה
              </div>
            )}
          </div>

          <div className="text-right">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold">{therapist.full_name || "ללא שם"}</h2>
              <span className={`rounded-full px-3 py-1 text-sm ${
                therapist.status === "approved" ? "bg-green-100 text-green-800" :
                therapist.status === "rejected" ? "bg-red-100 text-red-800" :
                "bg-yellow-100 text-yellow-800"
              }`}>
                {therapist.status === "approved" ? "מאושר" :
                 therapist.status === "rejected" ? "נדחה" :
                 "ממתין לאישור"}
              </span>
            </div>

            {therapist.bio && (
              <p className="mb-4 whitespace-pre-line text-sm text-gray-700">{therapist.bio}</p>
            )}

            <div className="grid gap-2 text-sm text-gray-800 md:grid-cols-2">
              <div><span className="font-medium">מייל:</span> {therapist.email || "—"}</div>
              <div><span className="font-medium">טלפון:</span> {therapist.phone || "—"}</div>
              <div><span className="font-medium">מגדר:</span> {therapist.gender || "—"}</div>
              <div><span className="font-medium">אונליין:</span> {therapist.online ? "כן" : "לא"}</div>
              <div className="md:col-span-2">
                <span className="font-medium">סוג מטפל:</span>{" "}
                {therapist.therapist_types.length > 0 ? therapist.therapist_types.join(", ") : "—"}
              </div>
              <div className="md:col-span-2">
                <span className="font-medium">תחומי טיפול:</span>{" "}
                {therapist.training_areas.length > 0 ? therapist.training_areas.join(", ") : "—"}
              </div>
              <div className="md:col-span-2">
                <span className="font-medium">אזור:</span>{" "}
                {therapist.regions.length > 0 ? therapist.regions.join(", ") : "—"}
              </div>
              <div className="md:col-span-2">
                <span className="font-medium">העדפות תרבותיות:</span>{" "}
                {therapist.cultural_prefs.length > 0 ? therapist.cultural_prefs.join(", ") : "—"}
              </div>
              <div className="md:col-span-2">
                <span className="font-medium">הסדרים:</span>{" "}
                {therapist.arrangements.length > 0 ? therapist.arrangements.join(", ") : "—"}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" disabled={isBusy}
                className="rounded-xl bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => updateStatus(therapist.id, "approved")}>
                {isBusy ? "מעדכן..." : "אשר"}
              </button>
              <button type="button" disabled={isBusy}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => updateStatus(therapist.id, "rejected")}>
                {isBusy ? "מעדכן..." : "דחה"}
              </button>
              <button type="button" disabled={isBusy}
                className="rounded-xl bg-gray-500 px-4 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => updateStatus(therapist.id, "pending")}>
                {isBusy ? "מעדכן..." : "החזר להמתנה"}
              </button>
              <button type="button" disabled={isBusy}
                className="rounded-xl bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => deleteTherapist(therapist.id)}>
                {isBusy ? "מוחק..." : "מחק"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isBypassed = typeof window !== "undefined" && localStorage.getItem("quiz_bypass") === "1";

  return (
    <main className="mx-auto max-w-6xl p-6" dir="rtl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">ניהול מטפלים</h1>
        <button
          onClick={() => {
            if (isBypassed) { localStorage.removeItem("quiz_bypass"); window.location.reload(); }
            else { localStorage.setItem("quiz_bypass", "1"); window.location.reload(); }
          }}
          className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${isBypassed ? "bg-green-100 text-green-700 border-green-300" : "bg-stone-100 text-stone-600 border-stone-300"}`}
        >
          {isBypassed ? "✓ מצב אדמין פעיל (ללא הגבלת שאלון)" : "הפעל מצב אדמין"}
        </button>
      </div>

      {error && <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {/* ── ממתינים לאישור / נדחו ── */}
      <section className="mb-12">
        <h2 className="mb-4 text-xl font-bold text-right border-b pb-2">
          ממתינים לאישור / נדחו ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-center text-gray-500">אין מטפלים הממתינים לאישור.</p>
        ) : (
          <div className="space-y-6">
            {pending.map((t) => <TherapistCard key={t.id} therapist={t} />)}
          </div>
        )}
      </section>

      {/* ── מאושרים ── */}
      <section>
        <h2 className="mb-4 text-xl font-bold text-right border-b pb-2">
          מאושרים ({approved.length})
        </h2>
        <input
          type="text"
          value={approvedSearch}
          onChange={(e) => setApprovedSearch(e.target.value)}
          placeholder="חיפוש לפי שם..."
          className="mb-5 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
        />
        {filteredApproved.length === 0 ? (
          <p className="text-center text-gray-500">לא נמצאו מטפלים.</p>
        ) : (
          <div className="space-y-6">
            {filteredApproved.map((t) => <TherapistCard key={t.id} therapist={t} />)}
          </div>
        )}
      </section>
    </main>
  );
}