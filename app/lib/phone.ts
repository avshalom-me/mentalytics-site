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

  // "00" is the international dialling prefix typed instead of "+" (00972...).
  // Without this the leading-zero branch below ate one zero and left 13 digits.
  if (digits.startsWith("00")) digits = digits.slice(2);

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
 * ספרות מספר זר בצורה בינלאומית (קידומת מדינה בלי "+"), או null.
 *
 * מטפל/ת שגר/ה בחו"ל ועובד/ת אונליין רושם/ת מספר מקומי שם - לטם סבוראי עם
 * +39 (איטליה). phoneNationalDigits מכיר רק מספרים ישראליים, ולכן מ-1/8/2026
 * שני הכפתורים שלה נעלמו (ולפני כן הקוד הדביק 972 מקדימה ויצר wa.me/972+39...
 * - קישור מת). היא נשארה שבעה שבועות משלמת בלי שום כפתור וואטסאפ.
 *
 * מזהים מספר זר רק לפי קידומת מפורשת ("+" או "00") שאינה 972. בלי קידומת
 * המספר נחשב ישראלי, כדי לא לפרש בטעות נייד ישראלי שנרשם בלי 0 כמספר זר.
 * האורך לפי E.164: 8-15 ספרות כולל קידומת המדינה.
 */
export function foreignPhoneDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const raw = String(phone).trim();
  if (!/^[0-9+()\-.\s]+$/.test(raw)) return null;
  if (!raw.startsWith("+") && !raw.startsWith("00")) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("972")) return null; // ישראלי - המסלול הרגיל
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/**
 * wa.me link with the prewritten message, or null when the number is unusable.
 *
 * **קווי מוחזר כ-null בכוונה (21/8/2026):** אין וואטסאפ למספר נייח, ולכן
 * הכפתור היה נפתח על שיחה ריקה. אצל מטפלים זה תיאורטי - כל 170 המוצגים
 * רשמו נייד - אבל מרכזים רושמים מרכזייה: עמוד "מרכז CBT" הציג כפתור
 * וואטסאפ אל 04-6157797, ומכון הכרה אל 077-8052051. הכפתור פשוט נעלם
 * עכשיו, וכפתור החיוג - שדווקא עובד - נשאר.
 *
 * **מספר זר (21/9/2026)** מקבל קישור וואטסאפ, כי זה הערוץ שמטפל/ת בחו"ל
 * באמת עונה בו, והוא חינמי למטופל. אין לנו דרך לדעת אם מספר זר הוא נייד,
 * ומי שרשם/ה מספר זר כקו הקשר היחיד שלו/ה כמעט תמיד רשם/ה נייד. telHref
 * נשאר ישראלי בלבד בכוונה: שיחה בינלאומית עולה למטופל כסף, ולכן אין כפתור
 * חיוג למספר זר.
 */
export function waLinkFor(phone: string | null | undefined): string | null {
  const digits = phoneNationalDigits(phone);
  if (digits && digits.startsWith("5")) {
    return `https://wa.me/972${digits}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
  }
  const foreign = foreignPhoneDigits(phone);
  if (foreign) return `https://wa.me/${foreign}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
  return null;
}

// ── מרכזים ───────────────────────────────────────────────────────────────────

/** נוסח הפתיחה לוואטסאפ של מרכז - ברבים, כי הנמען הוא צוות ולא אדם. */
export const CENTER_WHATSAPP_MESSAGE =
  'שלום, הגעתי אליכם דרך אתר "טיפול חכם", אשמח לשמוע פרטים לגבי טיפול במרכז';

/**
 * המספר שכפתור הוואטסאפ של מרכז מוביל אליו, או null כשאין כזה.
 *
 * למרכז שני שדות ציבוריים: public_whatsapp (וואטסאפ עסקי, נייד) ו-public_phone
 * (טלפון לחיוג, לרוב מרכזייה). עד 15/9/2026 היה רק השני, והוואטסאפ נגזר ממנו
 * אם במקרה היה נייד. הסדר כאן שומר על זה: השדה המפורש קודם, ובלעדיו - הטלפון
 * לחיוג אם הוא נייד. כך מרכז שרשם נייד בשדה הישן לא מאבד את הכפתור, ומרכז
 * עם מרכזייה יכול סוף סוף להציג וואטסאפ בלי לוותר על קו החיוג.
 *
 * מחזיר את המספר כפי שנשמר (לא מנורמל) - הקישור עצמו נבנה ב-waLinkForCenter.
 */
export function centerWhatsAppNumber(
  publicWhatsapp: string | null | undefined,
  publicPhone: string | null | undefined,
): string | null {
  if (isMobileNumber(publicWhatsapp)) return String(publicWhatsapp).trim();
  if (isMobileNumber(publicPhone)) return String(publicPhone).trim();
  return null;
}

/** קישור wa.me למרכז - כמו waLinkFor, עם נוסח הפתיחה ברבים. */
export function waLinkForCenter(phone: string | null | undefined): string | null {
  const digits = phoneNationalDigits(phone);
  if (!digits || !digits.startsWith("5")) return null;
  return `https://wa.me/972${digits}?text=${encodeURIComponent(CENTER_WHATSAPP_MESSAGE)}`;
}

/**
 * אימות לשמירת וואטסאפ עסקי, משותף לפורטל ולאדמין. ריק = מחיקה (null).
 * כל דבר שאינו נייד ישראלי נדחה עם הסבר, במקום להישמר ולייצר כפתור שפותח
 * שיחה ריקה - התקלה שהייתה בעמוד "מרכז CBT" עם 04-6157797 עד 21/8/2026.
 */
export function validateCenterWhatsApp(
  raw: unknown,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const v = typeof raw === "string" ? raw.trim().slice(0, 40) : "";
  if (!v) return { ok: true, value: null };
  if (!phoneNationalDigits(v)) return { ok: false, error: "וואטסאפ עסקי: זה לא נראה כמו מספר טלפון" };
  if (!isMobileNumber(v)) {
    return { ok: false, error: "וואטסאפ עסקי חייב להיות מספר נייד ישראלי (מתחיל ב-05). לקו נייח או וירטואלי אין וואטסאפ" };
  }
  return { ok: true, value: v };
}
