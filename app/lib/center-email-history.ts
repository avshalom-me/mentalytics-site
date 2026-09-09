import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";

// היסטוריית התכתבות מול מרכזים, לפי מרכז.
//
// למה זה לא טריוויאלי: crm_email_log נכתב עם כתובת הנמען, ועד 9/9/26 בלי
// entity_id - כלומר "מה נשלח למרכז הזה" לא היה שאילתה שאפשר לשאול. הקישור
// למרכז נוסף מכאן והלאה; השורות הישנות מותאמות לפי כתובת המייל, שהיא
// חד-משמעית היום (אין שני מרכזים פעילים שחולקים כתובת).

const CENTER_TEMPLATES = [
  "center_proposal",
  "center_welcome",
  "center_readiness_nudge",
  "center_completeness_nudge",
  "center_therapist_invite",
  "center_invite_reminder",
];

// שמות קריאים, כי "center_readiness_nudge" לא אומר כלום למי שקורא.
const TEMPLATE_LABELS: Record<string, string> = {
  center_proposal: "הצעת מחיר",
  center_welcome: "ברוכים הבאים",
  center_readiness_nudge: "נדנוד השלמת פרטים (מהסוכן)",
  center_completeness_nudge: "נדנוד השלמה (גרסה ישנה)",
  center_therapist_invite: "הזמנת מטפל להצטרף",
  center_invite_reminder: "תזכורת להזמנת מטפלים",
};

export type CenterEmailRow = {
  template: string;
  templateLabel: string;
  subject: string | null;
  sentAt: string;
  status: string;
  fromAgent: boolean;
};

export type CenterHistory = {
  centerId: string;
  centerName: string;
  status: string;
  email: string | null;
  emails: CenterEmailRow[];
};

export async function loadCenterEmailHistory(): Promise<CenterHistory[]> {
  const { data: centers } = await supabaseAdmin
    .from("therapy_center_accounts")
    .select("id, name, status, email, payer_email")
    .neq("status", "cancelled")
    .order("name");
  const list = centers ?? [];
  if (list.length === 0) return [];

  const addresses = list
    .map((c) => (c.payer_email as string) ?? (c.email as string))
    .filter(Boolean);

  const { data: logs } = await supabaseAdmin
    .from("crm_email_log")
    .select("recipient, entity_id, subject, template, status, created_at")
    .in("template", CENTER_TEMPLATES)
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (logs ?? []).filter(
    (l) => l.entity_id != null || addresses.includes(String(l.recipient))
  );

  return list.map((c) => {
    const addr = ((c.payer_email as string) ?? (c.email as string)) || null;
    const mine = rows.filter((l) =>
      // entity_id מנצח כשהוא קיים; אחרת נופלים לכתובת המייל.
      l.entity_id ? l.entity_id === c.id : addr != null && String(l.recipient) === addr
    );
    return {
      centerId: c.id as string,
      centerName: c.name as string,
      status: c.status as string,
      email: addr,
      emails: mine.map((l) => ({
        template: String(l.template),
        templateLabel: TEMPLATE_LABELS[String(l.template)] ?? String(l.template),
        subject: (l.subject as string) ?? null,
        sentAt: l.created_at as string,
        status: String(l.status ?? "sent"),
        fromAgent: l.template === "center_readiness_nudge",
      })),
    };
  });
}
