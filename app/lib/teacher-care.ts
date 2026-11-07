// "טיפול בפרופילים" של ענף המורים: מה חסר בפרופיל, מה דורש בירור, ואילו
// טיוטות מייל להכין לבעלים. מודול טהור (בלי מסד, בלי שליחה), כדי שאפשר
// יהיה לבדוק את הכללים ולהציג אותם באדמין ובעמוד האישי של המורה בדיוק
// כפי שהקרון מפעיל אותם.
//
// מה הבעלים אישר ב-6/11/2026 ("מאשר את הכללים"):
//   1. הוראה מתקנת בלי תעודה: המורה מסומן/ת הוראה מתקנת ואין תעודה, או שהביו
//      או המוסד מזכירים הוראה מתקנת / חינוך מיוחד / לקויות למידה בעוד שההכשרה
//      הרשומה אינה אחת משלוש ההכשרות שמחייבות תעודה → טיוטת בקשת תעודה.
//   2. אין תמונה שבעה ימים אחרי האישור → טיוטת בקשת תמונה.
//   3. פרופיל דל (אין מחיר, ביו קצר, אין מוקדי הוראה, אין "ניסיון עם") →
//      טיוטה אחת שמונה את כל מה שחסר. כשחסרה גם תמונה היא נכנסת לאותה
//      טיוטה, במקום שני מיילים.
//   4. ממתין/ה לאישור יותר משלושה ימים → לתשומת לב הבעלים, בלי מייל.
//   5. חשיפות בלי פניות (60 יום, 20 חשיפות, אפס פניות) → לתשומת לב הבעלים.
//   6. "הקישור האישי לא נפתח מעולם" ממתין: אין עמודה שרושמת כניסה של מורה,
//      ובלי מיגרציה אי אפשר לדעת. לא מומש.
//   7. המורים הראשונים (12 הראשונים שאושרו, foundingIds): במקום הטיוטות של 1
//      עד 3 הם מקבלים מייל אחד (founding_note) עם ברכה, מה שחסר, בקשה להעביר
//      את דף ההצטרפות לעמיתים ובקשה למשוב. פעם אחת לכל מורה, יום אחרי האישור.
//      מתוכנית השדרוג (6/11/2026, שלב 1: "מייל אישי לארבעת הראשונים").
//
// שום טיוטה לא נשלחת לבד: הקרון כותב אותה לתור (agent_actions, סוכן
// teacher_care), והבעלים שולח מהאדמין בלחיצה. מורה מקבל/ת לכל היותר מייל
// טיפול אחד ב-21 יום, גם אם חסרים כמה דברים.

import { qualificationNeedsCertificate } from "./teacher-options";
import { careDraft, type CareDraftKind, CARE_TEMPLATES } from "./teacher-email-templates";

export type CareTeacher = {
  id: string;
  full_name: string;
  /** "זכר" / "נקבה" / null, כפי שסומן בהרשמה. לברכה במייל למורים הראשונים. */
  gender?: string | null;
  listing_state: string;
  created_at: string;
  approved_at: string | null;
  remedial: boolean;
  qualification: string | null;
  institution: string | null;
  bio: string | null;
  price_text: string | null;
  focuses: string[] | null;
  expertise: string[] | null;
  has_certificate: boolean;
  has_photo: boolean;
};

export type CareStats = { impressions_total: number; contacts_total: number };

export const BIO_MIN_CHARS = 200;
export const PHOTO_WAIT_DAYS = 7;
export const COMPLETION_WAIT_DAYS = 7;
export const PENDING_STALE_DAYS = 3;
export const NO_CONTACT_DAYS = 60;
export const NO_CONTACT_MIN_IMPRESSIONS = 20;
export const CARE_COOLDOWN_DAYS = 21;
/** כמה מורים ראשונים (לפי סדר האישור) מקבלים את המייל למורים הראשונים. */
export const FOUNDING_TEACHERS = 12;
/** ימים מהאישור עד המייל למורים הראשונים, כדי שלא יגיע יחד עם מייל האישור. */
export const FOUNDING_MIN_DAYS = 1;

const LISTED = new Set(["trial", "paying"]);
const DAY = 86_400_000;

// ── מה חסר בפרופיל ──────────────────────────────────────────────────────

export type MissingKey = "certificate" | "photo" | "price" | "bio" | "focuses" | "expertise";

/** התווית כפי שהיא מופיעה למורה ולבעלים, ולמה זה חשוב להורה. */
export const MISSING_ITEMS: Record<MissingKey, { label: string; why: string }> = {
  certificate: { label: "תעודה", why: "ההכשרה שסימנת מחייבת תעודה, ואחרי שבדקנו אותה הפרופיל מקבל את הסימון \"תעודה נבדקה\"" },
  photo: { label: "תמונת פרופיל", why: "הורים נוטים לפנות ביתר ביטחון למורה שהם רואים, ופרופילים ללא תמונה מקבלים מעט מאוד פניות" },
  price: { label: "מחיר לשיעור", why: "הורים משווים מחיר לפני שהם פונים; מספיק לציין טווח" },
  bio: { label: `כמה משפטים עליך (לפחות ${BIO_MIN_CHARS} תווים)`, why: "איך נראה שיעור אצלך ועם מי עבדת" },
  focuses: { label: "מוקדי הוראה", why: "מה בדיוק בתוך התחום: שטף קריאה, הבנת הנקרא, יסודות החשבון" },
  expertise: { label: "ניסיון עם קשיים", why: "קשב, דיסלקסיה, התארגנות ועוד: הורה שמסמן קושי כזה רואה קודם מורים שציינו אותו" },
};

/** הפריטים שחסרים, בסדר שבו נבקש אותם. תעודה רק למי שההכשרה שלו/ה מחייבת. */
export function teacherMissingItems(t: CareTeacher): MissingKey[] {
  const out: MissingKey[] = [];
  if (qualificationNeedsCertificate(t.qualification) && !t.has_certificate) out.push("certificate");
  if (!t.has_photo) out.push("photo");
  if (!(t.price_text ?? "").trim()) out.push("price");
  if ((t.bio ?? "").trim().length < BIO_MIN_CHARS) out.push("bio");
  if (!(t.focuses ?? []).length) out.push("focuses");
  if (!(t.expertise ?? []).length) out.push("expertise");
  return out;
}

/** "4 מתוך 6": כמה מהפריטים כבר יש. התעודה נספרת רק כשהיא נדרשת. */
export function profileCompleteness(t: CareTeacher): { done: number; total: number; missing: MissingKey[] } {
  const missing = teacherMissingItems(t);
  const total = qualificationNeedsCertificate(t.qualification) ? 6 : 5;
  return { done: total - missing.length, total, missing };
}

// ── הוראה מתקנת בלי תעודה ────────────────────────────────────────────────

/** מילים שאומרות "הוראה מתקנת" גם כשהמורה לא סימן/ה אותה בטופס. */
export const REMEDIAL_HINT_RE = /הוראה (?:מתקנת|מותאמת)|חינוך מיוחד|לקויו?ת למידה|ליקויי למידה|מאבחנ/;

/**
 * marked: מסומן/ת הוראה מתקנת ואין תעודה (אפשרי רק דרך שינוי באדמין, הטופס חוסם).
 * hinted: ההכשרה הרשומה אינה מחייבת תעודה, אבל הטקסט החופשי מספר על הוראה מתקנת.
 */
export function remedialHint(t: CareTeacher): "marked" | "hinted" | null {
  if (t.remedial && !t.has_certificate) return "marked";
  if (!qualificationNeedsCertificate(t.qualification) && REMEDIAL_HINT_RE.test(`${t.bio ?? ""} ${t.institution ?? ""}`)) return "hinted";
  return null;
}

// ── הממצאים ──────────────────────────────────────────────────────────────

export type CareKind = CareDraftKind | "pending_stale" | "no_contacts";

export type CareFinding = {
  teacherId: string;
  kind: CareKind;
  severity: "high" | "normal" | "low";
  /** משפט אחד לרשימת "דורש טיפול". */
  title: string;
  dedupeKey: string;
  /** טיוטת המייל, כשהממצא הוא מייל. הבעלים עורך ושולח. */
  draft?: { template: string; subject: string; body: string };
};

export const careDedupeKey = (teacherId: string, kind: CareKind) => `teacher:${teacherId}:${kind}`;

/** אם נשלח מייל טיפול כלשהו ב-21 הימים האחרונים, לא מכינים עוד אחד. */
export function careCooldownActive(lastSent: Record<string, string> | undefined, now: Date): boolean {
  if (!lastSent) return false;
  const since = now.getTime() - CARE_COOLDOWN_DAYS * DAY;
  return Object.values(CARE_TEMPLATES).some((tpl) => {
    const iso = lastSent[tpl];
    return !!iso && new Date(iso).getTime() > since;
  });
}

export function careFindings(input: {
  teachers: CareTeacher[];
  stats: Record<string, CareStats>;
  /** לכל מורה: תבנית → מתי נשלחה לאחרונה (מ-crm_email_log). */
  lastSent: Record<string, Record<string, string>>;
  /** המורים הראשונים שאושרו (FOUNDING_TEACHERS), כפי שהשרת מחשב מכל המורים. */
  foundingIds?: ReadonlySet<string>;
  now?: Date;
}): CareFinding[] {
  const now = input.now ?? new Date();
  const out: CareFinding[] = [];
  const daysSince = (iso: string | null) => (iso ? (now.getTime() - new Date(iso).getTime()) / DAY : 0);

  for (const t of input.teachers) {
    const listed = LISTED.has(t.listing_state);

    if (t.listing_state === "pending" && daysSince(t.created_at) >= PENDING_STALE_DAYS) {
      out.push({
        teacherId: t.id,
        kind: "pending_stale",
        severity: "high",
        title: `${t.full_name} ממתין/ה לאישור ${Math.floor(daysSince(t.created_at))} ימים`,
        dedupeKey: careDedupeKey(t.id, "pending_stale"),
      });
    }

    if (!listed) continue;

    const s = input.stats[t.id];
    if (s && t.approved_at && daysSince(t.approved_at) >= NO_CONTACT_DAYS && s.impressions_total >= NO_CONTACT_MIN_IMPRESSIONS && s.contacts_total === 0) {
      out.push({
        teacherId: t.id,
        kind: "no_contacts",
        severity: "low",
        title: `${t.full_name}: ${s.impressions_total} חשיפות ואפס פניות. כדאי לבדוק את הפרופיל (תמונה, מחיר, ביו)`,
        dedupeKey: careDedupeKey(t.id, "no_contacts"),
      });
    }

    if (careCooldownActive(input.lastSent[t.id], now)) continue;

    const hint = remedialHint(t);

    // המורים הראשונים: מייל אחד שמאחד את כל מה שהכללים 1 עד 3 היו מבקשים.
    if (input.foundingIds?.has(t.id) && !input.lastSent[t.id]?.[CARE_TEMPLATES.founding_note]) {
      if (!t.approved_at || daysSince(t.approved_at) < FOUNDING_MIN_DAYS) continue;
      const missing = teacherMissingItems(t).filter((k) => k !== "certificate");
      const d = careDraft("founding_note", t, { mode: hint ?? undefined, missing: missing.map((k) => MISSING_ITEMS[k]) });
      const what = [hint ? "תעודה" : "", ...missing.map((k) => MISSING_ITEMS[k].label.split(" (")[0])].filter(Boolean);
      out.push({
        teacherId: t.id,
        kind: "founding_note",
        severity: hint ? "high" : "normal",
        title: `${t.full_name}: מייל למורים הראשונים${what.length ? ` (חסרים ${what.join(", ")})` : " (הפרופיל מלא)"}`,
        dedupeKey: careDedupeKey(t.id, "founding_note"),
        draft: { template: CARE_TEMPLATES.founding_note, ...d },
      });
      continue;
    }

    if (hint) {
      const d = careDraft("certificate_request", t, { mode: hint });
      out.push({
        teacherId: t.id,
        kind: "certificate_request",
        severity: "high",
        title: hint === "marked" ? `${t.full_name} מסומן/ת הוראה מתקנת בלי תעודה` : `${t.full_name} כותב/ת על הוראה מתקנת אבל רשום/ה כמורה פרטי/ת, בלי תעודה`,
        dedupeKey: careDedupeKey(t.id, "certificate_request"),
        draft: { template: CARE_TEMPLATES.certificate_request, ...d },
      });
    }

    // תמונה ושאר ההשלמות נבקשות רק אחרי שבוע, כדי לתת למורה להשלים לבד.
    if (!t.approved_at || daysSince(t.approved_at) < Math.min(PHOTO_WAIT_DAYS, COMPLETION_WAIT_DAYS)) continue;
    const missing = teacherMissingItems(t).filter((k) => k !== "certificate");
    if (missing.length === 0) continue;
    if (missing.length === 1 && missing[0] === "photo") {
      const d = careDraft("photo_request", t, {});
      out.push({
        teacherId: t.id,
        kind: "photo_request",
        severity: "normal",
        title: `${t.full_name} מוצג/ת בלי תמונה`,
        dedupeKey: careDedupeKey(t.id, "photo_request"),
        draft: { template: CARE_TEMPLATES.photo_request, ...d },
      });
    } else {
      const d = careDraft("profile_completion", t, { missing: missing.map((k) => MISSING_ITEMS[k]) });
      out.push({
        teacherId: t.id,
        kind: "profile_completion",
        severity: "normal",
        title: `${t.full_name}: חסרים ${missing.map((k) => MISSING_ITEMS[k].label.split(" (")[0]).join(", ")}`,
        dedupeKey: careDedupeKey(t.id, "profile_completion"),
        draft: { template: CARE_TEMPLATES.profile_completion, ...d },
      });
    }
  }
  return out;
}
