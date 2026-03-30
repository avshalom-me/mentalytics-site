"use client";

import { useEffect, useState } from "react";
import { REGION_CITIES } from "@/app/lib/regions";

const ALL_CITIES = Object.values(REGION_CITIES).flat();

const THERAPIST_TYPES = [
  "פסיכולוג קליני","פסיכולוג חינוכי","פסיכולוג שיקומי/רפואי","פסיכולוג התפתחותי",
  "פסיכולוג תעסוקתי","יועצ/ת חינוכי",'עו"ס קליני',"מטפל/ת בהבעה ויצירה",
  "מטפל מיני","קרימינולוג קליני","פיזיותרפיסט/ית",
];
const TRAINING_AREAS = [
  "טיפול דינאמי","CBT","ACT","EMDR","DBT","הדרכת הורים","טיפול דיאדי",
  "טיפול משפחתי","טיפול בהבעה ויצירה","ריפוי בעיסוק","טיפול תעסוקתי",
  "קבוצה חברתית","טיפול זוגי","טיפול בהתמכרויות","טיפול מיני",
  "טיפול COG-FUN לקשיי קשב וריכוז","טיפול בטראומה",
];
const ASSESSMENT_TYPES = [
  "פסיכו-דידקטי","פסיכו-דיאגנוסטי","נוירו-פסיכולוגי","אבחון תעסוקתי",
  "הערכה פסיכולוגית","הערכת בשלות לגן","אבחון קשיי תקשורת ASD",
];
const CULTURAL_PREFS = [
  "היכרות עם העולם הדתי","היכרות עם העולם החרדי",'היכרות עם עולם הלהט"ב',
];
const ARRANGEMENTS = [
  "קופות החולים","משרד הביטחון","ביטוח לאומי","ביטוחים פרטיים",
];

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
  assessment_types: string[];
  regions: string[];
  cultural_prefs: string[];
  arrangements: string[];
  profile_photo_path: string | null;
  profile_photo_url: string | null;
  status: string;
  created_at: string | null;
};

type EditForm = {
  full_name: string;
  email: string;
  phone: string;
  bio: string;
  gender: string;
  online: boolean;
  therapist_types: string[];
  training_areas: string[];
  assessment_types: string[];
  regions: string[];
  cultural_prefs: string[];
  arrangements: string[];
};

function toggleItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

function CheckboxGroup({
  label, options, selected, onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1 text-sm font-semibold text-stone-800">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <label key={opt} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-stone-200 px-2 py-1 text-xs hover:bg-stone-50">
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => onChange(toggleItem(selected, opt))}
            />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function AdminTherapistsPage() {
  const [therapists, setTherapists] = useState<AdminTherapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [approvedSearch, setApprovedSearch] = useState("");

  // Edit modal state
  const [editingTherapist, setEditingTherapist] = useState<AdminTherapist | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadTherapists() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/admin-therapists", { cache: "no-store" });
        const json = await res.json();

        if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load admin therapists");
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

  function openEdit(t: AdminTherapist) {
    setEditingTherapist(t);
    setEditError("");
    setEditForm({
      full_name: t.full_name,
      email: t.email,
      phone: t.phone,
      bio: t.bio,
      gender: t.gender,
      online: t.online,
      therapist_types: [...t.therapist_types],
      training_areas: [...t.training_areas],
      assessment_types: [...t.assessment_types],
      regions: [...t.regions],
      cultural_prefs: [...t.cultural_prefs],
      arrangements: [...t.arrangements],
    });
  }

  async function saveEdit() {
    if (!editingTherapist || !editForm) return;
    setEditSaving(true);
    setEditError("");
    try {
      const res = await fetch("/api/admin-therapists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingTherapist.id, fields: editForm }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to save");
      setTherapists((prev) =>
        prev.map((t) => t.id === editingTherapist.id ? { ...t, ...editForm } : t)
      );
      setEditingTherapist(null);
      setEditForm(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setEditSaving(false);
    }
  }

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to update therapist status");
      setTherapists((prev) =>
        prev.map((therapist) => therapist.id === id ? { ...therapist, status } : therapist)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setActionLoadingId(null);
    }
  }

  if (loading) return <div className="p-6 text-center">טוען מטפלים...</div>;
  if (error) return <div className="p-6 text-center text-red-600">שגיאה: {error}</div>;
  if (therapists.length === 0) return <div className="p-6 text-center">לא נמצאו מטפלים.</div>;

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
                 therapist.status === "rejected" ? "נדחה" : "ממתין לאישור"}
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
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => openEdit(therapist)}>
                ערוך
              </button>
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

      {/* ── Edit Modal ── */}
      {editingTherapist && editForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-10">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl" dir="rtl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">עריכת פרטים — {editingTherapist.full_name}</h2>
              <button
                onClick={() => { setEditingTherapist(null); setEditForm(null); }}
                className="text-2xl text-stone-400 hover:text-stone-700 leading-none"
              >
                ×
              </button>
            </div>

            {editError && (
              <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{editError}</div>
            )}

            <div className="space-y-3">
              {/* Basic fields */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-stone-800">שם מלא</label>
                  <input
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-stone-800">מייל</label>
                  <input
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-stone-800">טלפון</label>
                  <input
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-stone-800">מגדר</label>
                  <select
                    value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]"
                  >
                    <option value="">בחר</option>
                    <option value="זכר">זכר</option>
                    <option value="נקבה">נקבה</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-stone-800">ביוגרפיה</label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  rows={4}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#2e7d8c]"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-stone-800">
                <input
                  type="checkbox"
                  checked={editForm.online}
                  onChange={(e) => setEditForm({ ...editForm, online: e.target.checked })}
                />
                מטפל/ת אונליין
              </label>

              <CheckboxGroup
                label="סוג מטפל"
                options={THERAPIST_TYPES}
                selected={editForm.therapist_types}
                onChange={(v) => setEditForm({ ...editForm, therapist_types: v })}
              />
              <CheckboxGroup
                label="תחומי טיפול"
                options={TRAINING_AREAS}
                selected={editForm.training_areas}
                onChange={(v) => setEditForm({ ...editForm, training_areas: v })}
              />
              <CheckboxGroup
                label="סוגי אבחון"
                options={ASSESSMENT_TYPES}
                selected={editForm.assessment_types}
                onChange={(v) => setEditForm({ ...editForm, assessment_types: v })}
              />
              <CheckboxGroup
                label="אזורים / ערים"
                options={ALL_CITIES}
                selected={editForm.regions}
                onChange={(v) => setEditForm({ ...editForm, regions: v })}
              />
              <CheckboxGroup
                label="העדפות תרבותיות"
                options={CULTURAL_PREFS}
                selected={editForm.cultural_prefs}
                onChange={(v) => setEditForm({ ...editForm, cultural_prefs: v })}
              />
              <CheckboxGroup
                label="הסדרים"
                options={ARRANGEMENTS}
                selected={editForm.arrangements}
                onChange={(v) => setEditForm({ ...editForm, arrangements: v })}
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setEditingTherapist(null); setEditForm(null); }}
                className="rounded-xl border border-stone-300 px-5 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              >
                ביטול
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="rounded-xl bg-[#2e7d8c] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {editSaving ? "שומר..." : "שמור שינויים"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
