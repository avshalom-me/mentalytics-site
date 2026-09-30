import { GUARANTEE_DAYS } from "./crm";

// חלון ערבות הפניות של מטפל/ת משלם/ת - החישוב הטהור, בלי גישה למסד.
//
// יושב בנפרד מ-guarantee.ts כדי שכל מי שצריך את החלון יחשב אותו אותו דבר:
// מעקב הערבות באדמין (computeGuarantee) והבדיקה לפני הקפאה מההתאמות
// (guaranteeStateFor). ההסבר המלא לכלל העוגן - "המוקדם מבין תחילת הקידום
// ותחילת המנוי", ולמה - בראש guarantee.ts.

export type GuaranteeSubscription = { status: string | null; created_at: string };

export type GuaranteeWindow = {
  start: Date;
  end: Date;
  /** הקידום נקטע ונפתח מחדש (כשל חיוב טכני, בדרך כלל); החלון נמדד מהמנוי המקורי. */
  interrupted: boolean;
};

// פער של פחות משעה בין המנוי לקידום הוא הרצף הרגיל של הרשמה אחת
// (שתי הכתיבות קורות באותו מסלול) - לא הפסקה שראוי לסמן.
const INTERRUPTION_MIN_MS = 60 * 60 * 1000;

export function guaranteeWindow(
  t: { promoted_since: string | null; created_at: string },
  subs: GuaranteeSubscription[],
): GuaranteeWindow {
  // המנוי המוקדם ביותר = ההרשמה המקורית, גם אם יש שורה מאוחרת יותר אחרי
  // ביטול והרשמה מחדש. המנוי הפעיל קודם: הוא לא מתאפס בהשעיה.
  let firstSub: string | null = null;
  let firstActiveSub: string | null = null;
  for (const s of subs) {
    if (!firstSub || s.created_at < firstSub) firstSub = s.created_at;
    if (s.status === "active" && (!firstActiveSub || s.created_at < firstActiveSub)) {
      firstActiveSub = s.created_at;
    }
  }
  const subStart = firstActiveSub ?? firstSub;
  const candidates = [t.promoted_since, subStart].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  const startIso = candidates.length > 0 ? candidates.reduce((a, b) => (a < b ? a : b)) : t.created_at;
  const start = new Date(startIso);
  const end = new Date(start.getTime() + GUARANTEE_DAYS * 24 * 60 * 60 * 1000);
  const interrupted =
    !!t.promoted_since && new Date(t.promoted_since).getTime() - start.getTime() > INTERRUPTION_MIN_MS;
  return { start, end, interrupted };
}
