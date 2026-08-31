// Shared CRM vocabulary - isomorphic (imported by both admin pages and API
// routes). Labels are the single source of truth for status/stage names so
// every screen renders the same Hebrew for the same state.

export type CrmEntityType = "therapist" | "organization" | "lead" | "deal";

export const LEAD_STATUSES = [
  { value: "new", label: "חדשה", cls: "bg-blue-50 border-blue-200 text-blue-800" },
  { value: "in_progress", label: "בטיפול", cls: "bg-amber-50 border-amber-200 text-amber-800" },
  { value: "converted", label: "הומרה", cls: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  { value: "closed", label: "נסגרה", cls: "bg-stone-100 border-stone-200 text-stone-500" },
] as const;

export const LEAD_TYPES = [
  { value: "patient", label: "מטופל/ת" },
  { value: "therapist", label: "מטפל/ת" },
  { value: "teacher", label: "מורה מקצועי/ת" },
  { value: "organization", label: "ארגון / מרכז" },
  { value: "general", label: "כללי" },
] as const;

// תחנות הצינור (הוחלפו 30/8/26; הערכים הישנים מופו במיגרציה). עסקה
// נעה שמאלה תחנה-תחנה, ו-closed מגיע גם אוטומטית כשמזוהה מנוי פעיל.
export const DEAL_STAGES = [
  { value: "first_contact", label: "פנייה ראשונית" },
  { value: "negotiation", label: "משא ומתן" },
  { value: "link_sent", label: "נשלח לינק הרשמה" },
  { value: "closed", label: "הרשמה נסגרה ✓" },
  { value: "lost", label: "אבודה" },
] as const;

// למה עסקה נפלה. רשימה סגורה וקצרה - טקסט חופשי לא ניתן לספירה, וזו
// בדיוק השאלה שרוצים לענות עליה בעוד חצי שנה.
export const LOST_REASONS = [
  { value: "price", label: "יקר מדי" },
  { value: "competitor", label: "הלכו למתחרה" },
  { value: "not_relevant", label: "לא רלוונטי" },
  { value: "no_response", label: "הפסיקו להגיב" },
  { value: "timing", label: "לא בתזמון הנכון" },
  { value: "other", label: "אחר" },
] as const;

/** התחנות שמוציאות עסקה מהצינור הפתוח. */
export const CLOSED_DEAL_STAGES = ["closed", "lost"] as const;

export const DEAL_TYPES = [
  { value: "school", label: "בית ספר / חינוך" },
  { value: "kupah", label: "קופת חולים" },
  { value: "college", label: "מכללה / אקדמיה" },
  { value: "psychologists", label: "שילוב פסיכולוגים" },
  { value: "center", label: "מרכז טיפולי" },
  { value: "other", label: "אחר" },
] as const;

export const TASK_PRIORITIES = [
  { value: "high", label: "גבוהה", cls: "bg-red-50 border-red-200 text-red-700" },
  { value: "normal", label: "רגילה", cls: "bg-stone-50 border-stone-200 text-stone-600" },
  { value: "low", label: "נמוכה", cls: "bg-stone-50 border-stone-200 text-stone-400" },
] as const;

// The money-back guarantee window for paying therapists: a full refund if no
// patient inquiry arrived within this many days of the subscription start.
export const GUARANTEE_DAYS = 60;

// Israeli VAT rate - drives the automatic VAT calculation in the expense form
// (isomorphic on purpose: the form computes live, the export recomputes).
export const VAT_RATE = 0.18;

// Expense ledger categories. `refund_*` categories are money returned to
// therapists - kept in the same ledger so the monthly balance is honest, but
// reported separately (refund rate vs the 20% the business plan budgeted).
// `ad` categories carry a channel and feed the live CAC calculation.
export const EXPENSE_CATEGORIES = [
  { value: "advertising_google", label: "פרסום - גוגל", channel: "google_paid" },
  { value: "advertising_meta", label: "פרסום - מטא", channel: "meta_paid" },
  { value: "advertising_other", label: "פרסום - אחר", channel: "other" },
  { value: "software", label: "תוכנה ותשתיות", channel: null },
  { value: "rnd", label: "מחקר ופיתוח", channel: null },
  { value: "accounting_legal", label: "רו\"ח / משפטי", channel: null },
  { value: "salaries", label: "שכר וקבלני משנה", channel: null },
  { value: "refund_guarantee", label: "החזר - אחריות (גרנטי)", channel: null },
  { value: "refund_other", label: "החזר - אחר", channel: null },
  { value: "office", label: "משרד ושונות", channel: null },
  { value: "other", label: "אחר", channel: null },
] as const;

export const REFUND_CATEGORIES = ["refund_guarantee", "refund_other"];

export function labelOf(
  list: ReadonlyArray<{ value: string; label: string }>,
  value: string | null | undefined
): string {
  return list.find((x) => x.value === value)?.label ?? value ?? "";
}

// Gmail deep-link: opens the admin's Gmail filtered to all correspondence
// with the given address. Zero-integration email history (CRM plan level A).
export function gmailSearchUrl(email: string): string {
  return `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(email)}`;
}
