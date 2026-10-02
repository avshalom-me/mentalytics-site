import "server-only";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { sendTeacherPersonalLinkEmail } from "@/app/lib/teacher-emails";

/** כמה זמן בין שליחה לשליחה של הקישור האישי לאותו מורה. */
export const LINK_RESEND_HOURS = 24;

export type LinkTarget = { id: string; email: string; full_name: string; edit_token: string; link_sent_at: string | null };

/**
 * שולח את הקישור האישי למורה קיים/ת, לכתובת הרשומה בלבד, ולכל היותר פעם
 * ב-24 שעות. זו הדרך היחידה לקבל את הקישור מחדש: הטוקן לא חוזר בשום
 * תשובת API, כדי שמי שיודע מייל של מורה לא יקבל שליטה בפרופיל.
 */
export async function resendPersonalLink(teacher: LinkTarget): Promise<boolean> {
  const cutoff = new Date(Date.now() - LINK_RESEND_HOURS * 3_600_000).toISOString();
  if (teacher.link_sent_at && teacher.link_sent_at > cutoff) return false;
  // חותמים לפני השליחה: שתי בקשות במקביל לא ישלחו שני מיילים.
  const { data: claimed } = await supabaseAdmin
    .from("teachers")
    .update({ link_sent_at: new Date().toISOString() })
    .eq("id", teacher.id)
    .or(`link_sent_at.is.null,link_sent_at.lt.${cutoff}`)
    .select("id")
    .maybeSingle();
  if (!claimed) return false;
  const r = await sendTeacherPersonalLinkEmail(teacher);
  return r.status === "sent";
}
