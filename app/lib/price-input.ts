/**
 * "מחיר למפגש" as a therapist types it, turned into the number the database
 * stores - or a message saying why it cannot be.
 *
 * The three forms used to strip everything that is not a digit while typing, so
 * "300-400" became 300400 and "350.00" became 35000. The therapist's own editor
 * then sent that to a server that silently stored NULL for anything outside
 * 50-5000: the save "worked" and the price was gone (a free therapist reported
 * on 25/9/2026 that the price could not be changed). The centre forms stored the
 * garbage instead. One parser for all of them, used both in the form - to show
 * the problem while typing - and on the server, which refuses rather than drops.
 */

export const PRICE_MIN = 50;
export const PRICE_MAX = 5000;

export type PriceParse = { ok: true; value: number | null } | { ok: false; error: string };

export function parsePriceInput(raw: unknown): PriceParse {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw === "number") return checkRange(raw);
  if (typeof raw !== "string") return { ok: false, error: "נא לרשום את המחיר במספרים, למשל 400" };

  // What people add around the number: the currency, and thousands commas.
  const s = raw
    .replace(/₪|ש["״']?ח|nis|ils/gi, "")
    .replace(/[\s,]/g, "");
  if (!s) return { ok: true, value: null };

  if (/^\d+(\.\d+)?$/.test(s)) return checkRange(Number(s));
  if (/^\d+(\.\d+)?[-–—/]\d+(\.\d+)?$/.test(s)) {
    return { ok: false, error: "נא לרשום מחיר אחד ולא טווח, למשל 400" };
  }
  return { ok: false, error: "נא לרשום את המחיר במספרים, למשל 400" };
}

function checkRange(n: number): PriceParse {
  if (!Number.isFinite(n)) return { ok: false, error: "נא לרשום את המחיר במספרים, למשל 400" };
  const rounded = Math.round(n);
  if (rounded < PRICE_MIN || rounded > PRICE_MAX) {
    return { ok: false, error: `המחיר צריך להיות בין ${PRICE_MIN} ל-${PRICE_MAX.toLocaleString("en-US")} ₪ למפגש` };
  }
  return { ok: true, value: rounded };
}

/**
 * Server side: parse `update.price` in place. Returns the message to send back
 * (400) when the value is not one price in range, or null when it is fine or
 * absent. Shared by every route that writes a therapist's price.
 */
export function normalizePriceField(update: Record<string, unknown>): string | null {
  if (!("price" in update)) return null;
  const parsed = parsePriceInput(update.price);
  if (!parsed.ok) return `מחיר למפגש: ${parsed.error}`;
  update.price = parsed.value;
  return null;
}
