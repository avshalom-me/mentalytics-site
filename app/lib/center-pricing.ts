// חישוב תמחור מרכז טיפולי - מקור אמת אחד לסכום החודשי, בשימוש במייל ההצעה,
// במייל הברוכים-הבאים, בדף ההצטרפות ובאדמין. נקי מתלויות שרת (גם client).
//
// נוסחה:  בסיס × מספר-מיקומים − הנחה  (ואז + מע"מ)
//   מסלול 1 (per_therapist): בסיס = מחיר-למטפל × מספר-מטפלים
//   מסלול 2 (center_entity): בסיס = מחיר חודשי קבוע
//   num_locations  - מכפיל (סניפים/מיקומים), ברירת מחדל 1
//   discount_amount - הנחה בסכום קבוע (₪) לחודש, נגזרת מהסכום שאחרי המיקומים
// חודשי המתנה (gift_months) אינם חלק מהסכום - הם רק דוחים את החיוב הראשון.

export const CENTER_VAT_RATE = 0.18;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type CenterPricing = {
  pricePerTherapist: number;
  therapistCount: number;
  numLocations: number;
  baseTotal: number;      // בסיס × מיקומים, לפני הנחה ולפני מע"מ
  discountAmount: number; // ההנחה שהוחלה בפועל (₪, לא יורדת מתחת ל-0)
  monthlyTotal: number;   // הסכום החודשי לתשלום, לפני מע"מ
  perTherapistWithVat: number;
  monthlyTotalWithVat: number;
  vatPct: number;
};

// מרכיב את מבנה התמחור מ: בסיס חודשי, מספר מיקומים, והנחה.
function assemble(base: number, numLocations: number | string, discountAmount: number | string, perT: number, count: number): CenterPricing {
  const loc = Math.max(1, Math.floor(Number(numLocations) || 1));
  const disc = Math.max(0, round2(Number(discountAmount) || 0));
  const baseTotal = round2((Number(base) || 0) * loc);
  const applied = Math.min(disc, baseTotal); // אף פעם לא מתחת ל-0
  const monthlyTotal = round2(baseTotal - applied);
  return {
    pricePerTherapist: Number(perT) || 0,
    therapistCount: Math.max(0, Math.floor(Number(count) || 0)),
    numLocations: loc,
    baseTotal,
    discountAmount: applied,
    monthlyTotal,
    perTherapistWithVat: round2((Number(perT) || 0) * (1 + CENTER_VAT_RATE)),
    monthlyTotalWithVat: round2(monthlyTotal * (1 + CENTER_VAT_RATE)),
    vatPct: Math.round(CENTER_VAT_RATE * 100),
  };
}

// מסלול 1 - בסיס בלבד (מחיר-למטפל × מספר), בלי מיקומים/הנחה. לחישוב הבסיס.
export function centerPricing(pricePerTherapist: number, therapistCount: number): CenterPricing {
  const perT = Number(pricePerTherapist) || 0;
  const count = Math.max(0, Math.floor(Number(therapistCount) || 0));
  return assemble(perT * count, 1, 0, perT, count);
}

// מסלול 2 - מרכז כישות אחת, מחיר חודשי קבוע (בסיס בלבד).
export function centerEntityPricing(fixedMonthlyPrice: number): CenterPricing {
  const fixed = round2(Number(fixedMonthlyPrice) || 0);
  return assemble(fixed, 1, 0, fixed, 0);
}

export type CenterBillingTrack = "per_therapist" | "center_entity";

// דיספצ'ר - מקור האמת היחיד לסכום החודשי הסופי של מרכז, כולל מיקומים והנחה.
export function centerMonthlyPricing(input: {
  billing_track?: string | null;
  price_per_therapist?: number | string | null;
  therapist_count?: number | string | null;
  fixed_monthly_price?: number | string | null;
  num_locations?: number | string | null;
  discount_amount?: number | string | null;
}): CenterPricing {
  const isEntity = input.billing_track === "center_entity";
  const perT = isEntity ? 0 : (Number(input.price_per_therapist) || 0);
  const count = isEntity ? 0 : Math.max(0, Math.floor(Number(input.therapist_count) || 0));
  const base = isEntity ? round2(Number(input.fixed_monthly_price) || 0) : round2(perT * count);
  const ppDisplay = isEntity ? base : perT; // לישות אין מחיר-למטפל נפרד - משקף את הבסיס
  return assemble(base, input.num_locations ?? 1, input.discount_amount ?? 0, ppDisplay, count);
}

// "1,200" בפורמט ישראלי, בלי מקומות עשרוניים מיותרים.
export function ilCurrency(n: number): string {
  return Number(n).toLocaleString("he-IL", { maximumFractionDigits: 2 });
}
