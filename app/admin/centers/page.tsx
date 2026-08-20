"use client";

import { useCallback, useEffect, useState } from "react";
import { centerMonthlyPricing, ilCurrency as ils } from "@/app/lib/center-pricing";

// מרכזים טיפוליים - הצעות מחיר, קישורי תשלום ומנויים.
// זרימה: יוצרים הצעה (מסלולים + מחיר חודשי מותאם + חודשי מתנה) ← מעתיקים
// את הקישור ושולחים למרכז ← המרכז ממלא אשראי בדף ההצטרפות ← המנוי מופיע
// כאן כפעיל, עם ביטול וסנכרון מול Sumit.

type Center = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  token: string;
  price_per_therapist: number | null;
  therapist_count: number | null; // מספר המטפלים בתמחור ההצעה
  gift_months: number;
  status: "draft" | "sent" | "active" | "cancelled";
  agreed_monthly_price: number | null;
  billing_starts_at: string | null;
  payer_name: string | null;
  payer_email: string | null;
  sumit_recurring_id: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string | null;
  linked_therapist_count: number; // כמה פרופילי מטפלים משויכים למרכז
  pending_therapist_count: number; // כמה מהם ממתינים לאישור (כולל ישות-המרכז)
  /** מעורבות מצטברת של המרכז: מסלול 1 = סכום המטפלים, מסלול 2 = שורת הישות. */
  engagement?: {
    views_30: number; clicks_30: number; views_total: number; clicks_total: number;
    clicks_30_by_channel: { paid: number; organic: number; direct: number; other: number };
    clicks_30_by_type: Record<string, number>;
    page_views_30: number; page_views_total: number;
    website_clicks_30: number; website_clicks_total: number;
    page_contact_30: number; page_contact_total: number;
    site_messages_30: number; site_messages_total: number;
  } | null;
  /** מוכנות לפי מסלול (center-readiness) - רק למרכזים פעילים. */
  readiness?: {
    pct: number;
    track_label: string;
    headline: string | null;
    slots: { paid: number; filled: number; promoted: number } | null;
    missing: { label: string; critical: boolean; hint: string | null }[];
    blocked_on_us: string[];
  } | null;
  user_id: string | null;
  slug: string | null;
  public_page_enabled: boolean | null;
  public_description: string | null;
  public_managers: string | null;
  public_city: string | null;
  public_website: string | null;
  public_phone: string | null;
  billing_track: "per_therapist" | "center_entity" | null;
  fixed_monthly_price: number | null;
  discount_amount: number | null;
  num_locations: number | null;
};

// חישובי הכסף מגיעים ממקור האמת המשותף (center-pricing) - לא לשכפל כאן.

type TherapistPoolItem = {
  id: string;
  full_name: string;
  email: string | null;
  status: string;
  center_account_id: string | null;
  center_name: string | null;
};

// שורת הפירוט-לפי-מטפל שמחזירה פעולת center_engagement.
type CenterTherapistRow = {
  id: string;
  full_name: string;
  is_entity: boolean;
  status: string;
  promoted: boolean;
  admin_approved: boolean;
  email: string | null;
  missing_fields: string[];
  views_30: number; views_total: number;
  clicks_30: number; clicks_total: number;
  by_type_30: Record<string, number>;
};

// אותם שמות סוג-פנייה כמו בעמוד הערבות ובדשבורד המטפל - ודאי מול כוונה.
const CLICK_TYPE_LABELS: Record<string, string> = {
  site_message: "הודעות באתר",
  whatsapp: "וואטסאפ",
  phone: "טלפון",
  email: "מייל",
  other: "אחר",
};
function clickTypeParts(byType: Record<string, number>): string {
  return Object.entries(byType)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${CLICK_TYPE_LABELS[k] ?? k} ${n}`)
    .join(" · ");
}

const STATUS_LABELS: Record<Center["status"], { label: string; cls: string }> = {
  draft: { label: "טיוטה", cls: "bg-stone-100 border-stone-300 text-stone-600" },
  sent: { label: "הצעה נשלחה", cls: "bg-blue-50 border-blue-300 text-blue-800" },
  active: { label: "מנוי פעיל", cls: "bg-green-50 border-green-300 text-green-800" },
  cancelled: { label: "בוטל", cls: "bg-red-50 border-red-300 text-red-700" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso.includes("T") ? iso : iso + "T00:00:00").toLocaleDateString("he-IL");
}

// billing_track ישן/ריק = מסלול 1 (ברירת המחדל ההיסטורית).
const trackOf = (c: Center) => (c.billing_track === "center_entity" ? "center_entity" : "per_therapist");

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

// "מה עכשיו?" - השורה שהופכת את הכרטיס מרשימת שדות לסיפור: איפה המרכז עומד
// במשפך ומה הפעולה שמקדמת אותו. הטון קובע את הצבע (act = דורש פעולה שלך).
type Hint = { tone: "ok" | "act" | "info" | "warn"; text: string };
const HINT_CLS: Record<Hint["tone"], string> = {
  ok: "border-green-200 bg-green-50/70 text-green-900",
  act: "border-amber-300 bg-amber-50 text-amber-900 font-semibold",
  info: "border-stone-200 bg-stone-50 text-stone-600",
  warn: "border-red-200 bg-red-50 text-red-800 font-semibold",
};
function nextStepHint(c: Center): Hint | null {
  const isEntity = trackOf(c) === "center_entity";
  const priced = isEntity
    ? centerMonthlyPricing(c).monthlyTotal > 0
    : Number(c.price_per_therapist) > 0 && Number(c.therapist_count) > 0;
  if (c.status === "draft") {
    if (!priced) return { tone: "warn", text: "💳 טרם התקבל תשלום · חסר תמחור - הקישור מציג למרכז \"ההצעה בהכנה\". השלימו מחיר בעריכה." };
    if (!c.email) return { tone: "act", text: "💳 טרם התקבל תשלום · ההצעה מוכנה: העתיקו קישור ושלחו בוואטסאפ (ואז \"סימון כנשלחה\"), או הוסיפו אימייל בעריכה כדי לשלוח מכאן." };
    return { tone: "act", text: "💳 טרם התקבל תשלום · ההצעה מוכנה - שלחו במייל, או העתיקו קישור לוואטסאפ וסמנו כנשלחה." };
  }
  if (c.status === "sent") {
    const d = daysSince(c.updated_at ?? c.created_at);
    const ago = d == null || d === 0 ? "" : d === 1 ? " · עדכון אחרון אתמול" : ` · עדכון אחרון לפני ${d} ימים`;
    if (d != null && d >= 7) return { tone: "act", text: `💳 טרם התקבל תשלום - הכרטיס לא נמסר${ago} · שווה פולו-אפ למרכז.` };
    return { tone: "info", text: `💳 טרם התקבל תשלום - הכרטיס לא נמסר · הקישור אצל המרכז${ago}.` };
  }
  if (c.status === "active") {
    if (!c.user_id) return { tone: "act", text: "שולם ✓ אך טרם הוקם חשבון הניהול - שלחו למרכז שוב את קישור ההצטרפות (משמש גם להקמת החשבון)." };
    if (c.pending_therapist_count > 0)
      return {
        tone: "act",
        text: isEntity
          ? "פרופיל המרכז מולא וממתין לאישור שלך (🛠 בכפתור למטה)."
          : `${c.pending_therapist_count} פרופילי מטפלים ממתינים לאישור שלך.`,
      };
    if (!isEntity && c.linked_therapist_count === 0)
      return { tone: "info", text: "אין עדיין פרופילי מטפלים - המרכז מזמין מטפלים מהפורטל, או שייכו כאן ידנית." };
    const today = new Date().toISOString().slice(0, 10);
    const inGift = c.billing_starts_at && c.billing_starts_at > today;
    return { tone: "ok", text: inGift ? `✓ באוויר · בתקופת מתנה - חיוב ראשון ${fmtDate(c.billing_starts_at)}.` : "✓ באוויר · חיוב חודשי פעיל." };
  }
  return null;
}

export default function AdminCentersPage() {
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [sumitInfo, setSumitInfo] = useState<Record<string, string>>({});
  // תפריט הסינון העליון: שלב במשפך + מסלול חיוב.
  const [stageFilter, setStageFilter] = useState<"all" | Center["status"]>("all");
  const [trackFilter, setTrackFilter] = useState<"all" | "per_therapist" | "center_entity">("all");

  // טופס יצירה/עריכה
  const [editing, setEditing] = useState<Center | "new" | null>(null);
  const [fName, setFName] = useState("");
  const [fContact, setFContact] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [fGift, setFGift] = useState("0");
  const [fPricePerTherapist, setFPricePerTherapist] = useState("");
  const [fTherapistCount, setFTherapistCount] = useState("");
  const [fBillingTrack, setFBillingTrack] = useState<"per_therapist" | "center_entity">("per_therapist");
  const [fFixedPrice, setFFixedPrice] = useState("");
  const [fDiscount, setFDiscount] = useState("");
  const [fLocations, setFLocations] = useState("1");
  // עמוד המרכז הציבורי (SEO)
  const [fPubEnabled, setFPubEnabled] = useState(false);
  const [fPubDesc, setFPubDesc] = useState("");
  const [fPubManagers, setFPubManagers] = useState("");
  const [fPubCity, setFPubCity] = useState("");
  const [fPubWebsite, setFPubWebsite] = useState("");
  const [fPubPhone, setFPubPhone] = useState("");

  // ניהול שיוך מטפלים למרכז
  // פירוט לפי מטפל: נטען בלחיצה, נשמר במפה כדי שפתיחה חוזרת לא תטען שוב.
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const [detailRows, setDetailRows] = useState<Record<string, CenterTherapistRow[]>>({});
  const [detailLoading, setDetailLoading] = useState(false);

  const [manageFor, setManageFor] = useState<Center | null>(null);
  const [pool, setPool] = useState<TherapistPoolItem[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolSearch, setPoolSearch] = useState("");
  const [selectedTx, setSelectedTx] = useState<Set<string>>(new Set());

  // נועל את גלילת העמוד שמאחורי המודל - בלעדיו, גלילה עם העכבר מעל הרקע
  // הכהה (מחוץ לכרטיס הלבן) מזיזה את דף האדמין שמתחת במקום את תוכן המודל.
  useEffect(() => {
    if (!editing && !manageFor) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [editing, manageFor]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/admin-centers", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setCenters(j.centers);
        else setError(j.error ?? "שגיאה");
      })
      .catch(() => setError("שגיאת רשת"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function post(payload: Record<string, unknown>): Promise<{ ok: boolean; [k: string]: unknown }> {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin-centers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!j.ok) setError(j.error ?? "שגיאה");
      else load();
      return j;
    } catch {
      setError("שגיאת רשת");
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }

  async function toggleDetail(c: Center) {
    if (detailFor === c.id) { setDetailFor(null); return; }
    setDetailFor(c.id);
    if (!detailRows[c.id]) {
      setDetailLoading(true);
      const res = await post({ action: "center_engagement", id: c.id });
      if (res.ok && Array.isArray(res.therapists)) {
        setDetailRows((m) => ({ ...m, [c.id]: res.therapists as CenterTherapistRow[] }));
      }
      setDetailLoading(false);
    }
  }

  function openNew() {
    setEditing("new");
    setFName(""); setFContact(""); setFEmail(""); setFPhone(""); setFNotes("");
    setFGift("0");
    setFPricePerTherapist(""); setFTherapistCount("");
    setFBillingTrack("per_therapist"); setFFixedPrice(""); setFDiscount(""); setFLocations("1");
    setFPubEnabled(false); setFPubDesc(""); setFPubManagers(""); setFPubCity(""); setFPubWebsite(""); setFPubPhone("");
  }

  function openEdit(c: Center) {
    setEditing(c);
    setFName(c.name);
    setFContact(c.contact_name ?? "");
    setFEmail(c.email ?? "");
    setFPhone(c.phone ?? "");
    setFNotes(c.notes ?? "");
    setFGift(String(c.gift_months));
    setFPricePerTherapist(c.price_per_therapist != null ? String(c.price_per_therapist) : "");
    setFTherapistCount(c.therapist_count != null ? String(c.therapist_count) : "");
    setFBillingTrack(c.billing_track === "center_entity" ? "center_entity" : "per_therapist");
    setFFixedPrice(c.fixed_monthly_price != null ? String(c.fixed_monthly_price) : "");
    setFDiscount(c.discount_amount ? String(c.discount_amount) : "");
    setFLocations(c.num_locations != null ? String(c.num_locations) : "1");
    setFPubEnabled(!!c.public_page_enabled);
    setFPubDesc(c.public_description ?? "");
    setFPubManagers(c.public_managers ?? "");
    setFPubCity(c.public_city ?? "");
    setFPubWebsite(c.public_website ?? "");
    setFPubPhone(c.public_phone ?? "");
  }

  async function save() {
    const payload: Record<string, unknown> = {
      name: fName,
      contact_name: fContact,
      email: fEmail,
      phone: fPhone,
      notes: fNotes,
      gift_months: Number(fGift),
      billing_track: fBillingTrack,
      discount_amount: Number(fDiscount) || 0,
      num_locations: Number(fLocations) || 1,
      ...(fBillingTrack === "center_entity"
        ? { fixed_monthly_price: Number(fFixedPrice) }
        : { price_per_therapist: Number(fPricePerTherapist), therapist_count: Number(fTherapistCount) }),
    };
    // שדות העמוד הציבורי - רק בעריכה (למרכז קיים עם slug), לא ביצירה.
    if (editing !== "new" && editing !== null) {
      payload.public_page_enabled = fPubEnabled;
      payload.public_description = fPubDesc;
      payload.public_managers = fPubManagers;
      payload.public_city = fPubCity;
      payload.public_website = fPubWebsite;
      payload.public_phone = fPubPhone;
    }
    // חודשי מתנה נעולים אחרי תשלום; מחיר/מספר-מטפלים ניתנים לעריכה תמיד
    // (במרכז פעיל השרת מפרסם את השינוי ל-Sumit). מרכז מבוטל - עריכת קשר בלבד.
    if (editing !== "new" && editing !== null) {
      if (editing.status === "active") {
        delete payload.gift_months;
      } else if (editing.status === "cancelled") {
        delete payload.gift_months;
        delete payload.price_per_therapist;
        delete payload.therapist_count;
        delete payload.fixed_monthly_price;
        delete payload.billing_track;
        delete payload.discount_amount;
        delete payload.num_locations;
      }
    }
    const j = editing === "new"
      ? await post({ action: "create", ...payload })
      : await post({ action: "update", id: (editing as Center).id, ...payload });
    if (j.ok) setEditing(null);
  }

  function joinUrl(c: Center): string {
    return `${window.location.origin}/centers/join/${c.token}`;
  }

  async function copyLink(c: Center) {
    try {
      await navigator.clipboard.writeText(joinUrl(c));
      setCopied(c.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      prompt("העתיקו את הקישור:", joinUrl(c));
    }
  }

  async function sendProposal(c: Center) {
    if (!c.email) {
      setError("למרכז אין אימייל - הוסיפו בעריכת ההצעה");
      return;
    }
    if (!confirm(`לשלוח את ההצעה במייל אל ${c.email}? המרכז יקבל את המחיר לכל מטפל, מספר המטפלים, הסכום הכולל, המתנה וקישור ההצטרפות.`)) return;
    const j = await post({ action: "send_proposal", id: c.id });
    if (j.ok) alert(`ההצעה נשלחה ל${c.email}.`);
  }

  async function regenToken(c: Center) {
    if (!confirm(`לחדש את קישור ההצטרפות של "${c.name}"?\n\nהקישור הישן יפסיק לעבוד מיד. התמחור וכל פרטי ההצעה נשמרים - רק הכתובת משתנה, ותצטרכו לשלוח את החדשה.`)) return;
    const j = await post({ action: "regenerate_token", id: c.id });
    if (j.ok) alert("הקישור חודש. השתמשו ב\"העתקת קישור למרכז\" כדי להעתיק את החדש - הישן כבר לא תקף.");
  }

  async function del(c: Center) {
    if (c.status === "active") {
      setError("אי אפשר למחוק מרכז פעיל - בטלו קודם את המנוי");
      return;
    }
    if (!confirm(`למחוק לצמיתות את "${c.name}"? הטיוטה, קישור ההצטרפות והפרופיל (אם נוצר) יימחקו. פעולה בלתי הפיכה.`)) return;
    await post({ action: "delete", id: c.id });
  }

  async function syncSumit(c: Center) {
    const j = await post({ action: "sync_sumit", id: c.id });
    if (j.ok) {
      const s = j.sumit as { status: number; next_billing: string | null; unit_price: number | null } | null;
      // 0=פעילה · 12=מתוזמנת (חודשי מתנה, טרם חויב) · 1=מבוטלת · אחר=לבדוק
      const statusLabel = s?.status === 0 ? "פעיל" : s?.status === 12 ? "מתוזמן (בתקופת מתנה)" : s?.status === 1 ? "מבוטל" : `סטטוס ${s?.status} - לבדוק`;
      setSumitInfo((prev) => ({
        ...prev,
        [c.id]: s
          ? `Sumit: ${statusLabel}${s.next_billing ? ` · חיוב הבא ${fmtDate(s.next_billing)}` : ""}${s.unit_price != null ? ` · ₪${s.unit_price}` : ""}`
          : "לא נמצאה הוראת קבע ב-Sumit",
      }));
    }
  }

  async function openManage(c: Center) {
    setManageFor(c);
    setPoolSearch("");
    setPoolLoading(true);
    setPool([]);
    setSelectedTx(new Set());
    try {
      const res = await fetch("/api/admin-centers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_therapists" }),
      });
      const j = await res.json();
      if (j.ok) {
        setPool(j.therapists);
        setSelectedTx(new Set((j.therapists as TherapistPoolItem[]).filter((t) => t.center_account_id === c.id).map((t) => t.id)));
      } else {
        setError(j.error ?? "שגיאה");
      }
    } catch {
      setError("שגיאת רשת");
    } finally {
      setPoolLoading(false);
    }
  }

  async function saveTherapists() {
    if (!manageFor) return;
    const j = await post({ action: "set_therapists", id: manageFor.id, therapist_ids: [...selectedTx] });
    if (j.ok) setManageFor(null);
  }

  // חודשי מתנה נעולים אחרי תשלום (active/cancelled). מחיר/מספר-מטפלים ננעלים
  // רק כשההצעה בוטלה - במרכז פעיל אפשר לעדכן (מתפרסם ל-Sumit בשמירה).
  const isLockedEditing = editing !== "new" && editing !== null && (editing.status === "active" || editing.status === "cancelled");
  const pricingLocked = editing !== "new" && editing !== null && editing.status === "cancelled";
  const isActiveEditing = editing !== "new" && editing !== null && editing.status === "active";
  const fPricing = centerMonthlyPricing({
    billing_track: fBillingTrack,
    price_per_therapist: Number(fPricePerTherapist) || 0,
    therapist_count: Number(fTherapistCount) || 0,
    fixed_monthly_price: Number(fFixedPrice) || 0,
    num_locations: Number(fLocations) || 1,
    discount_amount: Number(fDiscount) || 0,
  });
  const fTotal = fPricing.monthlyTotal;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-black text-stone-900">מרכזים טיפוליים</h1>
        <button onClick={openNew} className="rounded-xl bg-stone-800 px-4 py-2 text-sm font-bold text-white hover:bg-stone-700">
          + הצעה למרכז חדש
        </button>
      </div>
      <p className="mb-3 text-sm text-stone-500 max-w-3xl">
        יוצרים הצעה עם המחיר לכל מטפל ומספר המטפלים שסגרתם בשיחת ההתאמה, שולחים למרכז במייל (או מעתיקים את הקישור).
        המרכז רואה את הסכום החודשי הכולל וממלא פרטי אשראי. אפשר להגדיר חודשי מתנה -
        הכרטיס נשמר מיד והחיוב הראשון יוצא רק בתום המתנה.
      </p>
      <div className="mb-6 flex flex-wrap gap-4 text-xs">
        <a href="/prospectus-centers.pdf" target="_blank" className="font-bold text-[#0F5468] underline">📄 פרוספקט למרכזים (PDF לשליחה)</a>
        <a href="/centers" target="_blank" className="font-bold text-[#0F5468] underline">🔗 עמוד ההסבר למרכזים</a>
        <a href="/api/admin-sales-sheet" target="_blank" className="font-bold text-red-700 underline" title="מסמך פנימי לצוות המכירות - מוגש רק דרך האדמין, לא לשליחה ללקוח">🔒 דף הכנה לשיחת מכירה (פנימי - לא לשליחה)</a>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-sm text-stone-400 animate-pulse">טוען…</p>}

      {!loading && centers.length === 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-400">
          אין עדיין מרכזים - צרו הצעה ראשונה
        </div>
      )}

      {/* פס סיכום עסקי: MRR מהפעילים, מי בחודשי מתנה ומתי החיוב הקרוב, ופוטנציאל במשפך */}
      {!loading && centers.length > 0 && (() => {
        const active = centers.filter((c) => c.status === "active");
        const sent = centers.filter((c) => c.status === "sent");
        const mrr = active.reduce((s, c) => s + centerMonthlyPricing(c).monthlyTotal, 0);
        const sentPotential = sent.reduce((s, c) => s + centerMonthlyPricing(c).monthlyTotal, 0);
        const today = new Date().toISOString().slice(0, 10);
        const inGift = active.filter((c) => c.billing_starts_at && c.billing_starts_at > today);
        const nextCharge = inGift.map((c) => c.billing_starts_at as string).sort()[0] ?? null;
        const paidNow = mrr - inGift.reduce((s, c) => s + centerMonthlyPricing(c).monthlyTotal, 0);
        return (
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4">
              <div className="text-2xl font-black text-[#0F5468]">₪{ils(mrr)}</div>
              <div className="text-xs font-bold text-stone-600">MRR ממרכזים פעילים</div>
              <div className="text-[11px] text-stone-400">לפני מע"מ · {active.length} מרכזים</div>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="text-2xl font-black text-stone-800">₪{ils(paidNow)}</div>
              <div className="text-xs font-bold text-stone-600">מחויב בפועל החודש</div>
              <div className="text-[11px] text-stone-400">{inGift.length > 0 ? `${inGift.length} עדיין בחודשי מתנה` : "אין מרכזים במתנה"}</div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="text-2xl font-black text-amber-800">{nextCharge ? fmtDate(nextCharge) : "-"}</div>
              <div className="text-xs font-bold text-stone-600">החיוב הקרוב ממתנה</div>
              <div className="text-[11px] text-stone-400">{inGift.length > 0 ? "סוף תקופת המתנה הקרובה" : "כולם כבר מחויבים"}</div>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
              <div className="text-2xl font-black text-blue-800">₪{ils(sentPotential)}</div>
              <div className="text-xs font-bold text-stone-600">פוטנציאל במשפך</div>
              <div className="text-[11px] text-stone-400">{sent.length} הצעות ממתינות לתשלום</div>
            </div>
          </div>
        );
      })()}

      {/* תפריט סינון עליון: שלב במשפך + מסלול. דביק, כדי שהמעבר בין תצוגות
          יישאר בהישג יד גם כשהרשימה מתארכת. */}
      {!loading && centers.length > 0 && (() => {
        const stages: { key: "all" | Center["status"]; label: string }[] = [
          { key: "all", label: "הכל" },
          { key: "active", label: "✅ פעילים" },
          { key: "sent", label: "✉️ ממתינות לתשלום" },
          { key: "draft", label: "📝 טיוטות" },
          { key: "cancelled", label: "⏸️ בוטלו" },
        ];
        const tracks: { key: "all" | "per_therapist" | "center_entity"; label: string }[] = [
          { key: "all", label: "כל המסלולים" },
          { key: "center_entity", label: "🏢 מסלול 2 - מרכז כישות" },
          { key: "per_therapist", label: "👥 מסלול 1 - מטפלים בנפרד" },
        ];
        const stageCount = (k: "all" | Center["status"]) => (k === "all" ? centers.length : centers.filter((c) => c.status === k).length);
        const trackCount = (k: "all" | "per_therapist" | "center_entity") => (k === "all" ? centers.length : centers.filter((c) => trackOf(c) === k).length);
        return (
          <div className="sticky top-0 z-40 mb-6 rounded-2xl border border-stone-200 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center gap-1.5">
              {stages.map((s) => (
                <button key={s.key} onClick={() => setStageFilter(s.key)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                    stageFilter === s.key ? "bg-stone-800 text-white" : "border border-stone-300 text-stone-600 hover:bg-stone-50"}`}>
                  {s.label} <span className={stageFilter === s.key ? "opacity-70" : "text-stone-400"}>({stageCount(s.key)})</span>
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {tracks.map((t) => (
                <button key={t.key} onClick={() => setTrackFilter(t.key)}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                    trackFilter === t.key ? "bg-teal-700 text-white" : "border border-teal-200 bg-teal-50/50 text-teal-800 hover:bg-teal-50"}`}>
                  {t.label} <span className={trackFilter === t.key ? "opacity-70" : "text-teal-600/60"}>({trackCount(t.key)})</span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* התצוגה המרוכזת: סך כל המרכזים הפעילים במבט אחד. עד 19/8/26 לא היה
          שום מקום שעונה על "כמה כל המרכזים ביחד מייצרים" - רק כרטיסים
          בודדים. מחושב בצד הלקוח מנתוני ה-engagement שכבר בתשובת ה-API. */}
      {!loading && (() => {
        // כל הפעילים - גם מרכז בלי אף אירוע עדיין נספר בכותרת; החוסר עצמו מידע.
        const act = centers.filter((c) => c.status === "active");
        if (act.length === 0) return null;
        const zero = {
          views_30: 0, clicks_30: 0, views_total: 0, clicks_total: 0,
          clicks_30_by_channel: { paid: 0, organic: 0, direct: 0, other: 0 },
          clicks_30_by_type: {} as Record<string, number>,
          page_views_30: 0, page_views_total: 0, website_clicks_30: 0, website_clicks_total: 0,
          page_contact_30: 0, page_contact_total: 0, site_messages_30: 0, site_messages_total: 0,
        };
        const sum = act.reduce(
          (s, c) => {
            const e = c.engagement ?? zero;
            s.v30 += e.views_30; s.c30 += e.clicks_30; s.vt += e.views_total; s.ct += e.clicks_total;
            s.paid += e.clicks_30_by_channel.paid; s.organic += e.clicks_30_by_channel.organic;
            s.direct += e.clicks_30_by_channel.direct; s.other += e.clicks_30_by_channel.other;
            s.pv30 += e.page_views_30; s.web30 += e.website_clicks_30;
            s.msg30 += e.site_messages_30 + (e.clicks_30_by_type.site_message ?? 0);
            return s;
          },
          { v30: 0, c30: 0, vt: 0, ct: 0, paid: 0, organic: 0, direct: 0, other: 0, pv30: 0, web30: 0, msg30: 0 },
        );
        const chParts = [
          sum.paid > 0 ? `ממומן ${sum.paid}` : null,
          sum.organic > 0 ? `אורגני ${sum.organic}` : null,
          sum.direct > 0 ? `ישיר ${sum.direct}` : null,
          sum.other > 0 ? `אחר ${sum.other}` : null,
        ].filter(Boolean);
        return (
          <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-teal-200 bg-teal-50/60 px-5 py-3">
            <span className="text-sm font-black text-teal-900">📊 כל המרכזים הפעילים ({act.length})</span>
            <span className="text-sm text-stone-700">30 יום: <b className="text-stone-900">{sum.v30}</b> צפיות · <b className="text-stone-900">{sum.c30}</b> לחיצות ליצירת קשר
              {sum.c30 > 0 && chParts.length > 0 && <span className="text-stone-500"> ({chParts.join(" · ")})</span>}
            </span>
            <span className="text-sm text-stone-700">עמוד ציבורי: <b className="text-stone-900">{sum.pv30}</b> כניסות
              {sum.web30 > 0 && <> · <b className="text-stone-900">{sum.web30}</b> לחיצות לאתר המרכז</>}
              {sum.msg30 > 0 && <> · <b className="text-stone-900">{sum.msg30}</b> הודעות</>}
            </span>
            <span className="text-xs text-stone-500">מצטבר: {sum.vt} צפיות · {sum.ct} לחיצות</span>
          </div>
        );
      })()}

      {/* חלוקה לפי שלב ומסלול: פעילים (לפי מסלול) ← נשלחו וממתינים לתשלום ← טיוטות ← בוטלו.
          כך רואים במבט אחד מי בפנים, מי באמצע המשפך, ומה עוד לא יצא. */}
      {!loading && (() => {
        const match = (c: Center) => trackFilter === "all" || trackOf(c) === trackFilter;
        const allGroups: { key: string; stage: Center["status"]; title: string; items: Center[] }[] = [
          { key: "active2", stage: "active", title: "🏢 מנויים פעילים - מסלול 2 (מרכז כישות אחת)", items: centers.filter((c) => c.status === "active" && trackOf(c) === "center_entity" && match(c)) },
          { key: "active1", stage: "active", title: "👥 מנויים פעילים - מסלול 1 (מטפלים בנפרד)", items: centers.filter((c) => c.status === "active" && trackOf(c) === "per_therapist" && match(c)) },
          { key: "sent", stage: "sent", title: "✉️ הצעות שנשלחו - ממתינות לתשלום", items: centers.filter((c) => c.status === "sent" && match(c)) },
          { key: "draft", stage: "draft", title: "📝 טיוטות - טרם נשלחו", items: centers.filter((c) => c.status === "draft" && match(c)) },
          { key: "cancelled", stage: "cancelled", title: "⏸️ בוטלו", items: centers.filter((c) => c.status === "cancelled" && match(c)) },
        ];
        const groups = allGroups.filter((g) => (stageFilter === "all" || g.stage === stageFilter) && g.items.length > 0);
        if (groups.length === 0 && centers.length > 0) {
          return <p className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-400">אין מרכזים בסינון שנבחר</p>;
        }
        return groups.map((group) => (
      <section key={group.key} className="mb-8">
        <div className="mb-3 flex items-center gap-2 border-b border-stone-200 pb-2">
          <h2 className="text-base font-black text-stone-700">{group.title}</h2>
          <span className="rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-500">{group.items.length}</span>
        </div>
      {group.items.map((c) => {
        const st = STATUS_LABELS[c.status];
        const isEntity = c.billing_track === "center_entity";
        const p = centerMonthlyPricing(c);
        const total = p.monthlyTotal;
        const priced = isEntity ? total > 0 : (Number(c.price_per_therapist) > 0 && Number(c.therapist_count) > 0);
        return (
          <div key={c.id} className="mb-4 rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-black text-stone-800">{c.name}</h2>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${st.cls}`}>{st.label}</span>
                  {/* כל כרטיס מצהיר על המסלול שלו - לא רק מסלול 2 */}
                  {isEntity ? (
                    <span className="rounded-full bg-teal-50 border border-teal-300 px-2.5 py-0.5 text-xs font-bold text-teal-800">🏢 מסלול 2 · מרכז כישות</span>
                  ) : (
                    <span className="rounded-full bg-indigo-50 border border-indigo-300 px-2.5 py-0.5 text-xs font-bold text-indigo-800">👥 מסלול 1 · מטפלים בנפרד</span>
                  )}
                  {c.gift_months > 0 && (
                    <span className="rounded-full bg-amber-50 border border-amber-300 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                      🎁 {c.gift_months} חודשי מתנה
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  {c.contact_name && <>איש קשר: {c.contact_name} · </>}
                  {c.email && <>{c.email} · </>}
                  {c.phone && <>{c.phone} · </>}
                  נוצר {fmtDate(c.created_at)}
                </p>
              </div>
              <div className="text-left">
                {c.status === "active" ? (
                  <>
                    <div className="text-xl font-black text-green-700">₪{Number(c.agreed_monthly_price ?? total).toLocaleString("he-IL")} <span className="text-xs font-normal">+ מע&quot;מ/חודש</span></div>
                    <div className="text-xs text-stone-500">
                      {isEntity ? <>מרכז כישות אחת · </> : (priced && <>{c.therapist_count} מטפלים × ₪{ils(Number(c.price_per_therapist))} · </>)}
                      חיוב ראשון {fmtDate(c.billing_starts_at)}
                    </div>
                  </>
                ) : priced ? (
                  <>
                    <div className="text-xl font-black text-stone-800">₪{ils(total)} <span className="text-xs font-normal text-stone-500">+ מע&quot;מ/חודש</span></div>
                    <div className="text-xs text-stone-500">{isEntity ? "מרכז כישות אחת" : <>{c.therapist_count} מטפלים × ₪{ils(Number(c.price_per_therapist))}</>} · ₪{ils(p.monthlyTotalWithVat)} כולל מע&quot;מ</div>
                  </>
                ) : (
                  <div className="text-xs text-amber-600">{isEntity ? "טרם הוגדר מחיר חודשי" : "טרם הוגדר מחיר/מספר מטפלים"}</div>
                )}
              </div>
            </div>

            {/* ציר המסע: איפה המרכז עומד בחמשת שלבי המשפך */}
            {c.status !== "cancelled" && <Journey c={c} />}

            {/* מעורבות: התשובה המהירה ל"כמה פניות המרכז ייצר" בלי לפתוח את
                תצוגת הפרופילים ולסכם ידנית. פילוח הערוץ (ממומן/אורגני/ישיר)
                מוצג רק כשיש לחיצות בחלון - שורת אפסים אינה מידע. */}
            {c.engagement && (c.engagement.views_total > 0 || c.engagement.clicks_total > 0 || c.engagement.page_views_total > 0 || c.engagement.site_messages_total > 0) && (
              <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-700">
                <p>
                  📊 30 יום: <b className="text-stone-900">{c.engagement.views_30}</b> צפיות · <b className="text-stone-900">{c.engagement.clicks_30}</b> לחיצות ליצירת קשר
                  {c.engagement.clicks_30 > 0 && (() => {
                    const ch = c.engagement!.clicks_30_by_channel;
                    const parts = [
                      ch.paid > 0 ? `ממומן ${ch.paid}` : null,
                      ch.organic > 0 ? `אורגני ${ch.organic}` : null,
                      ch.direct > 0 ? `ישיר ${ch.direct}` : null,
                      ch.other > 0 ? `אחר ${ch.other}` : null,
                    ].filter(Boolean);
                    return parts.length > 0 ? <span className="text-stone-500"> ({parts.join(" · ")})</span> : null;
                  })()}
                  <span className="text-stone-400"> · מצטבר: {c.engagement.views_total} צפיות, {c.engagement.clicks_total} לחיצות</span>
                </p>
                {/* פילוח סוג הפנייה - ודאי (הודעה) מול כוונה (וואטסאפ/טלפון/מייל),
                    אותה שפה כמו עמוד הערבות. הודעות מסלול 1 מגיעות מ-crm_leads. */}
                {(() => {
                  const byType = { ...c.engagement!.clicks_30_by_type };
                  const trackOneMsgs = c.engagement!.site_messages_30;
                  if (trackOneMsgs > 0) byType.site_message = (byType.site_message ?? 0) + trackOneMsgs;
                  const parts = clickTypeParts(byType);
                  return parts ? <p className="mt-0.5 text-stone-600">פניות לפי סוג: {parts}</p> : null;
                })()}
                {(c.engagement.page_views_total > 0 || c.engagement.website_clicks_total > 0 || c.engagement.page_contact_total > 0) && (
                  <p className="mt-0.5 text-stone-600">
                    עמוד ציבורי (30 יום): {c.engagement.page_views_30} כניסות
                    {c.engagement.website_clicks_30 > 0 && <> · {c.engagement.website_clicks_30} לחיצות לאתר המרכז</>}
                    {c.engagement.page_contact_30 > 0 && <> · {c.engagement.page_contact_30} לחיצות קשר מהעמוד</>}
                    <span className="text-stone-400"> · מצטבר: {c.engagement.page_views_total} כניסות{c.engagement.website_clicks_total > 0 ? `, ${c.engagement.website_clicks_total} לאתר` : ""}</span>
                  </p>
                )}
              </div>
            )}

            {/* מוכנות לפי המסלול שנרכש - אותו מקור אמת כמו סוכן השימור וקרון
                הנדנודים. "אצלנו" מסומן בנפרד: אסור שחסם שלנו ייראה כאשמתם. */}
            {c.readiness && (c.readiness.missing.length > 0 || c.readiness.blocked_on_us.length > 0 || c.readiness.headline) && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-1.5 text-xs">
                <p className="font-bold text-stone-800">
                  🧭 מוכנות: {c.readiness.pct}%
                  {c.readiness.slots && <span className="font-normal text-stone-600"> · מקומות: {c.readiness.slots.promoted}/{c.readiness.slots.paid} פעילים{c.readiness.slots.filled > c.readiness.slots.promoted ? ` (${c.readiness.slots.filled} מקושרים)` : ""}</span>}
                </p>
                {c.readiness.headline && <p className="mt-0.5 font-semibold text-amber-800">{c.readiness.headline}</p>}
                {c.readiness.missing.length > 0 && (
                  <p className="mt-0.5 text-stone-600">
                    חסר אצלם: {c.readiness.missing.map((m) => m.label).join(" · ")}
                  </p>
                )}
                {c.readiness.blocked_on_us.length > 0 && (
                  <p className="mt-0.5 font-semibold text-red-700">אצלנו: {c.readiness.blocked_on_us.join(" · ")}</p>
                )}
              </div>
            )}

            {/* פירוט לפי מטפל - נפתח בלחיצה. מסלול 1: שורה לכל מטפל; מסלול 2:
                שורת הישות. עונה על "מי מהמטפלים של המרכז מייצר ומי שקוף". */}
            {c.status === "active" && (c.linked_therapist_count > 0 || isEntity) && (
              <div className="mt-2">
                <button onClick={() => toggleDetail(c)}
                  className="text-xs font-bold text-indigo-700 hover:underline">
                  {detailFor === c.id ? "▲ סגירת הפירוט" : "▼ פירוט לפי מטפל (צפיות ופניות)"}
                </button>
                {detailFor === c.id && (
                  detailLoading && !detailRows[c.id] ? (
                    <p className="mt-1 text-xs text-stone-400">טוען...</p>
                  ) : (detailRows[c.id] ?? []).length === 0 ? (
                    <p className="mt-1 text-xs text-stone-400">אין עדיין נתונים</p>
                  ) : (
                    <div className="mt-1 overflow-x-auto rounded-lg border border-stone-200">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-stone-50 text-right text-stone-500">
                            <th className="px-2 py-1.5 font-semibold">מטפל/ת</th>
                            <th className="px-2 py-1.5 font-semibold">מצב</th>
                            <th className="px-2 py-1.5 font-semibold">צפיות 30 י'</th>
                            <th className="px-2 py-1.5 font-semibold">פניות 30 י'</th>
                            <th className="px-2 py-1.5 font-semibold">לפי סוג</th>
                            <th className="px-2 py-1.5 font-semibold">מצטבר</th>
                            <th className="px-2 py-1.5 font-semibold">חסר בפרופיל</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(detailRows[c.id] ?? []).map((t) => (
                            <tr key={t.id} className="border-t border-stone-100">
                              <td className="px-2 py-1.5 font-bold text-stone-800">
                                {t.is_entity ? "🏢 " : ""}{t.full_name}
                              </td>
                              <td className="px-2 py-1.5">
                                {t.promoted
                                  ? <span className="font-bold text-green-700">פעיל/ה בהתאמות</span>
                                  : t.admin_approved
                                    ? <span className="text-stone-600">מאושר/ת, לא מקודם/ת</span>
                                    : <span className="font-bold text-amber-700">ממתין/ה לאישור</span>}
                              </td>
                              <td className="px-2 py-1.5">{t.views_30}</td>
                              <td className="px-2 py-1.5 font-bold text-stone-900">{t.clicks_30}</td>
                              <td className="px-2 py-1.5 text-stone-600">{clickTypeParts(t.by_type_30) || "-"}</td>
                              <td className="px-2 py-1.5 text-stone-500">{t.views_total} צ' / {t.clicks_total} פ'</td>
                              <td className="px-2 py-1.5 text-amber-700">{t.missing_fields.length > 0 ? t.missing_fields.join(", ") : "✓ מלא"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>
            )}

            {c.status === "active" && c.payer_name && (
              <p className="mt-2 rounded-lg bg-green-50/60 border border-green-100 px-3 py-1.5 text-xs text-stone-600">
                משלם: {c.payer_name} ({c.payer_email}) · שולם {fmtDate(c.paid_at)}
                {c.user_id
                  ? <strong className="text-green-700"> · ✓ נכנסו לפורטל</strong>
                  : <span className="text-amber-600"> · טרם נכנסו לפורטל (מייל כניסה: {c.email || c.payer_email || "-"})</span>}
                {!c.sumit_recurring_id && <strong className="text-red-600"> · ⚠️ חסר מזהה הוראת קבע - ביטול רק דרך ממשק Sumit</strong>}
              </p>
            )}

            {/* "מה עכשיו?" - כולל את חיווי התשלום המפורש (בלעדיו היה צריך
                להסיק מהסטטוס, ושורת-הישות של מסלול 2 יצרה רושם הפוך). */}
            {(() => {
              const h = nextStepHint(c);
              return h && <p className={`mt-2 rounded-lg border px-3 py-1.5 text-xs ${HINT_CLS[h.tone]}`}>{h.text}</p>;
            })()}
            {c.notes && <p className="mt-2 text-xs text-stone-500 whitespace-pre-wrap">📝 {c.notes}</p>}
            {sumitInfo[c.id] && <p className="mt-2 text-xs font-bold text-[#0F5468]">{sumitInfo[c.id]}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <button onClick={() => copyLink(c)}
                className="rounded-full border border-teal-300 bg-teal-50 px-3 py-1 font-bold text-teal-800 hover:bg-teal-100">
                {copied === c.id ? "✓ הועתק!" : "🔗 העתקת קישור למרכז"}
              </button>
              {!isEntity && (
                <button onClick={() => openManage(c)}
                  className="rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1 font-bold text-indigo-800 hover:bg-indigo-100">
                  👥 שיוך מטפלים ({c.linked_therapist_count})
                </button>
              )}
              {/* כל ניהול הפרופילים של המרכז נעשה מכאן - הם מוסתרים מ"ניהול מטפלים" הכללי */}
              {(isEntity || c.linked_therapist_count > 0) && (
                <a href={`/admin/therapists?center=${c.id}`}
                  className="rounded-full border border-indigo-300 bg-white px-3 py-1 font-bold text-indigo-800 hover:bg-indigo-50">
                  🛠 {isEntity ? "פרופיל המרכז (עריכה ואישור)" : "הפרופילים באדמין"}
                </a>
              )}
              {/* קישור ישיר לעמוד החי. התנאי זהה ל-listPublicCenters: במסלול 2
                  העמוד הציבורי הוא כל המוצר ולכן הוא פעיל גם בלי הדגל - בלי
                  הקישור הזה נראה באדמין כאילו העמוד כבוי בזמן שהוא באוויר. */}
              {c.slug && c.status === "active" && (isEntity || c.public_page_enabled) && (
                <a href={`/centers/${c.slug}`} target="_blank" rel="noopener noreferrer"
                  className="rounded-full border border-teal-300 bg-teal-50 px-3 py-1 font-bold text-teal-800 hover:bg-teal-100">
                  🌐 לעמוד הציבורי ↗
                </a>
              )}
              {/* רק במרכז ששילם. בטיוטה שורת-הישות נוצרת אוטומטית עם הבחירה
                  במסלול 2 ותמיד pending - התג שם נראה כאילו המרכז הגיש משהו
                  וממתין לך, בזמן שאיש לא נגע. אישור לפני תשלום ממילא לא מקדם
                  (promoteCenterTherapists דורש מנוי פעיל). */}
              {c.status === "active" && c.pending_therapist_count > 0 && (
                <a href={`/admin/therapists?center=${c.id}`}
                  className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 font-bold text-amber-800 hover:bg-amber-100">
                  ⏳ ממתינים לאישור: {c.pending_therapist_count}
                </a>
              )}
              {(c.status === "draft" || c.status === "sent") && (
                <>
                  <button onClick={() => sendProposal(c)} disabled={busy || !c.email}
                    title={c.email ? "שליחת ההצעה במייל למרכז + קישור הצטרפות" : "אין אימייל למרכז - הוסיפו בעריכה"}
                    className="rounded-full border border-teal-400 bg-teal-600 px-3 py-1 font-bold text-white hover:bg-teal-700 disabled:opacity-40">
                    ✉️ שלח הצעה במייל
                  </button>
                  <button onClick={() => post({ action: "mark_sent", id: c.id })} disabled={busy}
                    className="rounded-full border border-stone-300 px-3 py-1 text-stone-600 hover:bg-stone-50">
                    {c.status === "sent" ? "החזרה לטיוטה" : "סימון כנשלחה ידנית"}
                  </button>
                  <button onClick={() => regenToken(c)} disabled={busy}
                    title="מנפיק קישור חדש ומבטל את הישן. התמחור וכל פרטי ההצעה נשמרים."
                    className="rounded-full border border-stone-300 px-3 py-1 text-stone-600 hover:bg-stone-50">
                    🔄 חידוש קישור
                  </button>
                  <button onClick={() => openEdit(c)} className="rounded-full border border-stone-300 px-3 py-1 text-stone-600 hover:bg-stone-50">
                    עריכה
                  </button>
                  <button onClick={() => del(c)} disabled={busy}
                    title="מחיקת הטיוטה מהמערכת"
                    className="rounded-full border border-red-200 px-3 py-1 text-red-600 hover:bg-red-50 disabled:opacity-40">
                    🗑 מחק טיוטה
                  </button>
                </>
              )}
              {c.status === "active" && (
                <>
                  <button onClick={() => openEdit(c)} className="rounded-full border border-stone-300 px-3 py-1 text-stone-600 hover:bg-stone-50">
                    עריכת פרטים
                  </button>
                  <button onClick={() => syncSumit(c)} disabled={busy}
                    className="rounded-full border border-stone-300 px-3 py-1 text-stone-600 hover:bg-stone-50">
                    🔄 סטטוס מ-Sumit
                  </button>
                  {c.sumit_recurring_id && (
                    <button
                      onClick={() => {
                        if (confirm(`לבטל את המנוי של ${c.name}? הוראת הקבע ב-Sumit תבוטל והחיובים ייפסקו.`)) {
                          post({ action: "cancel_subscription", id: c.id });
                        }
                      }}
                      disabled={busy}
                      className="rounded-full border border-red-300 bg-red-50 px-3 py-1 font-bold text-red-700 hover:bg-red-100"
                    >
                      ביטול מנוי
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
      </section>
        ));
      })()}

      {/* מודל יצירה/עריכה. הכרטיס זורם בגובה טבעי (בלי max-h ובלי גלילה פנימית)
          בתוך שכבה שכולה גוללת (overflow-y-auto). items-start + my-auto ממרכז את
          הכרטיס כשהוא נמוך מהמסך, וכשהוא גבוה יותר (זום/מסך קצר) השכבה פשוט גוללת
          אותו במלואו - כך כל התוכן, מהכותרת ועד כפתור השמירה, תמיד נגיש ואף פרוסה
          לא נחתכת. (הדפוס ההיברידי הקודם עם max-h-[90vh]+גלילה פנימית חתך תוכן
          בזומים מסוימים.) */}
      {editing && (
        <div className="fixed inset-0 z-[110] overflow-y-auto" dir="rtl" onClick={() => setEditing(null)}>
          <div className="fixed inset-0 bg-black/30" />
          <div className="flex min-h-full items-start justify-center p-4">
          <div
            className="relative my-auto w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between rounded-t-2xl border-b border-stone-100 px-6 py-4">
              <h3 className="text-lg font-black text-stone-800">
                {editing === "new" ? "הצעה למרכז חדש" : `עריכה - ${(editing as Center).name}`}
              </h3>
              <button onClick={() => setEditing(null)} className="text-stone-400 hover:text-stone-600">✕</button>
            </div>

            <div className="px-6 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="שם המרכז *">
                <input value={fName} onChange={(e) => setFName(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
              </Field>
              <Field label="איש/אשת קשר">
                <input value={fContact} onChange={(e) => setFContact(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
              </Field>
              <Field label="אימייל">
                <input value={fEmail} onChange={(e) => setFEmail(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" dir="ltr" />
              </Field>
              <Field label="טלפון">
                <input value={fPhone} onChange={(e) => setFPhone(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" dir="ltr" />
              </Field>
            </div>

            {!isLockedEditing && (
              <Field label="🎁 חודשי מתנה (0 = בלי מתנה; הכרטיס נשמר מיד והחיוב הראשון יוצא בתום המתנה)">
                <input type="number" min={0} max={12} value={fGift} onChange={(e) => setFGift(e.target.value)}
                  className="w-24 rounded-lg border border-stone-300 px-3 py-2 text-sm" dir="ltr" />
              </Field>
            )}

            {!pricingLocked && (
              <>
                <div className="mt-2 mb-1">
                  <span className="text-xs font-black text-stone-700">מסלול ומחיר (כפי שנקבעו בשיחת ההתאמה)</span>
                </div>
                {/* בורר מסלול חיוב - לא ניתן להחליף במרכז פעיל */}
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <button type="button" disabled={isActiveEditing}
                    onClick={() => setFBillingTrack("per_therapist")}
                    className={`rounded-lg border px-3 py-2 text-right text-xs disabled:opacity-50 ${fBillingTrack === "per_therapist" ? "border-teal-500 bg-teal-50 font-bold text-teal-800" : "border-stone-300 text-stone-600"}`}>
                    מסלול 1 - מחיר לכל מטפל
                    <span className="block text-[10px] font-normal text-stone-500">פרופיל לכל מטפל · מחיר × מספר</span>
                  </button>
                  <button type="button" disabled={isActiveEditing}
                    onClick={() => setFBillingTrack("center_entity")}
                    className={`rounded-lg border px-3 py-2 text-right text-xs disabled:opacity-50 ${fBillingTrack === "center_entity" ? "border-teal-500 bg-teal-50 font-bold text-teal-800" : "border-stone-300 text-stone-600"}`}>
                    מסלול 2 - מרכז כישות אחת
                    <span className="block text-[10px] font-normal text-stone-500">רובריקה אחת בהתאמות · מחיר חודשי קבוע</span>
                  </button>
                </div>
                {fBillingTrack === "center_entity" ? (
                  <>
                    <p className="mb-2 text-[11px] leading-4 text-stone-400">
                      המרכז מוצג כרובריקה אחת (&quot;מרכז טיפולי X&quot;) במערכת ההתאמות לפי סוגי הטיפול שהוא מציע; הפניות מגיעות למרכז. את הפרופיל המורחב (סוגי טיפול, אזורים, גילאים ועוד) עורכים ב-/admin/therapists או בפורטל המרכז.
                    </p>
                    <Field label="מחיר חודשי קבוע (₪ לחודש, לפני מע&quot;מ) *">
                      <input value={fFixedPrice} inputMode="decimal" placeholder="למשל 350"
                        onChange={(e) => setFFixedPrice(e.target.value.replace(/[^\d.]/g, ""))}
                        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" dir="ltr" />
                    </Field>
                  </>
                ) : (
                  <>
                    <p className="mb-2 text-[11px] leading-4 text-stone-400">
                      כל מנוי כולל אוטומטית: כניסה למערכת ההתאמות, דוח סטטיסטיקות חודשי, וביטול בכל עת (כולל בחודשי המתנה) - מוצג למרכז בדף ההצטרפות. כאן מגדירים רק את המחיר לכל מטפל ואת מספר המטפלים.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="מחיר לכל מטפל (₪ לחודש, לפני מע&quot;מ) *">
                        <input value={fPricePerTherapist} inputMode="decimal" placeholder="למשל 80"
                          onChange={(e) => setFPricePerTherapist(e.target.value.replace(/[^\d.]/g, ""))}
                          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" dir="ltr" />
                      </Field>
                      <Field label="מספר מטפלים *">
                        <input value={fTherapistCount} inputMode="numeric" placeholder="למשל 5"
                          onChange={(e) => setFTherapistCount(e.target.value.replace(/\D/g, ""))}
                          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" dir="ltr" />
                      </Field>
                    </div>
                  </>
                )}
                {/* מיקומים והנחה - חלים על שני המסלולים */}
                <div className="mt-1 grid gap-3 sm:grid-cols-2">
                  <Field label="מספר מיקומים / סניפים (מכפיל את המחיר)">
                    <input value={fLocations} inputMode="numeric" placeholder="1"
                      onChange={(e) => setFLocations(e.target.value.replace(/\D/g, ""))}
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" dir="ltr" />
                  </Field>
                  <Field label="הנחה (₪ לחודש, לפני מע&quot;מ)">
                    <input value={fDiscount} inputMode="decimal" placeholder="0"
                      onChange={(e) => setFDiscount(e.target.value.replace(/[^\d.]/g, ""))}
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" dir="ltr" />
                  </Field>
                </div>
                <div className="mt-1 mb-2 rounded-lg bg-stone-50 border border-stone-200 px-3 py-2 text-xs text-stone-600 leading-6">
                  {fPricing.baseTotal > 0 ? (
                    <>
                      {fBillingTrack === "center_entity"
                        ? <>מחיר בסיס ₪{ils(Number(fFixedPrice) || 0)}</>
                        : <>{Number(fTherapistCount) || 0} × ₪{ils(Number(fPricePerTherapist) || 0)}</>}
                      {fPricing.numLocations > 1 && <> · {fPricing.numLocations} מיקומים = ₪{ils(fPricing.baseTotal)}</>}
                      {fPricing.discountAmount > 0 && <> · הנחה −₪{ils(fPricing.discountAmount)}</>}
                      {" · "}<strong className="text-stone-900">סה&quot;כ ₪{ils(fTotal)}</strong> + מע&quot;מ (₪{ils(fPricing.monthlyTotalWithVat)} כולל)
                    </>
                  ) : (
                    fBillingTrack === "center_entity"
                      ? "הזינו מחיר חודשי קבוע כדי לראות את הסכום הכולל."
                      : "הזינו מחיר לכל מטפל ומספר מטפלים כדי לראות את הסכום החודשי הכולל."
                  )}
                </div>
                {isActiveEditing && (
                  <p className="mb-2 text-[11px] leading-4 text-amber-600">
                    ⚠️ שינוי המחיר במרכז פעיל יעדכן מיד את הסכום החודשי בהוראת הקבע ב-Sumit (מהחיוב הבא). לא ניתן להחליף מסלול חיוב במרכז פעיל.
                  </p>
                )}
              </>
            )}

            <Field label="הערות פנימיות (לא מוצג למרכז)">
              <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={2}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
            </Field>

            {/* עמוד המרכז הציבורי (SEO) - רק למרכז קיים */}
            {editing !== "new" && editing !== null && (
              <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-black text-teal-900">🌐 עמוד המרכז הציבורי (SEO)</h4>
                  {/* במסלול 2 העמוד הציבורי הוא כל המוצר, ולכן listPublicCenters
                      מפרסם אותו גם כשהדגל כבוי. הצגת תיבה לא-מסומנת שם קראה
                      כאילו העמוד לא באוויר - וזו בדיוק הטעות שדווחה. */}
                  {fBillingTrack === "center_entity" ? (
                    <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800">
                      תמיד גלוי (מסלול 2)
                    </span>
                  ) : (
                    <label className="flex items-center gap-2 text-xs font-semibold text-stone-700">
                      <input type="checkbox" checked={fPubEnabled} onChange={(e) => setFPubEnabled(e.target.checked)} />
                      עמוד פעיל וגלוי לציבור
                    </label>
                  )}
                </div>
                {editing.slug && (
                  <p className="mb-3 text-xs text-stone-500">
                    כתובת:{" "}
                    <a href={`/centers/${editing.slug}`} target="_blank" className="font-mono font-bold text-teal-700 underline">
                      /centers/{editing.slug}
                    </a>
                    {editing.status !== "active" && <span className="text-amber-600"> · יפורסם רק כשהמרכז פעיל</span>}
                  </p>
                )}
                <Field label="תיאור המרכז (מוצג בעמוד ובגוגל)">
                  <textarea value={fPubDesc} onChange={(e) => setFPubDesc(e.target.value)} rows={3}
                    placeholder="על המרכז, הגישה, תחומי ההתמחות והצוות…"
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                </Field>
                <Field label="שמות המנהלים / הצוות">
                  <input value={fPubManagers} onChange={(e) => setFPubManagers(e.target.value)}
                    placeholder="ד״ר כהן, גב׳ לוי…" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="עיר / כתובת">
                    <input value={fPubCity} onChange={(e) => setFPubCity(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                  </Field>
                  <Field label="טלפון ציבורי">
                    <input value={fPubPhone} onChange={(e) => setFPubPhone(e.target.value)} dir="ltr"
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                  </Field>
                </div>
                <Field label="אתר המרכז">
                  <input value={fPubWebsite} onChange={(e) => setFPubWebsite(e.target.value)} dir="ltr"
                    placeholder="https://…" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                </Field>
              </div>
            )}
            </div>

            <div className="rounded-b-2xl border-t border-stone-100 px-6 py-4">
              <button onClick={save} disabled={busy || !fName.trim() || (!pricingLocked && fTotal <= 0)}
                className="w-full rounded-xl bg-stone-800 py-2.5 text-sm font-bold text-white disabled:opacity-40">
                {busy ? "שומר…" : "שמירה"}
              </button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* מודל: ניהול שיוך מטפלים למרכז */}
      {manageFor && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" dir="rtl">
          <div className="absolute inset-0 bg-black/30" onClick={() => setManageFor(null)} />
          <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
            <div className="rounded-t-2xl border-b border-stone-100 px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-stone-800">מטפלי {manageFor.name}</h3>
                <button onClick={() => setManageFor(null)} className="text-stone-400 hover:text-stone-600">✕</button>
              </div>
              <p className="mt-1 text-xs text-stone-500">סמנו את המטפלים ששייכים למרכז - הם יופיעו בפורטל המרכז ובסטטיסטיקות המרוכזות. מטפל משויך למרכז אחד בלבד.</p>
              <input
                value={poolSearch}
                onChange={(e) => setPoolSearch(e.target.value)}
                placeholder="חיפוש לפי שם…"
                className="mt-3 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
              {poolLoading ? (
                <p className="py-6 text-center text-sm text-stone-400">טוען מטפלים…</p>
              ) : (() => {
                const q = poolSearch.trim().toLowerCase();
                const filtered = q ? pool.filter((t) => t.full_name.toLowerCase().includes(q)) : pool;
                if (filtered.length === 0) return <p className="py-6 text-center text-sm text-stone-400">לא נמצאו מטפלים</p>;
                return (
                  <div className="space-y-1">
                    {filtered.map((t) => {
                      const checked = selectedTx.has(t.id);
                      const otherCenter = t.center_account_id && t.center_account_id !== manageFor.id ? t.center_name : null;
                      return (
                        <label key={t.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 ${checked ? "border-indigo-300 bg-indigo-50" : "border-stone-200 hover:bg-stone-50"}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedTx((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(t.id); else next.delete(t.id);
                                return next;
                              });
                            }}
                            className="h-4 w-4 accent-indigo-600"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-stone-800">{t.full_name}</div>
                            <div className="truncate text-xs text-stone-400">
                              {t.email ?? "-"}
                              {otherCenter && <span className="text-amber-600"> · משויך כרגע ל{otherCenter}</span>}
                            </div>
                          </div>
                          <span className="text-[10px] text-stone-400">{t.status}</span>
                        </label>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-between rounded-b-2xl border-t border-stone-100 px-6 py-4">
              <span className="text-xs text-stone-500">{selectedTx.size} נבחרו</span>
              <button onClick={saveTherapists} disabled={busy}
                className="rounded-xl bg-stone-800 px-6 py-2 text-sm font-bold text-white disabled:opacity-40">
                {busy ? "שומר…" : "שמירת השיוך"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ציר המסע של מרכז: חמשת שלבי המשפך במבט אחד. ✓ ירקרק = הושלם, ● ענברי =
// השלב הנוכחי, ○ אפור = עוד לא. hover על שלב שהושלם מציג תאריך כשידוע.
function Journey({ c }: { c: Center }) {
  const isEntity = trackOf(c) === "center_entity";
  const steps: { label: string; done: boolean; title?: string }[] = [
    { label: "הצעה", done: true, title: `נוצרה ${fmtDate(c.created_at)}` },
    { label: "נשלחה", done: c.status !== "draft" },
    { label: "תשלום", done: !!c.paid_at, title: c.paid_at ? `שולם ${fmtDate(c.paid_at)}` : undefined },
    { label: "חשבון פורטל", done: !!c.user_id },
    {
      label: isEntity ? "פרופיל מאושר" : "מטפלים באוויר",
      done: c.status === "active" && c.pending_therapist_count === 0 && (isEntity || c.linked_therapist_count > 0),
    },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-y-1">
      {steps.map((s, i) => (
        <span key={s.label} className="flex items-center">
          {i > 0 && <span className={`inline-block h-px w-3 sm:w-6 ${steps[i - 1].done ? "bg-teal-300" : "bg-stone-200"}`} />}
          <span title={s.title}
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] ${
              s.done
                ? "border-teal-300 bg-teal-50 font-bold text-teal-800"
                : i === current
                  ? "border-amber-300 bg-amber-50 font-bold text-amber-800"
                  : "border-stone-200 bg-white text-stone-400"
            }`}>
            {s.done ? "✓" : i === current ? "●" : "○"} {s.label}
          </span>
        </span>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-semibold text-stone-500">{label}</label>
      {children}
    </div>
  );
}
