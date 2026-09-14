/**
 * Turning a stored phone number into a dialable / WhatsApp link.
 *
 * The stored value is whatever the therapist typed into a free-text field, and
 * it is not always a phone number. A paying therapist currently has
 * "ZJOURY@GMAIL.COM" in `phone`; the old inline logic (strip a leading zero,
 * strip dashes and spaces, require length >= 8) accepted it and produced
 * `https://wa.me/972ZJOURY@GMAIL.COM` plus `tel:ZJOURY@GMAIL.COM` - two dead
 * buttons on a profile someone is paying to have listed.
 *
 * These helpers validate that what is left really is a phone number, and return
 * null otherwise so the caller can hide the button instead of rendering a link
 * that goes nowhere.
 */

/** Israeli mobile/landline national numbers are 9-10 digits (e.g. 054-1234567). */
const MIN_NATIONAL_DIGITS = 9;
const MAX_NATIONAL_DIGITS = 10;

/**
 * Digits of a phone number in Israeli national form (leading 0 removed), or
 * null when the value is not a usable phone number.
 *
 * Accepts the shapes people actually type: 054-123-4567, (054) 1234567,
 * +972 54 123 4567, 972541234567.
 */
export function phoneNationalDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const raw = String(phone).trim();
  if (!raw) return null;

  // Anything that is not a digit or a separator means this is not a phone
  // number - an email, a note, a URL. Reject rather than mangle.
  if (!/^[0-9+()\-.\s]+$/.test(raw)) return null;

  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Normalise the country code to national form so callers can prefix 972 once.
  if (digits.startsWith("972")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);

  if (digits.length < MIN_NATIONAL_DIGITS - 1 || digits.length > MAX_NATIONAL_DIGITS) return null;
  return digits;
}

/** `tel:` href in international form, or null when the number is unusable. */
export function telHref(phone: string | null | undefined): string | null {
  const digits = phoneNationalDigits(phone);
  return digits ? `tel:+972${digits}` : null;
}

/** The prewritten opener so a patient never has to compose a message cold. */
export const WHATSAPP_MESSAGE =
  'שלום, הגעתי אלייך דרך אתר "טיפול חכם", אשמח לשמוע פרטים לגבי הטיפול';

/**
 * האם המספר הוא נייד ישראלי. בצורה הלאומית (בלי האפס המוביל) נייד מתחיל
 * תמיד ב-5; כל השאר קווי - 02/03/04/08/09 אזוריים, ו-072/073/077 VoIP.
 */
export function isMobileNumber(phone: string | null | undefined): boolean {
  const digits = phoneNationalDigits(phone);
  return !!digits && digits.startsWith("5");
}

/**
 * wa.me link with the prewritten message, or null when the number is unusable.
 *
 * **קווי מוחזר כ-null בכוונה (21/8/2026):** אין וואטסאפ למספר נייח, ולכן
 * הכפתור היה נפתח על שיחה ריקה. אצל מטפלים זה תיאורטי - כל 170 המוצגים
 * רשמו נייד - אבל מרכזים רושמים מרכזייה: עמוד "מרכז CBT" הציג כפתור
 * וואטסאפ אל 04-6157797, ומכון הכרה אל 077-8052051. הכפתור פשוט נעלם
 * עכשיו, וכפתור החיוג - שדווקא עובד - נשאר.
 */
export function waLinkFor(phone: string | null | undefined): string | null {
  const digits = phoneNationalDigits(phone);
  if (!digits || !digits.startsWith("5")) return null;
  return `https://wa.me/972${digits}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
}
