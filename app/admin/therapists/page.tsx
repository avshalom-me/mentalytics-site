"use client";

import { useEffect, useState } from "react";
import { REGION_CITIES } from "@/app/lib/regions";
import {
  THERAPIST_TYPES, TRAINING_AREAS, ASSESSMENT_TYPES,
  CULTURAL_PREFS, AGE_GROUPS, ARRANGEMENTS,
} from "@/app/lib/therapist-options";
import { missingProfileFields, defaultCompletionMessage } from "@/app/lib/profile-completeness";

const ALL_CITIES = Object.values(REGION_CITIES).flat();

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
  age_groups: string[];
  profile_photo_path: string | null;
  profile_photo_url: string | null;
  certificates: Array<{
    id: string;
    original_name: string;
    content_type: string;
    signed_url: string | null;
  }>;
  status: string;
  manually_promoted: boolean;
  promotion_source: string | null;
  promoted_until: string | null;
  admin_approved: boolean;
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
  options: readonly string[];
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
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [reconcileResults, setReconcileResults] = useState<Record<string, string>>({});
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [filterName, setFilterName] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterTherapistType, setFilterTherapistType] = useState("");
  const [filterTrainingArea, setFilterTrainingArea] = useState("");
  const [filterCultural, setFilterCultural] = useState("");
  const [filterAgeGroup, setFilterAgeGroup] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Edit modal state
  const [editingTherapist, setEditingTherapist] = useState<AdminTherapist | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [completionFor, setCompletionFor] = useState<AdminTherapist | null>(null);
  const [completionText, setCompletionText] = useState("");
  const [completionSending, setCompletionSending] = useState(false);

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

  async function updateStatus(
    id: string,
    status: "approved" | "rejected" | "pending" | "paying",
    promotedUntil?: string | null,
    reason?: string
  ) {
    try {
      setActionLoadingId(id);
      setError("");
      const res = await fetch("/api/admin-therapists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status,
          ...(promotedUntil ? { promoted_until: promotedUntil } : {}),
          ...(reason ? { reason } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to update therapist status");

      // Mirror server-side field updates locally so the buttons re-render
      // correctly without a hard refresh. promotion_source / promoted_until
      // are derived the same way the server does (paying + expiry = trial,
      // paying + no expiry = manual, anything else = cleared).
      const derived = status === "paying"
        ? {
            manually_promoted: true,
            promotion_source: promotedUntil ? "trial" : "manual",
            promoted_until: promotedUntil ?? null,
            admin_approved: true,
          }
        : {
            manually_promoted: false,
            promotion_source: null,
            promoted_until: null,
            admin_approved: status === "approved",
          };

      setTherapists((prev) =>
        prev.map((therapist) =>
          therapist.id === id ? { ...therapist, status, ...derived } : therapist
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setActionLoadingId(null);
    }
  }

  // On-demand check of this therapist's standing orders at Sumit. Cancels any
  // that are still live there (e.g. an order marked 'cancelled' locally but
  // still charging — the billing leak), so the admin isn't blind to it.
  async function reconcileSumit(id: string) {
    if (!window.confirm("בדיקה מול Sumit: כל הוראת קבע שעדיין פעילה אצל המטפל תבוטל. להמשיך?")) return;
    try {
      setReconcilingId(id);
      setError("");
      const res = await fetch("/api/admin-therapists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "reconcile_sumit" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "בדיקת Sumit נכשלה");
      const r = json.reconcile;
      const summary =
        r.checked === 0 && !r.unlinkedActive
          ? "אין הוראות קבע עם מזהה Sumit לבדיקה."
          : [
              r.cancelled ? `בוטלו עכשיו: ${r.cancelled}` : null,
              r.alreadyInactive ? `כבר לא פעילות: ${r.alreadyInactive}` : null,
              r.notFound ? `לא נמצאו ב-Sumit: ${r.notFound}` : null,
              r.failed ? `נכשלו: ${r.failed}` : null,
              r.unlinkedActive ? `פעילות לא מקושרות: ${r.unlinkedActive}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "אין הוראת קבע פעילה.";
      const msg = [summary, ...(r.details ?? [])].join("\n");
      setReconcileResults((prev) => ({ ...prev, [id]: msg }));
    } catch (err) {
      setReconcileResults((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : "שגיאה",
      }));
    } finally {
      setReconcilingId(null);
    }
  }

  // Approve a paid-but-unapproved therapist for public listing (sets
  // admin_approved=true server-side without changing their paying tier).
  async function approveListing(id: string) {
    try {
      setActionLoadingId(id);
      setError("");
      const res = await fetch("/api/admin-therapists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "approve_listing" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "אישור נכשל");
      setTherapists((prev) => prev.map((t) => (t.id === id ? { ...t, admin_approved: true } : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setActionLoadingId(null);
    }
  }

  // Opens the completion-request composer for a therapist, pre-filling an
  // editable draft from the detected gaps. The admin writes/edits the actual
  // message before it is sent — the wording is the admin's, not the system's.
  function openCompletion(t: AdminTherapist) {
    setCompletionFor(t);
    setCompletionText(defaultCompletionMessage(missingProfileFields(t, t.certificates.length > 0)));
  }

  async function sendCompletion() {
    if (!completionFor || !completionText.trim()) return;
    try {
      setCompletionSending(true);
      setError("");
      const res = await fetch("/api/admin-therapists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: completionFor.id, action: "request_completion", message: completionText }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "שליחה נכשלה");
      setCompletionFor(null);
      window.alert("בקשת ההשלמה נשלחה למטפל/ת.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCompletionSending(false);
    }
  }

  // Promotes the therapist with the chosen expiry. monthsAhead=null means
  // an indefinite manual promotion (no expiry, won't be auto-demoted).
  // Anything > 0 creates a time-limited trial that the daily cron will
  // auto-expire on the resulting date (and email the therapist).
  async function confirmPromote(id: string, monthsAhead: number | null) {
    setPromotingId(null);
    if (monthsAhead === null) {
      await updateStatus(id, "paying");
      return;
    }
    const d = new Date();
    if (monthsAhead === 12) d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + monthsAhead);
    await updateStatus(id, "paying", d.toISOString());
  }

  if (loading) return <div className="p-6 text-center">טוען מטפלים...</div>;
  if (error) return <div className="p-6 text-center text-red-600">שגיאה: {error}</div>;
  if (therapists.length === 0) return <div className="p-6 text-center">לא נמצאו מטפלים.</div>;

  const hasActiveFilter = filterName || filterGender || filterTherapistType || filterTrainingArea || filterCultural || filterAgeGroup;

  function matchesFilters(t: AdminTherapist) {
    if (filterName && !t.full_name.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterGender && t.gender !== filterGender) return false;
    if (filterTherapistType && !t.therapist_types.includes(filterTherapistType)) return false;
    if (filterTrainingArea && !t.training_areas.includes(filterTrainingArea)) return false;
    if (filterCultural && !t.cultural_prefs.includes(filterCultural)) return false;
    if (filterAgeGroup && !t.age_groups.includes(filterAgeGroup)) return false;
    return true;
  }

  const isListed = (t: AdminTherapist) => t.admin_approved && (t.status === "approved" || t.status === "paying");
  const allFiltered = hasActiveFilter ? therapists.filter(matchesFilters) : null;
  const pending = hasActiveFilter ? [] : therapists.filter((t) => !isListed(t));
  const approved = (hasActiveFilter ? allFiltered! : therapists.filter(isListed));

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
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${
                  therapist.status === "paying" && !therapist.admin_approved ? "bg-orange-100 text-orange-800 border border-orange-400" :
                  therapist.status === "paying" ? "bg-yellow-100 text-yellow-800 border border-yellow-400" :
                  therapist.status === "approved" ? "bg-green-100 text-green-800" :
                  therapist.status === "rejected" ? "bg-red-100 text-red-800" :
                  "bg-gray-100 text-gray-700"
                }`}>
                  {therapist.status === "paying" && !therapist.admin_approved ? "💳 שילם — ממתין לאישור" :
                   therapist.status === "paying" ? "★ מקודם" :
                   therapist.status === "approved" ? "מאושר (חינמי)" :
                   therapist.status === "rejected" ? "נדחה" : "ממתין לאישור"}
                </span>
                {therapist.status === "paying" && therapist.promotion_source === "paid" && (
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 border border-blue-300">
                    💳 משלם דרך Sumit
                  </span>
                )}
                {therapist.status === "paying" && therapist.promotion_source === "manual" && (
                  <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-800 border border-purple-300">
                    🎁 מתנה (ללא תפוגה)
                  </span>
                )}
                {therapist.status === "paying" && therapist.promotion_source === "trial" && therapist.promoted_until && (
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800 border border-orange-300">
                    ⏰ ניסיון עד {new Date(therapist.promoted_until).toLocaleDateString("he-IL")}
                  </span>
                )}
                {therapist.certificates.length === 0 && (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 border border-red-300">
                    ⚠️ חסרה תעודה
                  </span>
                )}
                {therapist.full_name.trim().split(/\s+/).filter(Boolean).length < 2 && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-300">
                    ⚠️ חסר שם משפחה
                  </span>
                )}
              </div>
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

            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 text-sm font-medium text-gray-800">
                תעודות שהוגשו ({therapist.certificates.length}):
              </div>
              {therapist.certificates.length === 0 ? (
                <div className="text-sm text-gray-400">לא הועלו תעודות</div>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {therapist.certificates.map((c) => (
                    <li key={c.id}>
                      {c.signed_url ? (
                        <a
                          href={c.signed_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-[#2e7d8c] bg-white px-3 py-1.5 text-xs font-medium text-[#2e7d8c] hover:bg-[#2e7d8c] hover:text-white transition-colors"
                        >
                          📄 {c.original_name}
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-400">
                          📄 {c.original_name} (קישור לא זמין)
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" disabled={isBusy}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => openEdit(therapist)}>
                ערוך
              </button>
              {therapist.status === "paying" && !therapist.admin_approved && (
                <button type="button" disabled={isBusy}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  onClick={() => approveListing(therapist.id)}>
                  {isBusy ? "מאשר..." : "✓ אשר להצגה"}
                </button>
              )}
              {therapist.status !== "approved" && therapist.status !== "paying" && (
                <button type="button" disabled={isBusy}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                  onClick={() => updateStatus(therapist.id, "approved")}>
                  {isBusy ? "מעדכן..." : "אשר (חינמי)"}
                </button>
              )}
              {therapist.status === "approved" && (
                <button type="button" disabled={isBusy}
                  className="rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#b8860b,#d4a017)" }}
                  onClick={() => setPromotingId(therapist.id)}>
                  {isBusy ? "מעדכן..." : "★ שדרג למקודם"}
                </button>
              )}
              {therapist.status === "paying" && (therapist.promotion_source === "manual" || therapist.promotion_source === "trial") && (
                <button type="button" disabled={isBusy}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                  onClick={() => updateStatus(therapist.id, "approved")}>
                  {isBusy ? "מעדכן..." : "הורד לחינמי"}
                </button>
              )}
              {therapist.status === "paying" && therapist.promotion_source === "paid" && (
                <button type="button" disabled={isBusy}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                  onClick={() => {
                    if (window.confirm("המטפל משלם דרך Sumit. הורדה תבטל את הוראת הקבע ותשלח לו מייל. להמשיך?"))
                      updateStatus(therapist.id, "approved");
                  }}>
                  {isBusy ? "מעדכן..." : "בטל מנוי + הורד"}
                </button>
              )}
              {therapist.status === "paying" && !therapist.promotion_source && (
                <span className="rounded-xl bg-stone-100 px-4 py-2 text-sm text-stone-400 border border-stone-200" title="מצב לא עקבי — נסה רענון">
                  ⚠ מצב לא עקבי
                </span>
              )}
              {missingProfileFields(therapist, therapist.certificates.length > 0).length > 0 && (
                <button type="button" disabled={isBusy}
                  className="rounded-xl border border-blue-400 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800 disabled:opacity-50"
                  onClick={() => openCompletion(therapist)}>
                  ✉️ בקש השלמה
                </button>
              )}
              <button type="button" disabled={isBusy}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => {
                  const reason = window.prompt(
                    "סיבת הדחייה (תישלח למטפל/ת. למשל: התעודה אינה קריאה — נא להעלות תעודת רישיון ברורה):",
                    ""
                  );
                  if (reason === null) return;
                  updateStatus(therapist.id, "rejected", null, reason);
                }}>
                {isBusy ? "מעדכן..." : "דחה"}
              </button>
              <button type="button" disabled={isBusy}
                className="rounded-xl bg-gray-500 px-4 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => updateStatus(therapist.id, "pending")}>
                {isBusy ? "מעדכן..." : "החזר להמתנה"}
              </button>
              <button type="button" disabled={reconcilingId === therapist.id}
                className="rounded-xl border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 disabled:opacity-50"
                onClick={() => reconcileSumit(therapist.id)}>
                {reconcilingId === therapist.id ? "בודק ב-Sumit..." : "בדוק/בטל הוראת קבע ב-Sumit"}
              </button>
              <button type="button" disabled={isBusy}
                className="rounded-xl bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => deleteTherapist(therapist.id)}>
                {isBusy ? "מוחק..." : "מחק"}
              </button>
            </div>
            {reconcileResults[therapist.id] && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 whitespace-pre-line">
                {reconcileResults[therapist.id]}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isBypassed = typeof window !== "undefined" && !!localStorage.getItem("staff_token");

  const incompleteCount = therapists.filter(
    (t) => t.status !== "rejected" && missingProfileFields(t, t.certificates.length > 0).length > 0
  ).length;

  return (
    <main className="mx-auto max-w-6xl p-6" dir="rtl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">ניהול מטפלים</h1>
        <button
          onClick={() => {
            // Stores the STAFF_BYPASS_TOKEN locally; it's sent to the score
            // routes, which validate it server-side and skip the free limit.
            if (isBypassed) { localStorage.removeItem("staff_token"); window.location.reload(); }
            else {
              const token = window.prompt("הזן את טוקן ה-staff (STAFF_BYPASS_TOKEN):");
              if (token) { localStorage.setItem("staff_token", token); window.location.reload(); }
            }
          }}
          className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${isBypassed ? "bg-green-100 text-green-700 border-green-300" : "bg-stone-100 text-stone-600 border-stone-300"}`}
        >
          {isBypassed ? "✓ מצב אדמין פעיל (ללא הגבלת שאלון)" : "הפעל מצב אדמין"}
        </button>
      </div>

      {error && <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {incompleteCount > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-900">
          <span className="font-bold">{incompleteCount}</span> פרופילים עם פרטים חסרים (תעודה / תמונה / שם משפחה / אזורים וכו׳). עבור/עברי עליהם אחד-אחד — בכל פרופיל חסר יופיע כפתור <span className="font-semibold">&quot;✉️ בקש השלמה&quot;</span> לשליחה ידנית, רק באישורך.
        </div>
      )}

      {/* ── סינון וחיפוש ── */}
      <div className="mb-8 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setShowFilters(!showFilters)} className="text-sm font-bold text-stone-700 hover:text-stone-900">
            {showFilters ? "▾ סגור מסננים" : "▸ פתח מסננים"}
          </button>
          {hasActiveFilter && (
            <button onClick={() => { setFilterName(""); setFilterGender(""); setFilterTherapistType(""); setFilterTrainingArea(""); setFilterCultural(""); setFilterAgeGroup(""); }}
              className="text-xs text-red-500 hover:underline">נקה הכל</button>
          )}
        </div>

        <input
          type="text"
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
          placeholder="חיפוש לפי שם..."
          className="mb-3 w-full rounded-xl border px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
        />

        {showFilters && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-600">מגדר</label>
              <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)}
                className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm">
                <option value="">הכל</option>
                <option value="זכר">זכר</option>
                <option value="נקבה">נקבה</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-600">סוג מטפל</label>
              <select value={filterTherapistType} onChange={(e) => setFilterTherapistType(e.target.value)}
                className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm">
                <option value="">הכל</option>
                {THERAPIST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-600">תחום טיפול</label>
              <select value={filterTrainingArea} onChange={(e) => setFilterTrainingArea(e.target.value)}
                className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm">
                <option value="">הכל</option>
                {TRAINING_AREAS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-600">העדפות תרבותיות</label>
              <select value={filterCultural} onChange={(e) => setFilterCultural(e.target.value)}
                className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm">
                <option value="">הכל</option>
                {CULTURAL_PREFS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-600">קבוצת גיל</label>
              <select value={filterAgeGroup} onChange={(e) => setFilterAgeGroup(e.target.value)}
                className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm">
                <option value="">הכל</option>
                {AGE_GROUPS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── ממתינים לאישור / נדחו ── */}
      {!hasActiveFilter && (
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
      )}

      {/* ── מאושרים / תוצאות סינון ── */}
      <section>
        <h2 className="mb-4 text-xl font-bold text-right border-b pb-2">
          {hasActiveFilter ? `תוצאות סינון (${approved.length})` : `מאושרים (${approved.length})`}
        </h2>
        {approved.length === 0 ? (
          <p className="text-center text-gray-500">לא נמצאו מטפלים.</p>
        ) : (
          <div className="space-y-6">
            {approved.map((t) => <TherapistCard key={t.id} therapist={t} />)}
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

      {promotingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          dir="rtl"
          onClick={() => setPromotingId(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-lg font-bold text-stone-900">שדרוג למסלול המקודם</h3>
            <p className="mb-5 text-sm text-stone-600">
              לכמה זמן להעניק את ההטבה? בסיום התקופה הקידום ייפסק אוטומטית והמטפל יקבל מייל.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => confirmPromote(promotingId, null)}
                className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-800 hover:bg-stone-50"
              >
                לתמיד
                <div className="mt-0.5 text-[11px] font-normal text-stone-500">ללא תאריך תפוגה</div>
              </button>
              <button
                type="button"
                onClick={() => confirmPromote(promotingId, 1)}
                className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100"
              >
                חודש
              </button>
              <button
                type="button"
                onClick={() => confirmPromote(promotingId, 2)}
                className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100"
              >
                חודשיים
              </button>
              <button
                type="button"
                onClick={() => confirmPromote(promotingId, 6)}
                className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100"
              >
                חצי שנה
              </button>
              <button
                type="button"
                onClick={() => confirmPromote(promotingId, 12)}
                className="col-span-2 rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100"
              >
                שנה
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPromotingId(null)}
              className="mt-4 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-600 hover:bg-stone-100"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {completionFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl"
          onClick={() => setCompletionFor(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-lg font-bold text-stone-900">בקשת השלמה — {completionFor.full_name || "מטפל/ת"}</h3>
            <p className="mb-3 text-sm text-stone-600">
              כתוב/כתבי את ההודעה שתישלח למייל של המטפל/ת. מולאה טיוטה לפי מה שחסר — אפשר לערוך, להוסיף או למחוק לגמרי ולכתוב משלך.
            </p>
            <textarea
              value={completionText}
              onChange={(e) => setCompletionText(e.target.value)}
              rows={7}
              dir="rtl"
              className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="מה תרצה/י לבקש מהמטפל/ת?"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setCompletionFor(null)}
                className="rounded-xl border border-stone-300 bg-white px-5 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">
                ביטול
              </button>
              <button type="button" onClick={sendCompletion} disabled={completionSending || !completionText.trim()}
                className="rounded-xl bg-[#2e7d8c] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {completionSending ? "שולח..." : "✉️ שלח למטפל/ת"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
