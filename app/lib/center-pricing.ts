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

// "1,200" בפורמט ישראלי, בלי מקומות עשרוניים מיותרים.
export function ilCurrency(n: number): string {
  return Number(n).toLocaleString("he-IL", { maximumFractionDigits: 2 });
}
