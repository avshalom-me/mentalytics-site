"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { REGION_CITIES, ALL_REGIONS, CITY_TO_REGION } from "@/app/lib/regions";
import { FREE_REGION_FALLBACK_ENABLED, regionsCovered, expertiseOf } from "@/app/lib/match-fallback";
import {
  THERAPIST_TYPES, TRAINING_AREAS, ASSESSMENT_TYPES,
  CULTURAL_PREFS, AGE_GROUPS, ARRANGEMENTS,
} from "@/app/lib/therapist-options";
import { missingProfileFields } from "@/app/lib/profile-completeness";
import { EXPENSE_CATEGORIES, REFUND_CATEGORIES, VAT_RATE } from "@/app/lib/crm";
import TherapistCrmPanel from "./components/TherapistCrmPanel";

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
  languages: string[];
  couples_modalities: string[];
  cogfun_age_groups: string[];
  education: string;
  experience: string;
  style_q1: number | null;
  style_q2: number | null;
  activity_level: number | null;
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
  views_30d: number;
  contacts_30d: number;
  subscription: { status: string; current_period_end: string | null; promo_reverts_at: string | null } | null;
  center_account_id: string | null;
  center_name: string | null;
  missing: string[];
  completion_requested_at: string | null;
  profile_updated_at: string | null;
  article_invite_sent_at: string | null;
  accepting_new_patients: boolean;
  accepting_new_changed_at: string | null;
};

type EditForm = {
  full_name: string;
  email: string;
  phone: string;
  bio: string;
  gender: string;
  online: boolean;
  accepting_new_patients: boolean;
  therapist_types: string[];
  training_areas: string[];
  assessment_types: string[];
  regions: string[];
  cultural_prefs: string[];
  arrangements: string[];
  style_q1: number | null;
  style_q2: number | null;
  activity_level: number | null;
};

function toggleItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

// A stub row = an account that registered but never saved the profile form
// (auto-created at first login, or backfilled). No name yet — shown in a
// dedicated "registered but incomplete" section, not in the review queues.
function isStub(t: AdminTherapist): boolean {
  return !(t.full_name ?? "").trim();
}

// Default reminder for registrants who never finished the profile form. The
// email template opens with "שלום מטפל/ת יקר/ה," and closes with the edit
// button + contact footer, so this is just the middle. Editable before send.
const SIGNUP_REMINDER_DRAFT = `שמנו לב שנרשמת לטיפול חכם, אבל טופס הפרופיל עדיין לא הושלם — ולכן הפרופיל שלך עוד לא מוצג למטופלים שמחפשים מטפל/ת.

ההשלמה אורכת כ-5 דקות: פרטים מקצועיים, תמונת פרופיל ותעודת רישיון. אחרי אישור קצר מצידנו הפרופיל יופיע במערכת ההתאמה ובמדריך המטפלים — המסלול הבסיסי חינמי לגמרי.

אם נתקלת בקושי טכני או בשאלה — אפשר לכתוב לנו ל-admin@getmentalytics.com ונשמח לעזור.`;

// ── Personalized reminder for PARTIAL profiles (form saved, items missing) ──
// The greeting ("שלום {שם},") comes from the email template; this builds the
// body. The photo is deliberately framed as optional-but-recommended, and a
// photo-only gap gets its own friendlier message.
const PARTIAL_REMINDER_INTRO = `הפרופיל שלך בטיפול חכם כבר במערכת — נשאר להשלים כמה פרטים כדי שנוכל לאשר ולהציג אותו למטופלים שמחפשים מטפל/ת:`;

const PHOTO_FIELD = "תמונת פרופיל";

function partialReminderMessage(missing: string[], intro: string = PARTIAL_REMINDER_INTRO): string {
  const photoOnly = missing.length === 1 && missing[0] === PHOTO_FIELD;
  if (photoOnly) {
    return `הפרופיל שלך בטיפול חכם מלא וכולל את כל הפרטים הנדרשים — חסרה בו רק תמונת פרופיל.

התמונה אופציונלית, אבל מניסיוננו פרופילים עם תמונה מקבלים משמעותית יותר פניות ממטופלים. ההעלאה אורכת פחות מדקה מעמוד עריכת הפרופיל.`;
  }
  const bullets = missing
    .map((m) => (m === PHOTO_FIELD ? `• ${m} (אופציונלי — אך פרופילים עם תמונה מקבלים יותר פניות)` : `• ${m}`))
    .join("\n");
  return `${intro}
${bullets}

ההשלמה אורכת דקות ספורות מעמוד עריכת הפרופיל, ולאחר השמירה הפרופיל נשלח אלינו אוטומטית לבדיקה.`;
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

// One row of the therapeutic-style questionnaire (1–7 scale). value=null means
// the therapist never answered it; "—" clears it back to null.
function StyleScaleRow({
  question, low, high, value, onChange,
}: {
  question: string;
  low: string;
  high: string;
  value: number | null;
  onChange: (val: number | null) => void;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1 text-sm font-semibold text-stone-800">{question}</div>
      <div className="mb-1.5 text-xs text-stone-500">1 = {low} · 7 = {high}</div>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
      >
        <option value="">— לא נענה —</option>
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </div>
  );
}


const DEFAULT_MESSAGE_SUBJECT = "הודעה מצוות טיפול חכם";

// מודל שליחת הודעה — קומפוננטה נפרדת עם state מקומי לנושא/תוכן, כדי שהקלדה
// תרנדר רק את המודל ולא את כל דף האדמין (שאחרת מפרק ובונה מחדש את כל כרטיסי
// המטפלים בכל תו — מה שגרם לתקיעה של שניות בין הקשה להקשה).
function MessageModal({
  therapist, sending, onClose, onSend,
}: {
  therapist: AdminTherapist;
  sending: boolean;
  onClose: () => void;
  onSend: (subject: string, text: string) => void;
}) {
  const [subject, setSubject] = useState(DEFAULT_MESSAGE_SUBJECT);
  const [text, setText] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl"
      onClick={() => { if (!sending) onClose(); }}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 text-lg font-bold text-stone-900">
          שליחת הודעה — {therapist.full_name.trim() || therapist.email || "מטפל/ת"}
        </h3>
        <p className="mb-3 text-sm text-stone-600 leading-6">
          ההודעה תישלח למייל של המטפל/ת עם כפתור <b>קישור ישיר לעריכת הפרופיל</b>. מתאים גם
          לפרופיל שנראה שלם — למשל אם הועלתה תעודה במקום תמונה.
        </p>
        <label className="mb-1 block text-sm font-semibold text-stone-800">נושא</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          dir="rtl"
          disabled={sending}
          className="mb-3 w-full rounded-xl border border-stone-300 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
        />
        <label className="mb-1 block text-sm font-semibold text-stone-800">תוכן ההודעה</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          dir="rtl"
          disabled={sending}
          className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
          placeholder="לדוגמה: שמנו לב שהתמונה שהעלית היא בעצם תעודה. אפשר להעלות תמונת פרופיל דרך הקישור המצורף."
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={sending}
            className="rounded-xl border border-stone-300 bg-white px-5 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50">
            ביטול
          </button>
          <button type="button" onClick={() => onSend(subject, text)} disabled={sending || !text.trim()}
            className="rounded-xl bg-[#2e7d8c] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {sending ? "שולח..." : "✉️ שלח למטפל/ת"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminTherapistsPage() {
  const [therapists, setTherapists] = useState<AdminTherapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
  const [filterPromotion, setFilterPromotion] = useState("");
  const [filterAvailability, setFilterAvailability] = useState("");
  const [filterRegion, setFilterRegion] = useState(""); // אזור גיאוגרפי או "__online__"
  const [showFilters, setShowFilters] = useState(false);

  // ── Tabbed workspace ──
  // The page used to stack every group (pending → approved → partial → signups)
  // as one endless scroll of tall cards. Now one group shows at a time, and the
  // long "approved" group is a compact table that expands a full card per row.
  const [activeTab, setActiveTab] = useState<"action" | "approved" | "rejected" | "partial" | "signups">("action");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [approvedLimit, setApprovedLimit] = useState(50);
  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // Edit modal state
  const [editingTherapist, setEditingTherapist] = useState<AdminTherapist | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  // Snapshot of the therapist as loaded when the modal opened — saveEdit diffs
  // against it and PATCHes only the fields the admin actually changed.
  const [editBaseline, setEditBaseline] = useState<EditForm | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [giftMonths, setGiftMonths] = useState(1);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [completionFor, setCompletionFor] = useState<AdminTherapist | null>(null);
  const [completionText, setCompletionText] = useState("");
  const [completionSending, setCompletionSending] = useState(false);

  // Rejection dialog — replaces the old window.prompt so the admin can also
  // choose whether the therapist gets the rejection email (silent reject).
  const [rejectFor, setRejectFor] = useState<AdminTherapist | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNotify, setRejectNotify] = useState(true);
  const [rejectSaving, setRejectSaving] = useState(false);

  // ביטול מנוי של מטפל משלם - מחליף את ה-window.confirm, כדי שאפשר יהיה
  // לרשום באותה פעולה גם את ההחזר הכספי. הזיכוי עצמו נעשה ב-Sumit; כאן רק
  // נרשמת שורת ההוצאה בספר, אחרת ההחזר לא מתועד בשום מקום.
  const [cancelPayingFor, setCancelPayingFor] = useState<AdminTherapist | null>(null);
  const [cancelSaving, setCancelSaving] = useState(false);
  const [refundChecked, setRefundChecked] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundDate, setRefundDate] = useState("");
  const [refundCategory, setRefundCategory] = useState("refund_guarantee");
  const [refundDoc, setRefundDoc] = useState("");
  const [refundNote, setRefundNote] = useState("");
  const [refundResults, setRefundResults] = useState<Record<string, string>>({});

  // General "send a message" composer — available for ANY therapist, including
  // complete profiles (e.g. someone who uploaded a cert into the photo slot).
  const [messageFor, setMessageFor] = useState<AdminTherapist | null>(null);
  const [messageSending, setMessageSending] = useState(false);

  // Bulk signup-reminder modal (for the "registered but incomplete" section)
  const [bulkReminderOpen, setBulkReminderOpen] = useState(false);
  const [bulkReminderText, setBulkReminderText] = useState(SIGNUP_REMINDER_DRAFT);
  const [bulkReminderSending, setBulkReminderSending] = useState(false);
  const [bulkReminderProgress, setBulkReminderProgress] = useState("");

  // מצב מרכז (?center=<id>) — העמוד מציג רק את מטפלי המרכז; ברירת המחדל
  // מסתירה משויכי-מרכז לגמרי (ניהולם תחת "מרכזים טיפוליים").
  const [centerScope, setCenterScope] = useState<string | null>(null);
  const [centerScopeName, setCenterScopeName] = useState("");

  // Bulk PERSONALIZED reminder modal (for the partial-profiles section).
  // Only the intro is edited; each recipient gets their own missing-items list.
  const [partialBulkOpen, setPartialBulkOpen] = useState(false);
  const [partialBulkIntro, setPartialBulkIntro] = useState(PARTIAL_REMINDER_INTRO);
  const [partialBulkSending, setPartialBulkSending] = useState(false);
  const [partialBulkProgress, setPartialBulkProgress] = useState("");

  const loadTherapists = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) {
        setLoading(true);
        setError("");
      }

      const res = await fetch("/api/admin-therapists", { cache: "no-store" });
      const json = await res.json();

      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load admin therapists");
      // ניהול מרכזים נעשה תחת /admin/centers, לא כאן: כברירת מחדל מטפלים
      // משויכי-מרכז (וגם שורת ישות-מרכז) מוסתרים מהעמוד. עם ?center=<id>
      // (כניסה מכרטיס המרכז) העמוד מציג את מטפלי אותו מרכז בלבד.
      const scope = new URLSearchParams(window.location.search).get("center");
      const all = (json.therapists ?? []) as AdminTherapist[];
      const rows = scope ? all.filter((t) => t.center_account_id === scope) : all.filter((t) => !t.center_account_id);
      setCenterScope(scope);
      setCenterScopeName(scope ? rows.find((t) => t.center_name)?.center_name ?? "" : "");
      setTherapists(rows);
      // Fresh signed URLs — clear images previously marked broken (expired URL).
      setBrokenImages({});
    } catch (err) {
      // A failed silent refresh keeps the data we already have on screen.
      if (!opts?.silent) setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTherapists();
  }, [loadTherapists]);

  // The admin tab is a long-lived workspace while therapists keep editing their
  // profiles. Refetch whenever the tab regains focus so the list never goes stale.
  useEffect(() => {
    const onFocus = () => loadTherapists({ silent: true });
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadTherapists]);

  function toEditForm(t: AdminTherapist): EditForm {
    return {
      full_name: t.full_name,
      email: t.email,
      phone: t.phone,
      bio: t.bio,
      gender: t.gender,
      online: t.online,
      accepting_new_patients: t.accepting_new_patients !== false,
      therapist_types: [...t.therapist_types],
      training_areas: [...t.training_areas],
      assessment_types: [...t.assessment_types],
      regions: [...t.regions],
      cultural_prefs: [...t.cultural_prefs],
      arrangements: [...t.arrangements],
      style_q1: t.style_q1,
      style_q2: t.style_q2,
      activity_level: t.activity_level,
    };
  }

  // Re-fetch the single therapist before opening the modal: editing a stale
  // page-load snapshot used to overwrite updates the therapist made in the
  // meantime (the modal saved ALL fields from old data).
  async function openEdit(t: AdminTherapist) {
    setEditError("");
    setActionLoadingId(t.id);
    let fresh = t;
    try {
      const res = await fetch(`/api/admin-therapists?id=${encodeURIComponent(t.id)}`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.ok && json.therapists?.[0]) {
        fresh = json.therapists[0] as AdminTherapist;
        setTherapists((prev) => prev.map((x) => (x.id === t.id ? fresh : x)));
      }
    } catch {
      // Network hiccup — fall back to the data we have rather than blocking the edit.
    }
    setActionLoadingId(null);
    setEditBaseline(toEditForm(fresh));
    setEditForm(toEditForm(fresh));
    setEditingTherapist(fresh);
  }

  async function saveEdit() {
    if (!editingTherapist || !editForm) return;
    // Send only what actually changed vs. the freshly-loaded baseline, so an
    // admin save can never clobber fields it didn't touch.
    const changed: Record<string, unknown> = {};
    if (editBaseline) {
      for (const key of Object.keys(editForm) as (keyof EditForm)[]) {
        const a = editForm[key];
        const b = editBaseline[key];
        const equal = Array.isArray(a) && Array.isArray(b)
          ? a.length === b.length && a.every((v, i) => v === b[i])
          : a === b;
        if (!equal) changed[key] = a;
      }
    } else {
      Object.assign(changed, editForm);
    }
    if (Object.keys(changed).length === 0) {
      setEditingTherapist(null);
      setEditForm(null);
      setEditBaseline(null);
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {
      const res = await fetch("/api/admin-therapists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingTherapist.id, fields: changed }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to save");
      setTherapists((prev) =>
        prev.map((t) => t.id === editingTherapist.id ? { ...t, ...changed } : t)
      );
      setEditingTherapist(null);
      setEditForm(null);
      setEditBaseline(null);
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
    reason?: string,
    giftMonthsCount?: number | null,
    notifyRejection?: boolean
  ): Promise<boolean> {
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
          ...(giftMonthsCount ? { gift_months: giftMonthsCount } : {}),
          ...(reason ? { reason } : {}),
          // Only sent as false — absent means the server default (email on).
          ...(notifyRejection === false ? { notify_rejection: false } : {}),
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
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return false;
    } finally {
      setActionLoadingId(null);
    }
  }

  // רישום החזר כספי שכבר בוצע (או עומד להתבצע) ידנית בדשבורד של Sumit.
  // לא נוגע בכסף - רק כותב שורת הוצאה בספר + שורת audit, כדי שהמאזן החודשי
  // ידע על הכסף שיצא. מוחזר טקסט לתצוגה, או null אם לא נרשם כלום.
  async function recordRefund(id: string): Promise<string | null> {
    const gross = Number(refundAmount);
    if (!Number.isFinite(gross) || gross <= 0) {
      setError("סכום ההחזר אינו תקין - ההחזר לא נרשם (הביטול עצמו בוצע).");
      return null;
    }
    try {
      const res = await fetch("/api/admin-therapists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action: "record_refund",
          amount_gross: gross,
          category: refundCategory,
          ...(refundDate ? { refund_date: refundDate } : {}),
          ...(refundDoc.trim() ? { sumit_doc_id: refundDoc.trim() } : {}),
          ...(refundNote.trim() ? { note: refundNote.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "רישום ההחזר נכשל");
      return `💸 נרשם החזר של ₪${gross} (₪${json.net} + ₪${json.vat} מע"מ) בתאריך ${json.refund_date}. מופיע עכשיו כהוצאה במסך הכספים.`;
    } catch (err) {
      setError(
        `הביטול בוצע, אך רישום ההחזר נכשל: ${err instanceof Error ? err.message : "שגיאה"}. אפשר להוסיף אותו ידנית במסך הכספים.`
      );
      return null;
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
    setCompletionText(
      isStub(t)
        ? SIGNUP_REMINDER_DRAFT
        : partialReminderMessage(missingProfileFields(t, t.certificates.length > 0))
    );
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
      const sentAt = json.completion_requested_at ?? new Date().toISOString();
      setTherapists((prev) =>
        prev.map((x) => (x.id === completionFor.id ? { ...x, completion_requested_at: sentAt } : x))
      );
      setCompletionFor(null);
      window.alert("בקשת ההשלמה נשלחה למטפל/ת.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCompletionSending(false);
    }
  }

  // Sends the signup reminder to every stub that hasn't received one yet,
  // one request at a time (each request = one email server-side), with live
  // progress. Failures don't stop the run; they're reported at the end.
  async function sendBulkReminders() {
    const targets = therapists.filter((t) => isStub(t) && !t.completion_requested_at && t.email);
    if (targets.length === 0 || !bulkReminderText.trim()) return;
    setBulkReminderSending(true);
    const failures: string[] = [];
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      setBulkReminderProgress(`שולח ${i + 1} מתוך ${targets.length}...`);
      try {
        const res = await fetch("/api/admin-therapists", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: t.id, action: "request_completion", message: bulkReminderText }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || "שליחה נכשלה");
        const sentAt = json.completion_requested_at ?? new Date().toISOString();
        setTherapists((prev) =>
          prev.map((x) => (x.id === t.id ? { ...x, completion_requested_at: sentAt } : x))
        );
      } catch {
        failures.push(t.email);
      }
    }
    setBulkReminderSending(false);
    setBulkReminderProgress("");
    setBulkReminderOpen(false);
    if (failures.length) {
      window.alert(`נשלחו ${targets.length - failures.length} תזכורות. נכשלו (${failures.length}): ${failures.join(", ")}`);
    } else {
      window.alert(`נשלחו ${targets.length} תזכורות בהצלחה.`);
    }
  }

  function openMessage(t: AdminTherapist) {
    setMessageFor(t);
  }

  async function sendMessage(subject: string, message: string) {
    if (!messageFor || !message.trim()) return;
    try {
      setMessageSending(true);
      setError("");
      const res = await fetch("/api/admin-therapists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: messageFor.id,
          action: "send_message",
          subject,
          message,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "שליחה נכשלה");
      setMessageFor(null);
      window.alert("ההודעה נשלחה למטפל/ת.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setMessageSending(false);
    }
  }

  // One-click "write an article, get 2 months promoted free" invite. Fixed
  // template (no composer) — confirms, sends, and reports. Does not change the
  // therapist's status; the gift is granted manually once an article lands.
  async function sendArticleInvite(t: AdminTherapist) {
    if (!t.email) {
      window.alert("למטפל/ת אין כתובת מייל.");
      return;
    }
    if (!window.confirm(
      `לשלוח ל${t.full_name.trim() || t.email} הזמנה לכתוב מאמר בתמורה לחודשיים קידום במתנה?`
    )) return;
    try {
      setActionLoadingId(t.id);
      setError("");
      const res = await fetch("/api/admin-therapists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id, action: "article_invite" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "שליחה נכשלה");
      const sentAt = json.article_invite_sent_at ?? new Date().toISOString();
      setTherapists((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, article_invite_sent_at: sentAt } : x))
      );
      window.alert("ההזמנה לכתיבת מאמר נשלחה למטפל/ת.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setActionLoadingId(null);
    }
  }

  // Sends a PERSONALIZED completion reminder to every partial profile that
  // hasn't received one yet: same intro, but each recipient's email lists
  // exactly what THEY are missing (photo framed as optional). The email
  // template itself greets them by name.
  async function sendBulkPartialReminders() {
    const targets = partials.filter((t) => !t.completion_requested_at && t.email);
    if (targets.length === 0) return;
    setPartialBulkSending(true);
    const failures: string[] = [];
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      setPartialBulkProgress(`שולח ${i + 1} מתוך ${targets.length}...`);
      const message = partialReminderMessage(
        missingProfileFields(t, t.certificates.length > 0),
        partialBulkIntro.trim() || PARTIAL_REMINDER_INTRO
      );
      try {
        const res = await fetch("/api/admin-therapists", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: t.id, action: "request_completion", message }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || "שליחה נכשלה");
        const sentAt = json.completion_requested_at ?? new Date().toISOString();
        setTherapists((prev) =>
          prev.map((x) => (x.id === t.id ? { ...x, completion_requested_at: sentAt } : x))
        );
      } catch {
        failures.push(t.full_name || t.email);
      }
    }
    setPartialBulkSending(false);
    setPartialBulkProgress("");
    setPartialBulkOpen(false);
    if (failures.length) {
      window.alert(`נשלחו ${targets.length - failures.length} תזכורות. נכשלו (${failures.length}): ${failures.join(", ")}`);
    } else {
      window.alert(`נשלחו ${targets.length} תזכורות מותאמות בהצלחה.`);
    }
  }

  // Downscale a large image in the browser so it stays under Vercel's ~4.5MB
  // request-body cap before hitting the admin photo route (phone photos are
  // routinely bigger). Only kicks in for oversized files; the server still
  // does the final resize/compress. Mirrors the therapist edit page.
  async function downscaleForUpload(file: File): Promise<File> {
    if (!file.type.startsWith("image/") || file.size <= 4 * 1024 * 1024) return file;
    try {
      const url = URL.createObjectURL(file);
      const img = document.createElement("img");
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("load failed"));
        img.src = url;
      });
      const maxDim = 1200;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); return file; }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
      return blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file;
    } catch {
      return file;
    }
  }

  // Admin replaces a therapist's profile photo (compressed server-side).
  async function uploadAdminPhoto(therapistId: string, file: File) {
    try {
      setPhotoBusy(true);
      setEditError("");
      const toSend = await downscaleForUpload(file);
      const fd = new FormData();
      fd.append("therapistId", therapistId);
      fd.append("file", toSend);
      const res = await fetch("/api/admin-therapist-photo", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "העלאת התמונה נכשלה");
      setBrokenImages((prev) => { const n = { ...prev }; delete n[therapistId]; return n; });
      setTherapists((prev) =>
        prev.map((t) => (t.id === therapistId ? { ...t, profile_photo_url: json.photoUrl, profile_photo_path: json.path } : t))
      );
      setEditingTherapist((prev) =>
        prev && prev.id === therapistId ? { ...prev, profile_photo_url: json.photoUrl, profile_photo_path: json.path } : prev
      );
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPhotoBusy(false);
    }
  }

  // Admin removes a therapist's profile photo (e.g. a wrong image / a cert
  // uploaded into the photo slot).
  async function deleteAdminPhoto(therapistId: string) {
    if (!window.confirm("למחוק את תמונת הפרופיל של המטפל/ת?")) return;
    try {
      setPhotoBusy(true);
      setEditError("");
      const res = await fetch("/api/admin-therapists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: therapistId, action: "delete_photo" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "מחיקת התמונה נכשלה");
      setTherapists((prev) =>
        prev.map((t) => (t.id === therapistId ? { ...t, profile_photo_url: null, profile_photo_path: null } : t))
      );
      setEditingTherapist((prev) =>
        prev && prev.id === therapistId ? { ...prev, profile_photo_url: null, profile_photo_path: null } : prev
      );
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPhotoBusy(false);
    }
  }

  // Delete a single certificate (e.g. the therapist uploaded the wrong file).
  async function deleteCert(therapistId: string, certId: string, certName: string) {
    if (!window.confirm(`למחוק את התעודה "${certName}"? פעולה זו אינה הפיכה.`)) return;
    try {
      setActionLoadingId(therapistId);
      setError("");
      const res = await fetch("/api/admin-therapists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: therapistId, action: "delete_cert", certId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "מחיקה נכשלה");
      setTherapists((prev) =>
        prev.map((t) =>
          t.id === therapistId
            ? { ...t, certificates: t.certificates.filter((c) => c.id !== certId) }
            : t
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setActionLoadingId(null);
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
    await updateStatus(id, "paying", d.toISOString(), undefined, monthsAhead);
  }

  if (loading) return <div className="p-6 text-center">טוען מטפלים...</div>;
  if (error) return <div className="p-6 text-center text-red-600">שגיאה: {error}</div>;
  if (therapists.length === 0) return <div className="p-6 text-center">לא נמצאו מטפלים.</div>;

  const hasActiveFilter = filterName || filterGender || filterTherapistType || filterTrainingArea || filterCultural || filterAgeGroup || filterPromotion || filterAvailability || filterRegion;

  function matchesFilters(t: AdminTherapist) {
    if (filterName && !t.full_name.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterGender && t.gender !== filterGender) return false;
    if (filterTherapistType && !t.therapist_types.includes(filterTherapistType)) return false;
    if (filterTrainingArea && !t.training_areas.includes(filterTrainingArea)) return false;
    if (filterCultural && !t.cultural_prefs.includes(filterCultural)) return false;
    if (filterAgeGroup && !t.age_groups.includes(filterAgeGroup)) return false;
    if (filterPromotion) {
      const isPaying = t.status === "paying";
      const isPaid = isPaying && t.promotion_source === "paid";
      if (filterPromotion === "paid" && !isPaid) return false;       // מקודם (בתשלום)
      if (filterPromotion === "gift" && !(isPaying && !isPaid)) return false; // מקודם במתנה
      if (filterPromotion === "none" && isPaying) return false;       // לא מקודם
    }
    if (filterAvailability === "unavailable" && t.accepting_new_patients !== false) return false;
    if (filterAvailability === "available" && t.accepting_new_patients === false) return false;
    if (filterRegion) {
      if (filterRegion === "__online__") {
        if (!t.online) return false;
      } else {
        // regions מכיל שמות ערים (וברשומות ותיקות לעיתים שם אזור ישירות).
        const inRegion = (t.regions ?? []).some((r) => CITY_TO_REGION[r] === filterRegion || r === filterRegion);
        if (!inRegion) return false;
      }
    }
    return true;
  }

  const isListed = (t: AdminTherapist) => t.admin_approved && (t.status === "approved" || t.status === "paying");
  const allFiltered = hasActiveFilter ? therapists.filter((t) => !isStub(t) && matchesFilters(t)) : null;
  // Newest activity first: a fresh signup or a renewed/completed profile jumps
  // to the top of the review queue (the API returns alphabetical order).
  const latestActivity = (t: AdminTherapist) => {
    const a = t.created_at ?? "";
    const b = t.profile_updated_at ?? "";
    return b > a ? b : a;
  };
  const byLatestActivity = (a: AdminTherapist, b: AdminTherapist) =>
    latestActivity(b).localeCompare(latestActivity(a));
  // Rejected therapists get their own tab — they're a decided pile, not an
  // action queue, and mixing them in "דורש טיפול" buried the real work.
  const pending = hasActiveFilter
    ? []
    : therapists.filter((t) => !isListed(t) && !isStub(t) && t.status !== "rejected").sort(byLatestActivity);
  const rejected = hasActiveFilter
    ? []
    : therapists.filter((t) => t.status === "rejected" && !isStub(t)).sort(byLatestActivity);
  const approved = (hasActiveFilter ? allFiltered! : therapists.filter(isListed));
  const signups = therapists
    .filter(isStub)
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  // Partial profiles: the form WAS saved but required items are still missing
  // (certificate / last name / regions / types / areas — and the optional photo).
  const partials = therapists
    .filter((t) => !isStub(t) && t.status !== "rejected" && missingProfileFields(t, t.certificates.length > 0).length > 0)
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  // A live search/filter jumps straight to the results (approved) table so the
  // admin never has to also click the tab. Otherwise the chosen tab wins.
  const shownTab = hasActiveFilter ? "approved" : activeTab;

  // ── FREE_REGION_FALLBACK (פיצ'ר זמני — ראו app/lib/match-fallback.ts) ──
  // שתי תגיות אפשריות על כרטיס של מטפל חינמי מאושר:
  //   גיבוי אזורי — הוא מכסה אזור שאין בו אף מטפל משלם.
  //   גיבוי תחומי — באזור שיש בו משלמים, יש לו תחומי טיפול שאף משלם באזור
  //                 לא מציע (ייכנס להתאמות כשמטופל יופנה בדיוק לתחום כזה).
  const payingCoveredRegions = new Set<string>();
  const payingExpertiseByRegion = new Map<string, Set<string>>();
  if (FREE_REGION_FALLBACK_ENABLED) {
    for (const t of therapists) {
      if (t.status === "paying" && t.admin_approved) {
        const exp = expertiseOf(t.training_areas, t.assessment_types, t.couples_modalities);
        for (const r of regionsCovered(t.regions)) {
          payingCoveredRegions.add(r);
          let set = payingExpertiseByRegion.get(r);
          if (!set) payingExpertiseByRegion.set(r, (set = new Set()));
          for (const e of exp) set.add(e);
        }
      }
    }
  }
  function fallbackInfoFor(t: AdminTherapist): { emptyRegions: string[]; expertiseGaps: string[] } {
    if (!FREE_REGION_FALLBACK_ENABLED || !(t.status === "approved" && t.admin_approved)) {
      return { emptyRegions: [], expertiseGaps: [] };
    }
    const covered = [...regionsCovered(t.regions)];
    const emptyRegions = covered.filter((r) => !payingCoveredRegions.has(r));
    // Raw (display-cased) areas, compared via the normalized expertise set
    const rawAreas = [
      ...t.training_areas,
      ...t.assessment_types,
      ...(t.couples_modalities.length > 0 ? ["טיפול זוגי"] : []),
    ];
    const expertiseGaps: string[] = [];
    for (const r of covered) {
      if (!payingCoveredRegions.has(r)) continue; // already a full regional backup
      const payingExp = payingExpertiseByRegion.get(r) ?? new Set<string>();
      const gaps = rawAreas.filter(
        (a) => !payingExp.has(a.trim().toLowerCase().replace(/\s+/g, " "))
      );
      if (gaps.length > 0) {
        const shown = gaps.slice(0, 3).join(", ") + (gaps.length > 3 ? ` +${gaps.length - 3}` : "");
        expertiseGaps.push(`${r}: ${shown}`);
      }
    }
    return { emptyRegions, expertiseGaps };
  }
  // ── end FREE_REGION_FALLBACK ──

  // Render FUNCTION, not a component: a component type defined inside the page
  // gets a new identity on every state change, so React unmounted and remounted
  // EVERY card (images reloading, scroll anchoring lost — the "screen jumps"
  // when clicking עריכה/אישור). Returning plain JSX keeps the DOM diffed in place.
  function renderTherapistCard(therapist: AdminTherapist) {
    const showImage = therapist.profile_photo_url && !brokenImages[therapist.id];
    const isBusy = actionLoadingId === therapist.id;

    return (
      <div key={therapist.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <div>
            {showImage ? (
              <div className="flex h-56 w-full items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                <img
                  src={therapist.profile_photo_url!}
                  alt={therapist.full_name}
                  className="h-full w-full object-contain"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
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
                {therapist.center_account_id && (
                  <span
                    className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 border border-indigo-300"
                    title={therapist.promotion_source === "center"
                      ? "מקודם דרך מנוי המרכז — הקידום מנוהל אוטומטית לפי השיוך למרכז (מסך המרכזים)"
                      : "משויך למרכז טיפולי (מסך המרכזים ← ניהול מטפלים)"}
                  >
                    🏢 מרכז: {therapist.center_name ?? "—"}{therapist.promotion_source === "center" ? " · מקודם" : ""}
                  </span>
                )}
                {therapist.accepting_new_patients === false && (
                  <span
                    className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-700 border border-stone-400"
                    title={`לא זמין/ה לקבלת מטופלים חדשים — לא מופיע/ה בהתאמות ולא ניתן לשלוח הודעה מהאתר${therapist.accepting_new_changed_at ? ` (מאז ${new Date(therapist.accepting_new_changed_at).toLocaleDateString("he-IL")})` : ""}`}
                  >
                    ⏸ לא זמין למטופלים חדשים
                  </span>
                )}
                {/* FREE_REGION_FALLBACK (זמני) */}
                {fallbackInfoFor(therapist).emptyRegions.length > 0 && (
                  <span
                    className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 border border-teal-300"
                    title="פיצ'ר זמני: מטפל חינמי מוצג בהתאמות כשאין אף מטפל משלם באזור שביקש המטופל (לא בבקשות אונליין)"
                  >
                    🛟 גיבוי אזורי: {fallbackInfoFor(therapist).emptyRegions.join(", ")}
                  </span>
                )}
                {fallbackInfoFor(therapist).expertiseGaps.length > 0 && (
                  <span
                    className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800 border border-cyan-300"
                    title="פיצ'ר זמני: מטפל חינמי מוצג בהתאמות גם כשיש משלמים באזור אבל אף אחד מהם לא בתחום שאליו הופנה המטופל — אלו התחומים שרק הוא מציע באזור (לא בבקשות אונליין)"
                  >
                    🛟 גיבוי תחומי — {fallbackInfoFor(therapist).expertiseGaps.join(" · ")}
                  </span>
                )}
                {therapist.certificates.length === 0 && (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 border border-red-300">
                    ⚠️ חסרה תעודה
                  </span>
                )}
                {therapist.missing.length > 0 && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-300">
                    ⚠️ פרופיל לא שלם: {therapist.missing.join(", ")}
                  </span>
                )}
                {therapist.completion_requested_at && (
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 border border-blue-300"
                    title={new Date(therapist.completion_requested_at).toLocaleString("he-IL")}>
                    ✉️ נשלחה בקשת השלמה · {new Date(therapist.completion_requested_at).toLocaleDateString("he-IL")}
                  </span>
                )}
                {therapist.profile_updated_at && (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                      therapist.completion_requested_at &&
                      new Date(therapist.profile_updated_at) > new Date(therapist.completion_requested_at)
                        ? "bg-green-100 text-green-800 border-green-300"
                        : "bg-stone-100 text-stone-700 border-stone-300"
                    }`}
                    title={new Date(therapist.profile_updated_at).toLocaleString("he-IL")}
                  >
                    🕐 המטפל/ת עדכנ/ה · {new Date(therapist.profile_updated_at).toLocaleDateString("he-IL")}
                  </span>
                )}
                {therapist.article_invite_sent_at && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-300"
                    title={new Date(therapist.article_invite_sent_at).toLocaleString("he-IL")}>
                    🎁 נשלחה הצעת מאמר · {new Date(therapist.article_invite_sent_at).toLocaleDateString("he-IL")}
                  </span>
                )}
              </div>
            </div>

            {/* Engagement (30d) + account/billing health */}
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
              <span className="font-semibold text-stone-500">📊 30 ימים אחרונים:</span>
              <span><b className="text-stone-900">{therapist.views_30d}</b> כניסות לפרופיל</span>
              <span><b className="text-stone-900">{therapist.contacts_30d}</b> פניות</span>
              <span>
                המרה:{" "}
                <b className="text-stone-900">
                  {therapist.views_30d > 0 ? Math.round((therapist.contacts_30d / therapist.views_30d) * 100) : 0}%
                </b>
              </span>
              {therapist.created_at && (
                <span className="text-stone-500">
                  · נרשם/ה לפני {Math.max(0, Math.floor((Date.now() - new Date(therapist.created_at).getTime()) / 86400000))} ימים
                </span>
              )}
              {therapist.status === "paying" && therapist.subscription?.current_period_end && (
                <span className="text-stone-500">
                  · חיוב הבא: {new Date(therapist.subscription.current_period_end).toLocaleDateString("he-IL")}
                  {therapist.subscription.status && therapist.subscription.status !== "active" && (
                    <span className="text-red-600 font-semibold"> ({therapist.subscription.status})</span>
                  )}
                </span>
              )}
              {therapist.subscription?.promo_reverts_at && (
                <span className="text-amber-700 font-semibold">
                  · מבצע — חוזר ל-₪140 ב-{new Date(therapist.subscription.promo_reverts_at).toLocaleDateString("he-IL")}
                </span>
              )}
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
              <div className="md:col-span-2">
                <span className="font-medium">גילאי טיפול:</span>{" "}
                {therapist.age_groups.length > 0 ? therapist.age_groups.join(", ") : "—"}
              </div>
              <div className="md:col-span-2">
                <span className="font-medium">שפות:</span>{" "}
                {therapist.languages.length > 0 ? therapist.languages.join(", ") : "—"}
              </div>
              {therapist.couples_modalities.length > 0 && (
                <div className="md:col-span-2">
                  <span className="font-medium">הכשרות זוגיות:</span>{" "}
                  {therapist.couples_modalities.join(", ")}
                </div>
              )}
              {therapist.education && (
                <div className="md:col-span-2">
                  <span className="font-medium">השכלה:</span>{" "}
                  <span className="whitespace-pre-line">{therapist.education}</span>
                </div>
              )}
              {therapist.experience && (
                <div className="md:col-span-2">
                  <span className="font-medium">ניסיון:</span>{" "}
                  <span className="whitespace-pre-line">{therapist.experience}</span>
                </div>
              )}
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
                    <li key={c.id} className="inline-flex items-center overflow-hidden rounded-lg border border-[#2e7d8c]">
                      {c.signed_url ? (
                        <a
                          href={c.signed_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 bg-white px-3 py-1.5 text-xs font-medium text-[#2e7d8c] hover:bg-[#2e7d8c] hover:text-white transition-colors"
                        >
                          📄 {c.original_name}
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-white px-3 py-1.5 text-xs text-gray-400">
                          📄 {c.original_name} (קישור לא זמין)
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => deleteCert(therapist.id, c.id, c.original_name)}
                        title="מחק תעודה"
                        className="border-inline-start border-[#2e7d8c] bg-red-50 px-2 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
                        style={{ borderInlineStart: "1px solid #2e7d8c" }}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* CRM 360°: timeline + internal notes + follow-up tasks + Gmail. */}
            <TherapistCrmPanel
              therapistId={therapist.id}
              therapistName={therapist.full_name}
              email={therapist.email}
            />

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" disabled={isBusy}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => openEdit(therapist)}>
                ערוך
              </button>
              <button type="button" disabled={isBusy}
                className="rounded-xl border border-[#2e7d8c] bg-white px-4 py-2 text-sm font-medium text-[#2e7d8c] disabled:opacity-50"
                onClick={() => openMessage(therapist)}
                title="שלח הודעה חופשית + קישור ישיר לעריכת הפרופיל">
                ✉️ שלח הודעה
              </button>
              {(therapist.status === "approved" || therapist.status === "paying") && (
                <button type="button" disabled={isBusy}
                  className="rounded-xl border border-[#d4a017] bg-[#FDF6E3] px-4 py-2 text-sm font-medium text-[#a87010] disabled:opacity-50"
                  onClick={() => sendArticleInvite(therapist)}
                  title={therapist.article_invite_sent_at
                    ? `כבר נשלחה הצעת מאמר ב-${new Date(therapist.article_invite_sent_at).toLocaleDateString("he-IL")} — לחיצה תשלח שוב`
                    : "הזמן לכתוב מאמר בתמורה לחודשיים קידום במתנה"}>
                  {therapist.article_invite_sent_at ? "🎁 שלח שוב הצעת מאמר" : "🎁 הזמן לכתוב מאמר"}
                </button>
              )}
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
                  onClick={() => { setGiftMonths(1); setPromotingId(therapist.id); }}>
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
                    setRefundChecked(false);
                    setRefundAmount("");
                    setRefundDate(new Date().toLocaleDateString("en-CA"));
                    setRefundCategory("refund_guarantee");
                    setRefundDoc("");
                    setRefundNote("");
                    setCancelPayingFor(therapist);
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
                  {therapist.completion_requested_at ? "✉️ שלח שוב בקשת השלמה" : "✉️ בקש השלמה"}
                </button>
              )}
              <button type="button" disabled={isBusy}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => {
                  setRejectReason("");
                  setRejectNotify(true);
                  setRejectFor(therapist);
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
            {refundResults[therapist.id] && (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                {refundResults[therapist.id]}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isBypassed = typeof window !== "undefined" && !!localStorage.getItem("staff_token");

  const incompleteCount = therapists.filter(
    (t) => !isStub(t) && t.status !== "rejected" && missingProfileFields(t, t.certificates.length > 0).length > 0
  ).length;

  return (
    <main className="mx-auto max-w-6xl p-6" dir="rtl">
      {/* מצב מרכז — כניסה מכרטיס מרכז ב-/admin/centers */}
      {centerScope && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-300 bg-indigo-50 px-5 py-3">
          <span className="text-sm font-bold text-indigo-900">
            🏢 מציג את הפרופילים של {centerScopeName ? `"${centerScopeName}"` : "המרכז"} בלבד ({therapists.length})
          </span>
          <a href="/admin/centers" className="rounded-full border border-indigo-300 bg-white px-4 py-1.5 text-xs font-bold text-indigo-800 hover:bg-indigo-100">
            ← חזרה למרכזים טיפוליים
          </a>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{centerScope ? "פרופילי המרכז" : "ניהול מטפלים"}</h1>
          <button
            onClick={async () => {
              setRefreshing(true);
              await loadTherapists({ silent: true });
              setRefreshing(false);
            }}
            disabled={refreshing}
            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
            title="טעינה מחדש של כל הנתונים"
          >
            {refreshing ? "מרענן..." : "↻ רענן נתונים"}
          </button>
        </div>
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
          <span className="font-bold">{incompleteCount}</span> פרופילים עם פרטים חסרים (תעודה / תמונה / שם משפחה / אזורים וכו׳) —{" "}
          <button type="button" onClick={() => setActiveTab("partial")} className="font-semibold underline">
            לטאב הפרופילים החלקיים
          </button>{" "}
          לשליחת תזכורת מותאמת לכל אחד או לכולם יחד.
        </div>
      )}

      {/* ── סינון וחיפוש ── */}
      <div className="mb-8 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setShowFilters(!showFilters)} className="text-sm font-bold text-stone-700 hover:text-stone-900">
            {showFilters ? "▾ סגור מסננים" : "▸ פתח מסננים"}
          </button>
          {hasActiveFilter && (
            <button onClick={() => { setFilterName(""); setFilterGender(""); setFilterTherapistType(""); setFilterTrainingArea(""); setFilterCultural(""); setFilterAgeGroup(""); setFilterPromotion(""); setFilterAvailability(""); setFilterRegion(""); }}
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
            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-600">קידום</label>
              <select value={filterPromotion} onChange={(e) => setFilterPromotion(e.target.value)}
                className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm">
                <option value="">הכל</option>
                <option value="paid">מקודם (בתשלום)</option>
                <option value="gift">מקודם במתנה</option>
                <option value="none">לא מקודם</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-600">זמינות</label>
              <select value={filterAvailability} onChange={(e) => setFilterAvailability(e.target.value)}
                className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm">
                <option value="">הכל</option>
                <option value="unavailable">⏸ לא זמינים למטופלים חדשים</option>
                <option value="available">זמינים בלבד</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-stone-600">אזור</label>
              <select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)}
                className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm">
                <option value="">הכל</option>
                {ALL_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                <option value="__online__">💻 אונליין</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── טאבים ── (מוסתרים כשמסננים — אז מוצגות התוצאות ישירות) */}
      {!hasActiveFilter && (
        <div className="mb-6 flex flex-wrap gap-1 border-b border-stone-200">
          {([
            { key: "action", label: "דורש טיפול", count: pending.length, alert: pending.length > 0 },
            { key: "approved", label: "מאושרים", count: approved.length, alert: false },
            { key: "rejected", label: "נדחו", count: rejected.length, alert: false },
            { key: "partial", label: "חלקיים", count: partials.length, alert: partials.length > 0 },
            { key: "signups", label: "נרשמו", count: signups.length, alert: false },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`-mb-px rounded-t-lg px-4 py-2 text-sm font-bold transition-colors ${
                shownTab === tab.key
                  ? "border-x border-t border-stone-200 bg-white text-stone-900"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              {tab.label}{" "}
              <span className={`text-xs ${tab.alert ? "text-amber-600" : "text-stone-400"}`}>({tab.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* ── דורש טיפול (ממתינים לאישור — חדשים/מחודשים ראשונים; נדחו בטאב נפרד) ── */}
      {shownTab === "action" && (
        <section>
          {pending.length === 0 ? (
            <p className="py-8 text-center text-gray-500">🎉 אין מטפלים שדורשים טיפול כרגע.</p>
          ) : (
            <div className="space-y-6">
              {pending.map((t) => renderTherapistCard(t))}
            </div>
          )}
        </section>
      )}

      {/* ── נדחו — ערימה מוכרעת, לא תור עבודה ── */}
      {shownTab === "rejected" && (
        <section>
          {rejected.length === 0 ? (
            <p className="py-8 text-center text-gray-500">אין מטפלים שנדחו.</p>
          ) : (
            <div className="space-y-6">
              {rejected.map((t) => renderTherapistCard(t))}
            </div>
          )}
        </section>
      )}

      {/* ── מאושרים / תוצאות סינון — טבלה קומפקטה עם כרטיס נפתח לכל שורה ── */}
      {shownTab === "approved" && (
        <section>
          {hasActiveFilter && (
            <h2 className="mb-4 text-lg font-bold text-right">תוצאות סינון ({approved.length})</h2>
          )}
          {approved.length === 0 ? (
            <p className="py-8 text-center text-gray-500">לא נמצאו מטפלים.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-stone-50 text-right text-xs font-bold text-stone-600">
                      <th className="w-8 px-3 py-2.5"></th>
                      <th className="px-3 py-2.5">מטפל/ת</th>
                      <th className="px-3 py-2.5">סטטוס</th>
                      <th className="px-3 py-2.5">אזורים</th>
                      <th className="whitespace-nowrap px-3 py-2.5">צפיות / פניות (30 י׳)</th>
                      <th className="px-3 py-2.5">נרשם/ה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approved.slice(0, approvedLimit).map((t) => {
                      const open = expandedIds.has(t.id);
                      return (
                        <Fragment key={t.id}>
                          <tr
                            onClick={() => toggleExpanded(t.id)}
                            className="cursor-pointer border-b align-middle text-right hover:bg-stone-50"
                          >
                            <td className="px-3 py-2.5 text-stone-400">{open ? "▾" : "◂"}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-3">
                                {t.profile_photo_url && !brokenImages[t.id] ? (
                                  <img
                                    src={t.profile_photo_url}
                                    alt=""
                                    className="h-10 w-10 rounded-full bg-stone-100 object-cover"
                                    referrerPolicy="no-referrer"
                                    loading="lazy"
                                    decoding="async"
                                    onError={() => setBrokenImages((prev) => ({ ...prev, [t.id]: true }))}
                                  />
                                ) : (
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-xs text-stone-400">
                                    —
                                  </div>
                                )}
                                <div>
                                  <div className="font-medium text-stone-800">{t.full_name || "ללא שם"}</div>
                                  <div className="text-xs text-stone-500" dir="ltr" style={{ textAlign: "right" }}>
                                    {t.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  t.status === "paying" && !t.admin_approved
                                    ? "bg-orange-100 text-orange-800"
                                    : t.status === "paying"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : t.status === "approved"
                                    ? "bg-green-100 text-green-800"
                                    : t.status === "rejected"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {t.status === "paying" && !t.admin_approved
                                  ? "ממתין לאישור"
                                  : t.status === "paying"
                                  ? "מקודם"
                                  : t.status === "approved"
                                  ? "מאושר"
                                  : t.status === "rejected"
                                  ? "נדחה"
                                  : "ממתין"}
                              </span>
                              {t.missing.length > 0 && (
                                <span className="mr-1 inline-block rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                                  חסר מידע
                                </span>
                              )}
                              {t.accepting_new_patients === false && (
                                <span className="mr-1 inline-block rounded-full border border-stone-300 bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600"
                                  title="לא זמין/ה לקבלת מטופלים חדשים — מחוץ להתאמות, בלי הודעות מהאתר">
                                  ⏸ לא זמין
                                </span>
                              )}
                              {t.article_invite_sent_at && (
                                <span className="mr-1 inline-block rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"
                                  title={`נשלחה הצעת מאמר · ${new Date(t.article_invite_sent_at).toLocaleDateString("he-IL")}`}>
                                  🎁 מאמר
                                </span>
                              )}
                            </td>
                            <td className="max-w-[180px] truncate px-3 py-2.5 text-stone-600">
                              {(t.regions ?? []).join(", ") || "—"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-stone-600">
                              {t.views_30d} / {t.contacts_30d}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-stone-600">
                              {t.created_at ? new Date(t.created_at).toLocaleDateString("he-IL") : "—"}
                            </td>
                          </tr>
                          {open && (
                            <tr className="border-b bg-stone-50/60">
                              <td colSpan={6} className="p-4">
                                {renderTherapistCard(t)}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {approved.length > approvedLimit && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setApprovedLimit((n) => n + 50)}
                    className="rounded-xl border border-stone-300 bg-white px-5 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                  >
                    טען עוד ({approved.length - approvedLimit} נוספים)
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ── פרופילים חלקיים ── */}
      {shownTab === "partial" && partials.length === 0 && (
        <p className="py-8 text-center text-gray-500">אין פרופילים חלקיים.</p>
      )}
      {shownTab === "partial" && partials.length > 0 && (
        <section id="partial-profiles">
          <h2 className="mb-2 text-xl font-bold text-right border-b pb-2">
            ⚠️ פרופילים חלקיים ({partials.length})
          </h2>
          <p className="mb-4 text-sm text-stone-600 leading-6">
            מטפלים שמילאו את הטופס אבל חסרים להם פריטים. הפנייה המרוכזת שולחת לכל אחד מייל
            <b> מותאם אישית</b> — בשמו וברשימת מה שחסר לו בדיוק (תמונה מוזכרת כאופציונלית) — רק למי שטרם קיבל תזכורת.
          </p>
          <div className="mb-4">
            <button
              type="button"
              onClick={() => { setPartialBulkIntro(PARTIAL_REMINDER_INTRO); setPartialBulkOpen(true); }}
              disabled={partials.every((t) => !!t.completion_requested_at)}
              className="rounded-xl bg-[#2e7d8c] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              ✉️ שלח תזכורת מותאמת לכולם ({partials.filter((t) => !t.completion_requested_at).length} שטרם קיבלו)
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-stone-50 text-right text-xs font-bold text-stone-600">
                  <th className="px-4 py-2.5">שם</th>
                  <th className="px-4 py-2.5">סטטוס</th>
                  <th className="px-4 py-2.5">מה חסר</th>
                  <th className="px-4 py-2.5">נרשם/ה</th>
                  <th className="px-4 py-2.5">תזכורת נשלחה</th>
                  <th className="px-4 py-2.5">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {partials.map((t) => {
                  const missing = missingProfileFields(t, t.certificates.length > 0);
                  return (
                    <tr key={t.id} className="border-b last:border-0 text-right align-top">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-stone-800">{t.full_name}</div>
                        <div className="text-xs text-stone-500" dir="ltr" style={{ textAlign: "right" }}>{t.email}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          t.status === "paying" ? "bg-yellow-100 text-yellow-800" :
                          t.status === "approved" ? "bg-green-100 text-green-800" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {t.status === "paying" ? "מקודם" : t.status === "approved" ? "מאושר" : "ממתין"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-stone-700">
                        {missing.map((m) => (
                          <div key={m} className={m === PHOTO_FIELD ? "text-stone-400" : ""}>
                            • {m}{m === PHOTO_FIELD ? " (אופציונלי)" : ""}
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-2.5 text-stone-600 whitespace-nowrap">
                        {t.created_at ? new Date(t.created_at).toLocaleDateString("he-IL") : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-stone-600 whitespace-nowrap">
                        {t.completion_requested_at
                          ? new Date(t.completion_requested_at).toLocaleDateString("he-IL")
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-2 whitespace-nowrap">
                          <button type="button"
                            onClick={() => openCompletion(t)}
                            className="rounded-lg border border-blue-400 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">
                            {t.completion_requested_at ? "✉️ שלח שוב" : "✉️ שלח תזכורת"}
                          </button>
                          <button type="button"
                            onClick={() => openEdit(t)}
                            className="rounded-lg border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-700">
                            ערוך
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── נרשמו ולא השלימו פרופיל ── */}
      {shownTab === "signups" && signups.length === 0 && (
        <p className="py-8 text-center text-gray-500">אין נרשמים שטרם השלימו פרופיל.</p>
      )}
      {shownTab === "signups" && signups.length > 0 && (
        <section>
          <h2 className="mb-2 text-xl font-bold text-right border-b pb-2">
            🕓 נרשמו ולא השלימו פרופיל ({signups.length})
          </h2>
          <p className="mb-4 text-sm text-stone-600 leading-6">
            חשבונות שנפתחו אבל טופס הפרופיל מעולם לא נשמר — הם לא מוצגים למטופלים. אפשר לשלוח
            תזכורת אישית לכל אחד, או לכולם יחד (רק למי שעוד לא קיבל).
          </p>
          <div className="mb-4">
            <button
              type="button"
              onClick={() => { setBulkReminderText(SIGNUP_REMINDER_DRAFT); setBulkReminderOpen(true); }}
              disabled={signups.every((t) => !!t.completion_requested_at)}
              className="rounded-xl bg-[#2e7d8c] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              ✉️ שלח תזכורת לכולם ({signups.filter((t) => !t.completion_requested_at).length} שטרם קיבלו)
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-stone-50 text-right text-xs font-bold text-stone-600">
                  <th className="px-4 py-2.5">מייל</th>
                  <th className="px-4 py-2.5">נרשם/ה</th>
                  <th className="px-4 py-2.5">תעודה</th>
                  <th className="px-4 py-2.5">תזכורת נשלחה</th>
                  <th className="px-4 py-2.5">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {signups.map((t) => (
                  <tr key={t.id} className="border-b last:border-0 text-right">
                    <td className="px-4 py-2.5 font-medium text-stone-800" dir="ltr" style={{ textAlign: "right" }}>{t.email}</td>
                    <td className="px-4 py-2.5 text-stone-600">
                      {t.created_at ? new Date(t.created_at).toLocaleDateString("he-IL") : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {t.certificates.length > 0 ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">📄 העלה תעודה</span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-stone-600">
                      {t.completion_requested_at
                        ? new Date(t.completion_requested_at).toLocaleDateString("he-IL")
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2">
                        <button type="button"
                          onClick={() => openCompletion(t)}
                          className="rounded-lg border border-blue-400 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">
                          {t.completion_requested_at ? "✉️ שלח שוב" : "✉️ שלח תזכורת"}
                        </button>
                        <button type="button"
                          onClick={() => deleteTherapist(t.id)}
                          className="rounded-lg border border-red-300 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                          מחק
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Edit Modal ── */}
      {editingTherapist && editForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-10">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl" dir="rtl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">עריכת פרטים — {editingTherapist.full_name}</h2>
              <button
                onClick={() => { setEditingTherapist(null); setEditForm(null); setEditBaseline(null); }}
                className="text-2xl text-stone-400 hover:text-stone-700 leading-none"
              >
                ×
              </button>
            </div>

            {editError && (
              <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{editError}</div>
            )}

            {/* Profile photo — replace / remove */}
            <div className="mb-4 flex items-center gap-4 rounded-xl border border-stone-200 bg-stone-50 p-3">
              {editingTherapist.profile_photo_url && !brokenImages[editingTherapist.id] ? (
                <img
                  src={editingTherapist.profile_photo_url}
                  alt=""
                  className="h-16 w-16 rounded-xl object-cover border border-stone-200"
                  referrerPolicy="no-referrer"
                  onError={() => setBrokenImages((prev) => ({ ...prev, [editingTherapist.id]: true }))}
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-stone-100 text-xs text-stone-400">
                  אין תמונה
                </div>
              )}
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <label className={`cursor-pointer rounded-lg border border-[#2e7d8c] bg-white px-3 py-1.5 text-xs font-semibold text-[#2e7d8c] hover:bg-[#2e7d8c] hover:text-white ${photoBusy ? "opacity-50 pointer-events-none" : ""}`}>
                  {photoBusy ? "מעלה..." : editingTherapist.profile_photo_url ? "החלף תמונה" : "העלה תמונה"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={photoBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadAdminPhoto(editingTherapist.id, f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {editingTherapist.profile_photo_url && (
                  <button type="button" disabled={photoBusy}
                    onClick={() => deleteAdminPhoto(editingTherapist.id)}
                    className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">
                    מחק תמונה
                  </button>
                )}
                <span className="text-xs text-stone-400">התמונה נשמרת ומיושרת אוטומטית</span>
              </div>
            </div>

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

              <label className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm font-semibold ${!editForm.accepting_new_patients ? "border-amber-300 bg-amber-50 text-amber-900" : "border-stone-200 text-stone-800"}`}>
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={!editForm.accepting_new_patients}
                  onChange={(e) => setEditForm({ ...editForm, accepting_new_patients: !e.target.checked })}
                />
                <span>
                  ⏸ כעת לא זמין/ה לקבלת מטופלים / אבחונים חדשים
                  <span className="mt-0.5 block text-xs font-normal text-stone-500">
                    מסומן = לא יופיע בהתאמות ולא ניתן לשלוח הודעה מהאתר; נשאר במאגר הכללי בלבד.
                  </span>
                </span>
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

              <div className="mt-2 rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="mb-1 text-sm font-bold text-stone-800">סגנון טיפולי (3 שאלות)</div>
                <div className="mb-3 text-xs text-stone-500">תשובות המטפל/ת לשאלון האישיותי — משמשות להתאמה אישיותית (35% ממשקל ההתאמה)</div>
                <StyleScaleRow
                  question="הבנה מעמיקה של שורשי הקושי כמרכיב מרכזי בשינוי"
                  low="הקלה מיידית ותפקוד"
                  high="תובנה ועומק"
                  value={editForm.style_q1}
                  onChange={(v) => setEditForm({ ...editForm, style_q1: v })}
                />
                <StyleScaleRow
                  question="הצעת מסגרת ברורה, מטרות, כלים ומשימות בין פגישות"
                  low="מרחב פתוח וגמיש"
                  high="מובנה, מכוון ופרקטי"
                  value={editForm.style_q2}
                  onChange={(v) => setEditForm({ ...editForm, style_q2: v })}
                />
                <StyleScaleRow
                  question="סגנון טבעי פעיל, מכוון ומעורב מילולית"
                  low="מכיל, שוהה ומתבונן"
                  high="פעיל, מכוון ומעורב"
                  value={editForm.activity_level}
                  onChange={(v) => setEditForm({ ...editForm, activity_level: v })}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setEditingTherapist(null); setEditForm(null); setEditBaseline(null); }}
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

            {/* Choose any number of gift months, 1–12 */}
            <label className="mb-2 block text-sm font-semibold text-stone-800">
              מספר חודשי קידום במתנה
            </label>
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 12 }, (_, k) => k + 1).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setGiftMonths(m)}
                  className={`rounded-xl border px-0 py-3 text-sm font-bold transition ${
                    giftMonths === m
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-stone-500">
              נבחרו <span className="font-bold text-stone-700">{giftMonths}</span> {giftMonths === 1 ? "חודש" : "חודשים"} של קידום במתנה.
            </p>

            <button
              type="button"
              onClick={() => confirmPromote(promotingId, giftMonths)}
              className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700"
            >
              העניק/י {giftMonths} {giftMonths === 1 ? "חודש" : "חודשים"} קידום במתנה
            </button>

            <button
              type="button"
              onClick={() => confirmPromote(promotingId, null)}
              className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50"
            >
              קידום לתמיד (ללא תאריך תפוגה)
            </button>

            <button
              type="button"
              onClick={() => setPromotingId(null)}
              className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-600 hover:bg-stone-100"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* ── ביטול מנוי של מטפל משלם (+ רישום החזר אופציונלי) ── */}
      {cancelPayingFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl"
          onClick={() => { if (!cancelSaving) setCancelPayingFor(null); }}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-lg font-bold text-stone-900">
              ביטול מנוי - {cancelPayingFor.full_name?.trim() || cancelPayingFor.email || "מטפל/ת"}
            </h3>
            <p className="mb-4 text-sm text-stone-600">
              הוראת הקבע ב-Sumit תבוטל, המטפל/ת ירד/תרד למסלול החינמי ויישלח מייל על סיום הקידום.
            </p>

            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800">
              <input
                type="checkbox"
                checked={refundChecked}
                onChange={(e) => setRefundChecked(e.target.checked)}
                disabled={cancelSaving}
                className="mt-0.5 h-4 w-4 accent-amber-600"
              />
              <span>
                <b>בוצע גם החזר כספי</b> - לרשום אותו בספר
                <span className="mt-0.5 block text-xs text-stone-500">
                  את הזיכוי עצמו יש לבצע בדשבורד של Sumit (מסמכים ← המסמך המקורי ← זיכוי). כאן רק
                  רושמים אותו, כדי שההוצאה תופיע במסך הכספים ולא תיעלם.
                </span>
              </span>
            </label>

            {refundChecked && (
              <div className="mt-3 space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-stone-700">
                      סכום שהוחזר בפועל (₪, כולל מע&quot;מ)
                    </label>
                    <input
                      type="number" min="0" step="0.01" inputMode="decimal"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      disabled={cancelSaving}
                      placeholder="למשל 330.90"
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                    />
                    {Number(refundAmount) > 0 && (
                      <p className="mt-1 text-[11px] text-stone-500">
                        ייכתב בספר כ-₪{(Math.round((Number(refundAmount) / (1 + VAT_RATE)) * 100) / 100).toFixed(2)}
                        {" "}לפני מע&quot;מ + ₪{(Number(refundAmount) - Math.round((Number(refundAmount) / (1 + VAT_RATE)) * 100) / 100).toFixed(2)} מע&quot;מ
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-stone-700">תאריך ההחזר</label>
                    <input
                      type="date"
                      value={refundDate}
                      onChange={(e) => setRefundDate(e.target.value)}
                      disabled={cancelSaving}
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-stone-700">סוג ההחזר</label>
                    <select
                      value={refundCategory}
                      onChange={(e) => setRefundCategory(e.target.value)}
                      disabled={cancelSaving}
                      className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                    >
                      {EXPENSE_CATEGORIES.filter((c) => REFUND_CATEGORIES.includes(c.value)).map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-stone-700">
                      מס&apos; מסמך הזיכוי ב-Sumit (רשות)
                    </label>
                    <input
                      type="text"
                      value={refundDoc}
                      onChange={(e) => setRefundDoc(e.target.value)}
                      disabled={cancelSaving}
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-700">הערה (רשות)</label>
                  <input
                    type="text"
                    value={refundNote}
                    onChange={(e) => setRefundNote(e.target.value)}
                    disabled={cancelSaving}
                    placeholder="למשל: לא התקבלו פניות בחודשיים הראשונים"
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                  />
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setCancelPayingFor(null)} disabled={cancelSaving}
                className="rounded-xl border border-stone-300 bg-white px-5 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50">
                ביטול
              </button>
              <button type="button" disabled={cancelSaving || (refundChecked && !(Number(refundAmount) > 0))}
                className="rounded-xl bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                onClick={async () => {
                  const target = cancelPayingFor;
                  if (!target) return;
                  setCancelSaving(true);
                  // הביטול קודם. אם הוא נכשל (למשל Sumit לא זמין) לא נרשם שום
                  // החזר - אחרת היה נשאר בספר החזר על מנוי שממשיך לחייב.
                  const cancelled = await updateStatus(target.id, "approved");
                  if (cancelled && refundChecked) {
                    const note = await recordRefund(target.id);
                    if (note) setRefundResults((prev) => ({ ...prev, [target.id]: note }));
                  }
                  setCancelSaving(false);
                  if (cancelled) setCancelPayingFor(null);
                }}>
                {cancelSaving ? "מבטל..." : refundChecked ? "בטל מנוי ורשום החזר" : "בטל מנוי + הורד"}
              </button>
            </div>
          </div>
        </div>
      )}

      {completionFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl"
          onClick={() => setCompletionFor(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-lg font-bold text-stone-900">בקשת השלמה — {completionFor.full_name.trim() || completionFor.email || "מטפל/ת"}</h3>
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

      {/* ── תזכורת הרשמה לכולם ── */}
      {bulkReminderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl"
          onClick={() => { if (!bulkReminderSending) setBulkReminderOpen(false); }}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-lg font-bold text-stone-900">
              תזכורת השלמת הרשמה — {signups.filter((t) => !t.completion_requested_at).length} נמענים
            </h3>
            <p className="mb-3 text-sm text-stone-600">
              ההודעה תישלח לכל מי שנרשם ולא השלים פרופיל <b>וטרם קיבל תזכורת</b>. המייל נפתח
              ב&quot;שלום מטפל/ת יקר/ה&quot; ומסתיים בכפתור לעריכת הפרופיל — זה החלק האמצעי. אפשר לערוך.
            </p>
            <textarea
              value={bulkReminderText}
              onChange={(e) => setBulkReminderText(e.target.value)}
              rows={9}
              dir="rtl"
              disabled={bulkReminderSending}
              className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
            />
            {bulkReminderProgress && (
              <p className="mt-2 text-sm font-semibold text-[#2e7d8c]">{bulkReminderProgress}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setBulkReminderOpen(false)} disabled={bulkReminderSending}
                className="rounded-xl border border-stone-300 bg-white px-5 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50">
                ביטול
              </button>
              <button type="button" onClick={sendBulkReminders} disabled={bulkReminderSending || !bulkReminderText.trim()}
                className="rounded-xl bg-[#2e7d8c] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {bulkReminderSending ? "שולח..." : "✉️ שלח לכולם"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── דחיית מטפל/ת — עם שליטה על מייל הדחייה ── */}
      {rejectFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl"
          onClick={() => { if (!rejectSaving) setRejectFor(null); }}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-lg font-bold text-stone-900">דחיית {rejectFor.full_name || "מטפל/ת"}</h3>
            <p className="mb-3 text-sm text-stone-600">
              הפרופיל יעבור לטאב &quot;נדחו&quot;. הסיבה נשמרת תמיד; המייל למטפל/ת — לבחירתך.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              dir="rtl"
              disabled={rejectSaving}
              className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-200"
              placeholder="סיבת הדחייה (למשל: התעודה אינה קריאה — נא להעלות תעודת רישיון ברורה)"
            />
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={rejectNotify}
                onChange={(e) => setRejectNotify(e.target.checked)}
                disabled={rejectSaving}
                className="mt-0.5 h-4 w-4 accent-red-600"
              />
              <span>
                ✉️ לשלוח למטפל/ת מייל על הדחייה (כולל הסיבה)
                {!rejectNotify && (
                  <span className="mt-0.5 block text-xs font-semibold text-amber-700">
                    דחייה שקטה — המטפל/ת לא יקבל שום הודעה.
                  </span>
                )}
              </span>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRejectFor(null)} disabled={rejectSaving}
                className="rounded-xl border border-stone-300 bg-white px-5 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50">
                ביטול
              </button>
              <button type="button" disabled={rejectSaving}
                className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                onClick={async () => {
                  if (!rejectFor) return;
                  setRejectSaving(true);
                  await updateStatus(rejectFor.id, "rejected", null, rejectReason.trim() || undefined, undefined, rejectNotify);
                  setRejectSaving(false);
                  setRejectFor(null);
                }}>
                {rejectSaving ? "דוחה..." : rejectNotify ? "דחה ושלח מייל" : "דחה בשקט"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── הודעה כללית למטפל/ת ── */}
      {messageFor && (
        <MessageModal
          therapist={messageFor}
          sending={messageSending}
          onClose={() => setMessageFor(null)}
          onSend={sendMessage}
        />
      )}

      {/* ── תזכורת מותאמת לפרופילים חלקיים ── */}
      {partialBulkOpen && (() => {
        const targets = partials.filter((t) => !t.completion_requested_at && t.email);
        const example = targets[0] ?? null;
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10" dir="rtl"
            onClick={() => { if (!partialBulkSending) setPartialBulkOpen(false); }}>
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-1 text-lg font-bold text-stone-900">
                תזכורת מותאמת אישית — {targets.length} נמענים
              </h3>
              <p className="mb-3 text-sm text-stone-600 leading-6">
                כל נמען יקבל מייל בשמו, עם רשימת הפריטים שחסרים <b>לו</b>. תמונת פרופיל מוצגת
                כאופציונלית, ומי שחסרה לו רק תמונה מקבל נוסח מיוחד. נשלח רק למי שטרם קיבל תזכורת.
              </p>
              <label className="mb-1 block text-sm font-semibold text-stone-800">משפט הפתיחה (עריך)</label>
              <textarea
                value={partialBulkIntro}
                onChange={(e) => setPartialBulkIntro(e.target.value)}
                rows={3}
                dir="rtl"
                disabled={partialBulkSending}
                className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
              />
              {example && (
                <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <div className="mb-1 text-xs font-bold text-stone-500">
                    דוגמה — כך ייראה המייל של {example.full_name}:
                  </div>
                  <div className="whitespace-pre-line text-xs text-stone-700 leading-5">
                    {`שלום ${example.full_name},\n\n` +
                      partialReminderMessage(
                        missingProfileFields(example, example.certificates.length > 0),
                        partialBulkIntro.trim() || PARTIAL_REMINDER_INTRO
                      ) +
                      "\n\n[כפתור: לעריכת הפרופיל שלי]"}
                  </div>
                </div>
              )}
              {partialBulkProgress && (
                <p className="mt-2 text-sm font-semibold text-[#2e7d8c]">{partialBulkProgress}</p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setPartialBulkOpen(false)} disabled={partialBulkSending}
                  className="rounded-xl border border-stone-300 bg-white px-5 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50">
                  ביטול
                </button>
                <button type="button" onClick={sendBulkPartialReminders} disabled={partialBulkSending || targets.length === 0}
                  className="rounded-xl bg-[#2e7d8c] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                  {partialBulkSending ? "שולח..." : `✉️ שלח ל-${targets.length} מטפלים`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}
