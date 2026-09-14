import { therapistPath } from "@/app/lib/therapist-url";
import { publicTherapistTitle } from "@/app/lib/gender-text";
import type { PublicTherapist } from "@/app/therapists/TherapistsClient";

const BASE = "https://www.mentalytics.co.il";

/**
 * צומת ItemList לכרטיס אחד בעמוד רשימה (מאגר, עיר, אזור, התמחות...).
 *
 * קיים כפונקציה משותפת בגלל ישות-מרכז: שישה עמודי רשימה בנו כל אחד לעצמו
 * `{"@type":"Person", url: therapistPath(...)}`, וברגע שישויות-מרכז נכנסו
 * למאגר (12/8/2026) כל אחד מהם הצהיר על מרכז כאדם - עם כתובת שמחזירה 404
 * במכוון (app/therapists/[id]/page.tsx חוסם ישויות). סכמה שמפנה לעמוד שבור
 * גרועה מהיעדר סכמה: גוגל מאמתת את הכתובות.
 *
 * MedicalOrganization נבחר כדי להתאים לסכמה של עמוד המרכז עצמו, כך ששתי
 * ההצהרות מתארות את אותה ישות ולא שני דברים שונים.
 */
export function listingItemSchema(t: PublicTherapist) {
  if (t.is_center) {
    return {
      "@type": "MedicalOrganization",
      name: t.full_name,
      // בלי slug אין עמוד ציבורי לקשר אליו - עדיף צומת בלי url מאשר url שבור.
      ...(t.center_slug ? { url: `${BASE}/centers/${t.center_slug}` } : {}),
    };
  }
  return {
    "@type": "Person",
    name: t.full_name,
    jobTitle: t.therapist_types[0]
      ? publicTherapistTitle(t.therapist_types[0], t.gender, t.age_groups)
      : undefined,
    url: `${BASE}${therapistPath(t.id, t.full_name)}`,
  };
}
