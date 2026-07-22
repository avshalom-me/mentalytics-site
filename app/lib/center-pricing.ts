// חישוב תמחור מרכז טיפולי — מקור אמת אחד ל"מחיר-למטפל × מספר-מטפלים" + מע"מ,
// בשימוש במייל ההצעה, במייל הברוכים-הבאים, בדף ההצטרפות ובאדמין. נקי מתלויות
// שרת כדי שאפשר לייבא מכל מקום (כולל client).

export const CENTER_VAT_RATE = 0.18;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type CenterPricing = {
  pricePerTherapist: number;
  therapistCount: number;
  perTherapistWithVat: number;
  monthlyTotal: number; // לפני מע"מ
  monthlyTotalWithVat: number;
  vatPct: number;
};

export function centerPricing(pricePerTherapist: number, therapistCount: number): CenterPricing {
  const perT = Number(pricePerTherapist) || 0;
  const count = Math.max(0, Math.floor(Number(therapistCount) || 0));
  const monthlyTotal = round2(perT * count);
  return {
    pricePerTherapist: perT,
    therapistCount: count,
    perTherapistWithVat: round2(perT * (1 + CENTER_VAT_RATE)),
    monthlyTotal,
    monthlyTotalWithVat: round2(monthlyTotal * (1 + CENTER_VAT_RATE)),
    vatPct: Math.round(CENTER_VAT_RATE * 100),
  };
}

// ── מסלול 2: מרכז כישות אחת — תמחור חודשי קבוע ─────────────────────────────
// אין "מחיר למטפל × מספר"; המרכז משלם סכום חודשי קבוע (עדיין 18% מע"מ, עקבי
// עם מסלול 1). מחזיר את אותו מבנה CenterPricing כדי שכל צרכני התמחור יעבדו.
export function centerEntityPricing(fixedMonthlyPrice: number): CenterPricing {
  const monthlyTotal = round2(Number(fixedMonthlyPrice) || 0);
  return {
    pricePerTherapist: monthlyTotal, // אין מחיר-למטפל נפרד — הסכום הוא הכולל
    therapistCount: 0,
    perTherapistWithVat: round2(monthlyTotal * (1 + CENTER_VAT_RATE)),
    monthlyTotal,
    monthlyTotalWithVat: round2(monthlyTotal * (1 + CENTER_VAT_RATE)),
    vatPct: Math.round(CENTER_VAT_RATE * 100),
  };
}

export type CenterBillingTrack = "per_therapist" | "center_entity";

// דיספצ'ר לפי מסלול — מקור האמת היחיד לסכום החודשי של מרכז כלשהו. מקבל את
// שדות המרכז ובוחר בין מסלול 1 (מחיר×מספר) למסלול 2 (מחיר קבוע).
export function centerMonthlyPricing(input: {
  billing_track?: string | null;
  price_per_therapist?: number | string | null;
  therapist_count?: number | string | null;
  fixed_monthly_price?: number | string | null;
}): CenterPricing {
  if (input.billing_track === "center_entity") {
    return centerEntityPricing(Number(input.fixed_monthly_price) || 0);
  }
  return centerPricing(Number(input.price_per_therapist) || 0, Number(input.therapist_count) || 0);
}

// "1,200" בפורמט ישראלי, בלי מקומות עשרוניים מיותרים.
export function ilCurrency(n: number): string {
  return Number(n).toLocaleString("he-IL", { maximumFractionDigits: 2 });
}
