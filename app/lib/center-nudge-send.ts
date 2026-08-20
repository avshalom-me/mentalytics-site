import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { sendCenterNudgeEmail } from "./center-emails";
import { loadCentersWithReadiness } from "./center-readiness-load";

// מסלול השליחה היחיד של נדנוד מרכז: קליק מפורש באדמין על טיוטה שהסוכן
// הכין ושאתה קראת. אין קרון ששולח את זה, ולא יהיה.
//
// כמו במסלול הצעת המתנה למטפלים: הזכאות נבדקת מחדש ברגע השליחה ולא
// נשענת על מה שהיה נכון כשהטיוטה נוצרה - מרכז שהשלים הכול בינתיים לא
// יקבל מייל שמבקש ממנו דברים שכבר עשה.

export type SendResult =
  | { ok: true; centerName: string; email: string }
  | { ok: false; error: string };

export async function sendCenterNudge(opts: {
  actionId: string;
  centerId: string;
  subject: string;
  body: string;
}): Promise<SendResult> {
  const { actionId, centerId } = opts;
  const subject = opts.subject?.trim();
  const body = opts.body?.trim();
  if (!body) return { ok: false, error: "גוף המייל ריק" };

  const { data: action, error: actionErr } = await supabaseAdmin
    .from("agent_actions")
    .select("id, action_type, status, payload")
    .eq("id", actionId)
    .single();
  if (actionErr || !action) return { ok: false, error: "ההצעה לא נמצאה" };
  if (action.action_type !== "center_nudge") return { ok: false, error: "ההצעה הזו אינה טיוטת נדנוד" };
  if (action.status !== "pending") return { ok: false, error: "ההצעה כבר טופלה - רענן/י את העמוד" };

  const payloadCenter = (action.payload as { center_id?: string } | null)?.center_id;
  if (payloadCenter && payloadCenter !== centerId) {
    return { ok: false, error: "המרכז שנבחר אינו המרכז של ההצעה הזו" };
  }

  // בדיקת זכאות מחדש מול המצב הנוכחי.
  const centers = await loadCentersWithReadiness();
  const center = centers.find((c) => c.id === centerId);
  if (!center) return { ok: false, error: "המרכז לא נמצא או שאינו פעיל" };
  if (center.readiness.missingForCenter.length === 0) {
    return { ok: false, error: "לא נשלח: המרכז השלים בינתיים את כל מה שהיה חסר" };
  }
  const to = center.payerEmail ?? center.email;
  if (!to) return { ok: false, error: "אין כתובת מייל למרכז" };

  const sent = await sendCenterNudgeEmail({ to, subject: subject || `${center.name} - השלמת פרטים`, message: body });
  if (!sent.ok) return { ok: false, error: sent.error || "שליחת המייל נכשלה" };

  await supabaseAdmin
    .from("agent_actions")
    .update({
      status: "executed",
      status_changed_at: new Date().toISOString(),
      resolved_by: "admin",
      resolution_note: `נשלח אל ${to}`,
    })
    .eq("id", actionId);

  return { ok: true, centerName: center.name, email: to };
}
