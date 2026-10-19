// ענף בתי הספר: רשימות הבחירה, התוויות והכללים הטהורים (בלי מסד ובלי שרת),
// כך שהבדיקות והמסכים חולקים מקור אחד. הטבלאות: supabase/migrations/20261019_schools_branch.sql.
// התכנון: Dropbox\פרטי\Mentalitics\טיפול חכם לבתי ספר\תכנון CRM לענף בתי הספר (גרסה 2).
//
// תנאי ההסכם (הסולם, השערים, דמי הפלטפורמה) אינם כאן אלא ב-school_branch_settings;
// DEFAULT_BRANCH_SETTINGS הוא רק הצורה של האובייקט והערכים הראשוניים שהבעלים
// מאשר במסך ההגדרות. הריפו ציבורי.

import { VAT_RATE } from "./crm";

export type Opt<T extends string = string> = { value: T; label: string };

export const OWNER_KINDS: Opt[] = [
  { value: "authority", label: "רשות מקומית / מועצה" },
  { value: "network", label: "רשת חינוך" },
  { value: "private", label: "בעלות פרטית" },
  { value: "other", label: "אחר" },
];

export const SUPPLIER_STATUSES: Opt[] = [
  { value: "none", label: "לא נפתחנו כספק" },
  { value: "forms_sent", label: "נשלחה חבילת ספק" },
  { value: "approved", label: "ספק מאושר" },
];

export const SCHOOL_STAGES: Opt[] = [
  { value: "gan", label: "גן" },
  { value: "maon", label: "מעון" },
  { value: "elementary", label: "יסודי" },
  { value: "middle", label: "חטיבת ביניים" },
  { value: "high", label: "תיכון" },
  { value: "six_year", label: "שש-שנתי" },
  { value: "other", label: "אחר" },
];

export const SECTORS: Opt[] = [
  { value: "mamlachti", label: "ממלכתי" },
  { value: "mamad", label: "ממלכתי-דתי" },
  { value: "haredi", label: "חרדי" },
  { value: "arab", label: "ערבי" },
  { value: "druze", label: "דרוזי" },
  { value: "other", label: "אחר" },
];

export const SCHOOL_STATUSES: Opt[] = [
  { value: "prospect", label: "פוטנציאלי" },
  { value: "pilot", label: "פיילוט" },
  { value: "customer", label: "לקוח" },
  { value: "past", label: "לקוח לשעבר" },
  { value: "lost", label: "אבוד" },
  { value: "not_relevant", label: "לא רלוונטי" },
];

export const CONTACT_ROLES: Opt[] = [
  { value: "counselor", label: "יועצת" },
  { value: "principal", label: "מנהל/ת" },
  { value: "deputy", label: "סגן/ית" },
  { value: "coordinator", label: "רכז/ת" },
  { value: "treasurer", label: "גזבר/ית" },
  { value: "education_head", label: "מנהל/ת אגף חינוך" },
  { value: "other", label: "אחר" },
];

// סדר העמודות בלוח הצינור. "frozen" ו-"lost" מוצגות מקופלות.
export const DEAL_STAGES: Opt[] = [
  { value: "listed", label: "רשום" },
  { value: "contacted", label: "פנייה ראשונה" },
  { value: "meeting", label: "פגישה או הדגמה" },
  { value: "pilot", label: "פיילוט" },
  { value: "quote_sent", label: "הצעת מחיר נשלחה" },
  { value: "approval", label: "אישור רכש" },
  { value: "active", label: "שולם, רישיון פעיל" },
  { value: "renewal", label: "חידוש" },
  { value: "frozen", label: "מוקפא" },
  { value: "lost", label: "אבוד" },
];
export const CLOSED_DEAL_STAGES = ["active", "lost"] as const;

export const DEAL_PRODUCTS: Opt[] = [
  { value: "license", label: "רישיון לשאלון" },
  { value: "training", label: "הדרכה" },
  { value: "authority_package", label: "חבילה לרשות" },
  { value: "other", label: "אחר" },
];

export const DEAL_SOURCES: Opt[] = [
  { value: "naama", label: "פנייה של נעמה" },
  { value: "inbound", label: "פנייה נכנסת" },
  { value: "referral", label: "המלצה" },
  { value: "gefen", label: "מאגר הגפ\"ן" },
  { value: "authority", label: "דרך הרשות" },
  { value: "owner", label: "פנייה של אבשלום" },
  { value: "other", label: "אחר" },
];

export const PROCUREMENT_ROUTES: Opt[] = [
  { value: "initiative", label: "יוזמה ישירה (עד 30% מהתקציב)" },
  { value: "registry", label: "מאגר המשרד" },
  { value: "authority", label: "רכש של הרשות" },
  { value: "unknown", label: "עוד לא ידוע" },
];

export const DEAL_LOST_REASONS: Opt[] = [
  { value: "no_budget", label: "אין תקציב" },
  { value: "timing", label: "לא בתזמון" },
  { value: "other_tool", label: "משתמשים בכלי אחר" },
  { value: "no_counselor", label: "אין יועצת" },
  { value: "authority_refused", label: "הרשות סירבה" },
  { value: "no_response", label: "הפסיקו להגיב" },
  { value: "other", label: "אחר" },
];

export const LICENSE_KINDS: Opt[] = [
  { value: "annual", label: "שנתי" },
  { value: "partial", label: "חלקי עד סוף שנת הלימודים" },
  { value: "pilot", label: "פיילוט" },
  { value: "demo", label: "הדגמה (לא נספר)" },
  { value: "trial", label: "ניסיון" },
  { value: "training_only", label: "הדרכה בלבד" },
];

export const LICENSE_STATUSES: Opt[] = [
  { value: "pending_payment", label: "ממתין לתשלום" },
  { value: "active", label: "פעיל" },
  { value: "expired", label: "פג" },
  { value: "cancelled", label: "בוטל" },
];

export const SCHEDULE_KINDS: Opt[] = [
  { value: "full", label: "תשלום מלא עם ההפעלה" },
  { value: "split_40_60", label: "40% בהפעלה, 60% עד סוף פברואר" },
];

export const PAYMENT_METHODS: Opt[] = [
  { value: "transfer", label: "העברה בנקאית" },
  { value: "card", label: "כרטיס אשראי" },
  { value: "check", label: "המחאה" },
  { value: "po", label: "הזמנת רכש" },
  { value: "other", label: "אחר" },
];

export const PAYMENT_STATUSES: Opt[] = [
  { value: "expected", label: "צפוי" },
  { value: "received", label: "התקבל" },
  { value: "refunded", label: "הוחזר" },
  { value: "cancelled", label: "בוטל" },
];

export const ACTIVITY_KINDS: Opt[] = [
  { value: "call", label: "שיחה" },
  { value: "meeting", label: "פגישה" },
  { value: "whatsapp", label: "וואטסאפ" },
  { value: "email", label: "מייל" },
  { value: "demo", label: "הדגמה" },
  { value: "training", label: "הדרכה" },
  { value: "status", label: "שינוי סטטוס" },
  { value: "system", label: "מערכת" },
  { value: "note", label: "הערה" },
];

export const COST_CLASSES: Opt[] = [
  { value: "fees", label: "עמלות סליקה ובנק" },
  { value: "staff", label: "עובדי הענף" },
  { value: "ops", label: "תפעול ישיר" },
  { value: "marketing", label: "שיווק, אירועים ומכרזים" },
  { value: "platform", label: "דמי פלטפורמה" },
  { value: "other", label: "אחר" },
];

export const EXPENSE_APPROVALS: Opt[] = [
  { value: "proposed", label: "מוצעת" },
  { value: "approved", label: "מאושרת" },
  { value: "rejected", label: "נדחתה" },
];

export const SCHOOL_ENTITY_TYPES = ["school", "school_owner", "school_deal", "school_license"] as const;
export type SchoolEntityType = (typeof SCHOOL_ENTITY_TYPES)[number];

export function labelOf(list: Opt[], value: string | null | undefined): string {
  return list.find((o) => o.value === value)?.label ?? (value ?? "");
}

// ── הגדרות הענף: הצורה, והערכים הראשוניים (לאישור הבעלים במסך ההגדרות) ─────────
export type LadderStep = {
  stage: number;
  rate: number; // 0.10 .. 0.50
  not_before_month: number; // חודשים מיום ההתחלה
  gate_schools: number | null; // שער א': בתי ספר משלמים מצטבר
  gate_receipts: number | null; // שער ב': תקבולים נטו מצטברים, ש"ח
};

export type BranchSettings = {
  start_date: string | null; // יום ההתחלה לפי ההסכם, YYYY-MM-DD
  ladder: LadderStep[];
  platform_fee: {
    tier1_max: number; // תקבולים נטו ב-12 חודשים עד סכום זה: tier1_monthly
    tier1_monthly: number;
    tier2_max: number;
    tier2_monthly: number;
    pct_above: number; // מעל tier2_max: אחוז מהתקבולים ב-12 חודשים, חלקי 12
  };
  min_paying_price_net: number; // "בית ספר משלם" (נספח ב'): לפחות סכום זה לשנה בלי מע"מ
  partial_min_months: number; // רישיון חלקי אינו קצר מזה (נספח ד')
  trial_enabled: boolean; // האם טופס הפנייה מציע קוד ניסיון
  trial_days: number;
  pilot_default_days: number;
  payment_details: PaymentDetails;
};

// פרטי התשלום שדף התשלום מציג לבית הספר (העברה בנקאית והמחאה). יושבים במסד
// עם שאר הגדרות הענף ולא בקוד: הריפו ציבורי. שדה ריק = הפסקה לא מוצגת.
export type PaymentDetails = {
  payee: string; // שם המוטב כפי שמופיע בחשבון הבנק
  company_number: string; // ח.פ.
  bank_name: string;
  bank_branch: string;
  bank_account: string;
  iban: string;
  check_address: string; // כתובת למשלוח המחאה
  contact_email: string; // לאישורי העברה ולשאלות
};

export const EMPTY_PAYMENT_DETAILS: PaymentDetails = {
  payee: "", company_number: "", bank_name: "", bank_branch: "", bank_account: "", iban: "", check_address: "", contact_email: "",
};

export const DEFAULT_BRANCH_SETTINGS: BranchSettings = {
  start_date: null,
  ladder: [
    { stage: 1, rate: 0.1, not_before_month: 0, gate_schools: null, gate_receipts: null },
    { stage: 2, rate: 0.2, not_before_month: 2, gate_schools: 40, gate_receipts: 25_000 },
    { stage: 3, rate: 0.3, not_before_month: 4, gate_schools: 120, gate_receipts: 76_000 },
    { stage: 4, rate: 0.4, not_before_month: 6, gate_schools: 300, gate_receipts: 190_000 },
    { stage: 5, rate: 0.5, not_before_month: 8, gate_schools: 500, gate_receipts: 320_000 },
  ],
  platform_fee: { tier1_max: 100_000, tier1_monthly: 500, tier2_max: 500_000, tier2_monthly: 1_000, pct_above: 0.03 },
  min_paying_price_net: 450,
  partial_min_months: 5,
  trial_enabled: false,
  trial_days: 14,
  pilot_default_days: 60,
  payment_details: EMPTY_PAYMENT_DETAILS,
};

// ── תאריכים ───────────────────────────────────────────────────────────────────
export type SchoolYear = { label: string; start: string; end: string; startYear: number };

/** שנת הלימודים שתאריך נופל בה: 1 בספטמבר עד 31 באוגוסט. */
export function schoolYearOf(dateIso: string): SchoolYear {
  const [y, m] = dateIso.split("-").map(Number);
  const startYear = m >= 9 ? y : y - 1;
  return {
    label: `${startYear}/${String(startYear + 1).slice(2)}`,
    start: `${startYear}-09-01`,
    end: `${startYear + 1}-08-31`,
    startYear,
  };
}

function addDays(dateIso: string, days: number): string {
  const d = new Date(dateIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** מספר החודשים הקלנדריים מתאריך עד סוף שנת הלימודים, חודש חלקי נחשב שלם (נספח ד'). */
export function monthsToYearEnd(dateIso: string): number {
  const [, m] = dateIso.split("-").map(Number);
  // ספטמבר = 12 חודשים, אוגוסט = 1.
  return m >= 9 ? 12 - (m - 9) : 12 - (m + 3);
}

export type LicensePlan = {
  kind: string;
  school_year: string;
  start_date: string;
  end_date: string;
  months: number | null;
  // רכישה בין 1 במאי ל-31 באוגוסט: רישיון לשנה הבאה במחיר מלא, גישה מיידית (נספח ד').
  next_year_purchase: boolean;
};

/** תאריכי הרישיון לפי סוגו ויום ההפעלה. */
export function planLicense(kind: string, activationIso: string, settings: BranchSettings = DEFAULT_BRANCH_SETTINGS): LicensePlan {
  const [, m] = activationIso.split("-").map(Number);
  if (kind === "pilot" || kind === "trial" || kind === "demo") {
    const days = kind === "trial" ? settings.trial_days : kind === "pilot" ? settings.pilot_default_days : 365;
    const sy = schoolYearOf(activationIso);
    return { kind, school_year: sy.label, start_date: activationIso, end_date: addDays(activationIso, days), months: null, next_year_purchase: false };
  }
  // מאי עד אוגוסט: הרישיון הוא לשנת הלימודים הבאה, והגישה מיידית.
  if (m >= 5 && m <= 8) {
    const sy = schoolYearOf(addDays(activationIso, 0).slice(0, 4) + "-09-01");
    return { kind: "annual", school_year: sy.label, start_date: activationIso, end_date: sy.end, months: 12, next_year_purchase: true };
  }
  const sy = schoolYearOf(activationIso);
  const months = monthsToYearEnd(activationIso);
  if (kind === "partial" || (kind === "annual" && months < 12)) {
    return { kind: "partial", school_year: sy.label, start_date: activationIso, end_date: sy.end, months, next_year_purchase: false };
  }
  return { kind, school_year: sy.label, start_date: activationIso, end_date: sy.end, months: 12, next_year_purchase: false };
}

// ── מחיר ותשלומים ─────────────────────────────────────────────────────────────
export function grossToNet(gross: number): number {
  return Math.round((gross / (1 + VAT_RATE)) * 100) / 100;
}

/** מחיר יחסי לרישיון חלקי: המחיר השנתי חלקי 12 לכל חודש (נספח ד'), אלא אם נעמה קבעה אחרת. */
export function partialPrice(annualGross: number, months: number): number {
  return Math.round(((annualGross * months) / 12) * 100) / 100;
}

export type ScheduledPayment = { seq: number; amount_gross: number; amount_net: number; due_date: string };

/**
 * לוח התשלומים של רישיון. "split_40_60" לפי ההסדר של משרד החינוך לכלים
 * דיגיטליים: 40% עם ההפעלה, השלמה ל-100% עד 28 בפברואר של שנת הלימודים.
 * רכישה אחרי 31 בדצמבר משולמת במלואה עם ההפעלה (מדריך גפ"ן תשפ"ו, עמ' 20).
 */
export function paymentSchedule(priceGross: number, scheduleKind: string, activationIso: string, schoolYear: SchoolYear): ScheduledPayment[] {
  const full = [{ seq: 1, amount_gross: priceGross, amount_net: grossToNet(priceGross), due_date: activationIso }];
  if (scheduleKind !== "split_40_60" || priceGross <= 0) return full;
  const [, m] = activationIso.split("-").map(Number);
  const afterDecember = m >= 1 && m <= 8 && schoolYearOf(activationIso).label === schoolYear.label;
  if (afterDecember) return full;
  const first = Math.round(priceGross * 0.4 * 100) / 100;
  const second = Math.round((priceGross - first) * 100) / 100;
  return [
    { seq: 1, amount_gross: first, amount_net: grossToNet(first), due_date: activationIso },
    { seq: 2, amount_gross: second, amount_net: grossToNet(second), due_date: `${schoolYear.startYear + 1}-02-28` },
  ];
}

/** המע"מ שבתוך מחיר כולל. */
export function vatOf(gross: number): number {
  return Math.round((gross - grossToNet(gross)) * 100) / 100;
}

/** התשלום הפתוח הבא של רישיון: הראשון לפי הסדר שעדיין צפוי. */
export function nextExpectedPayment<T extends { seq: number; status: string }>(payments: T[]): T | null {
  return [...payments].sort((a, b) => a.seq - b.seq).find((p) => p.status === "expected") ?? null;
}

/**
 * דף התשלום פתוח לרישיון שממתין לתשלום או פעיל (התשלום השני בלוח 40/60),
 * עד סוף הרישיון. רישיון שבוטל או פג אינו מקבל תשלומים.
 */
export function payPageOpen(l: { status: string; end_date: string }, todayIso: string): boolean {
  return (l.status === "pending_payment" || l.status === "active") && todayIso <= l.end_date;
}

/** שם הפריט בחשבונית של Sumit: סוג הרישיון, שנת הלימודים, ומספר התשלום כשיש יותר מאחד. */
export function licenseInvoiceItem(kind: string, schoolYear: string, seq: number, total: number): string {
  const base = `רישיון ${labelOf(LICENSE_KINDS, kind)} לשאלון היועצות, ${schoolYear}`;
  return `${total > 1 ? `${base}, תשלום ${seq} מתוך ${total}` : base} | טיפול חכם`;
}

// ── קוד גישה ──────────────────────────────────────────────────────────────────
// בלי 0/O/1/I כדי שאפשר יהיה להקריא אותו בטלפון. 8 תווים = 32^8 אפשרויות.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateAccessCode(random: (n: number) => Uint8Array = defaultRandom): string {
  const bytes = random(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

function defaultRandom(n: number): Uint8Array {
  const arr = new Uint8Array(n);
  globalThis.crypto.getRandomValues(arr);
  return arr;
}

/** מנרמל קוד שהוקלד: אותיות גדולות, בלי רווחים, עם המקף באמצע. */
export function normalizeAccessCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length !== 8) return null;
  for (const ch of raw) if (!CODE_ALPHABET.includes(ch)) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

// ── מצב רישיון ─────────────────────────────────────────────────────────────────
export type LicenseLike = {
  kind: string;
  status: string;
  start_date: string;
  end_date: string;
  price_net: number;
  months: number | null;
  paid_at: string | null;
  refunded_at: string | null;
  code_disabled: boolean;
};

/** האם הקוד של הרישיון פותח את השאלון היום. */
export function licenseUsable(l: LicenseLike, todayIso: string): boolean {
  if (l.status !== "active" || l.code_disabled) return false;
  return l.start_date <= todayIso && todayIso <= l.end_date;
}

/**
 * "בית ספר משלם" לפי נספח ב': רישיון שנתי או חלקי ששולם, במחיר של לפחות
 * המינימום לשנה בלי מע"מ (ברישיון חלקי, החלק היחסי לחודשים), ולא הוחזר תוך
 * 30 יום. בית ספר הדגמה, פיילוט, ניסיון והדרכה אינם נספרים.
 */
export function countsForGate(l: LicenseLike, settings: BranchSettings = DEFAULT_BRANCH_SETTINGS): boolean {
  if (!(l.kind === "annual" || l.kind === "partial")) return false;
  if (!l.paid_at) return false;
  if (l.refunded_at) {
    const days = (Date.parse(l.refunded_at) - Date.parse(l.paid_at)) / 86_400_000;
    if (days <= 30) return false;
  }
  const months = l.kind === "partial" && l.months ? l.months : 12;
  const floor = (settings.min_paying_price_net * months) / 12;
  return l.price_net >= floor - 0.005;
}

/** תקבול לצורך שער ב' בלבד: רישיון חלקי מומר לשנתי (נספח ב'). */
export function gateReceiptValue(amountNet: number, l: Pick<LicenseLike, "kind" | "months">): number {
  if (l.kind === "partial" && l.months && l.months > 0) return Math.round((amountNet * 12) / l.months);
  return amountNet;
}

/** דמי הפלטפורמה לחודש, לפי התקבולים נטו של הענף ב-12 החודשים שקדמו (סעיף 8.8). */
export function platformFeeForMonth(trailing12Receipts: number, settings: BranchSettings = DEFAULT_BRANCH_SETTINGS): number {
  const p = settings.platform_fee;
  if (trailing12Receipts <= p.tier1_max) return p.tier1_monthly;
  if (trailing12Receipts <= p.tier2_max) return p.tier2_monthly;
  return Math.round((trailing12Receipts * p.pct_above) / 12);
}
