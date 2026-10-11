import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";

// האחסון של תוכן הפניות הפרטיות (ראו private-inquiry.ts).
//
// זה הקובץ היחיד שנוגע בטבלה private_inquiries, ורק שלושה קבצים מייבאים אותו:
// שני הנתיבים שכותבים פנייה (contact-therapist, contact-center), ופורטל המרכז
// שקורא את ההודעות שהגיעו לתיבת המרכז. הבדיקה ב-private-inquiry.test.ts נכשלת
// אם קובץ אחר מייבא אותו או מזכיר את שם הטבלה - כלומר מסך אדמין חדש לא יכול
// להגיע לתוכן בלי שהבדיקות יצעקו.
//
// הטבלה לא ברשימת הגיבוי ל-Drive (backup-run.ts), בכוונה.

const TABLE = "private_inquiries";

export type PrivateInquiryContent = {
  sender_name: string;
  sender_contact: string;
  message: string;
};

/**
 * שומר את התוכן של פנייה לצד שורת הליד שלה. כישלון נרשם ללוג בלי התוכן עצמו,
 * ולא נזרק: ההודעה כבר נשלחה במייל לנמען, והשורה ב-crm_leads כבר נספרה.
 */
export async function savePrivateInquiry(leadId: string, content: PrivateInquiryContent): Promise<void> {
  const { error } = await supabaseAdmin.from(TABLE).insert({
    lead_id: leadId,
    sender_name: content.sender_name,
    sender_contact: content.sender_contact,
    message: content.message,
  });
  if (error) console.error("private inquiry content was not stored:", error.message);
}

/**
 * התוכן של הפניות שמזהיהן נמסרו, לפי lead_id. הקורא אחראי לוודא שהמזהים שייכים
 * למי שמבקש: פורטל המרכז מעביר רק שורות ש-received_by_center_id שלהן הוא המרכז
 * המחובר.
 */
export async function loadPrivateInquiries(leadIds: string[]): Promise<Map<string, PrivateInquiryContent>> {
  const out = new Map<string, PrivateInquiryContent>();
  if (leadIds.length === 0) return out;
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("lead_id, sender_name, sender_contact, message")
    .in("lead_id", leadIds);
  if (error) {
    console.error("private inquiry content could not be read:", error.message);
    return out;
  }
  for (const row of data ?? []) {
    out.set(row.lead_id as string, {
      sender_name: (row.sender_name as string | null) ?? "",
      sender_contact: (row.sender_contact as string | null) ?? "",
      message: (row.message as string | null) ?? "",
    });
  }
  return out;
}
