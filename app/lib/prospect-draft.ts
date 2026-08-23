import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import type { ProspectRow } from "./center-prospects";

// טיוטת פנייה למכון שלא הצלחנו לתפוס בטלפון.
//
// **לא אוטומטי, ובכוונה.** חוק הספאם הישראלי אוסר משלוח דבר פרסומת בלי
// הסכמה מראש, וזה חל גם על פנייה לעסק. לכן:
//   - טיוטה נוצרת רק בלחיצה מפורשת על מרכז מסוים.
//   - התנאי: כבר ניסינו לפנות אליו (contacted_at מסומן) ולא קיבלנו תשובה.
//     מכון שלא ניסינו לתפוס בטלפון לא מקבל מייל.
//   - השליחה עצמה היא לחיצה נפרדת שלך, על טקסט שקראת.
//
// הטון: פנייה עניינית של עמית למקצוע, לא דיוור. מובילה בביקוש אמיתי
// שראינו באזור שלהם, בלי סופרלטיבים ובלי לחץ.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mentalytics.co.il";

export type ProspectDraft = { subject: string; body: string };

export function buildProspectDraft(p: ProspectRow, gapExamples: string[]): ProspectDraft {
  const name = (p.name || "המרכז").trim();
  const where = p.city ? ` באזור ${p.city}` : "";

  const lines: string[] = [`לכבוד ${name},`, ``];

  lines.push(
    "אני אבשלום, פסיכולוג קליני, ומנהל את טיפול חכם - מערכת התאמה בין מטופלים למטפלים. ניסיתי להשיג אתכם בטלפון ולא הצלחתי, ולכן אני כותב."
  );
  lines.push(``);

  if (gapExamples.length > 0) {
    lines.push(
      `מטופלים שמחפשים אצלנו טיפול${where} מבקשים תחומים שאין לנו בהם מספיק מענה - למשל ${gapExamples
        .slice(0, 2)
        .join(", ")}. הפניות האלה מגיעות אלינו ואין לנו למי להעביר אותן.`
    );
  } else {
    lines.push(
      `מטופלים שמחפשים אצלנו טיפול${where} לא תמיד מוצאים מענה מתאים, והפניות האלה מגיעות אלינו בלי שיהיה למי להעביר אותן.`
    );
  }
  lines.push(``);
  lines.push(
    "מרכזים טיפוליים נכנסים אצלנו למערכת ההתאמות ומקבלים פניות ממטופלים שחיפשו בדיוק את מה שהמרכז נותן - לפי תחום, אזור, גיל ושפה. אפשר להצטרף כמרכז אחד, או עם פרופיל לכל מטפל/ת."
  );
  lines.push(``);
  lines.push(
    "אם זה מעניין אתכם, אשמח לשיחה קצרה של עשר דקות שבה אסביר איך זה עובד ומה מתאים למרכז שלכם. אפשר להשיב למייל הזה עם זמן שנוח לכם."
  );
  lines.push(``);
  lines.push(`פרטים על המערכת: ${SITE_URL}/centers`);
  lines.push(``);
  lines.push("בברכה,");
  lines.push("אבשלום");
  lines.push("טיפול חכם");

  return {
    subject: `${name} - פניות ממטופלים${where} שאין לנו למי להעביר`,
    body: lines.join("\n"),
  };
}

/** יוצר טיוטה ושומר אותה על השורה. נקרא רק מבקשה מפורשת באדמין. */
export async function requestProspectDraft(id: string): Promise<ProspectDraft> {
  const { data, error } = await supabaseAdmin.from("center_prospects").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`טעינת המועמד נכשלה: ${error.message}`);
  const p = data as ProspectRow | null;
  if (!p) throw new Error("המועמד לא נמצא");
  if (!p.contacted_at) {
    throw new Error("טיוטה נוצרת רק אחרי שניסיתם לפנות בטלפון - סמנו קודם \"פנינו\".");
  }
  if (p.answer) {
    throw new Error("המרכז כבר ענה - אין צורך בפנייה במייל.");
  }

  // דוגמאות לפערים באזור, כדי שהפנייה תדבר על ביקוש אמיתי ולא בכלליות.
  const { data: gaps } = await supabaseAdmin
    .from("agent_actions")
    .select("title")
    .eq("agent", "supply_gaps")
    .eq("action_type", "recruit_gap")
    .eq("status", "pending")
    .limit(20);
  // כותרת הממצא נראית "פער גיוס: אין מספיק מטפלים ל<תחום> באזור <אזור>",
  // ובלי הקילוף הזה המייל היוצא היה מצטט את שם הממצא הפנימי שלנו.
  const examples = (gaps ?? [])
    .map((g) => String(g.title ?? ""))
    .map((t) => t.replace(/^.*?אין מספיק מטפלים ל/, "").split(" באזור ")[0].trim())
    .filter((t) => t && t.length < 60)
    .slice(0, 3);

  const draft = buildProspectDraft(p, examples);
  const { error: updErr } = await supabaseAdmin
    .from("center_prospects")
    .update({
      draft_subject: draft.subject,
      draft_body: draft.body,
      draft_requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updErr) throw new Error(`שמירת הטיוטה נכשלה: ${updErr.message}`);
  return draft;
}

/** שליחה בפועל למועמד. קליק מפורש שלך, על טקסט שקראת - כמו כל שליחה
 *  אחרת אצלנו. נחסמת אם אין כתובת, אם לא ניסינו טלפון, או אם כבר נשלח. */
export async function sendProspectDraft(opts: {
  id: string;
  email: string;
  subject: string;
  body: string;
}): Promise<{ ok: boolean; error?: string; name?: string; email?: string }> {
  const to = opts.email?.trim();
  const body = opts.body?.trim();
  if (!to || !to.includes("@")) return { ok: false, error: "חסרה כתובת מייל תקינה" };
  if (!body) return { ok: false, error: "גוף המייל ריק" };

  const { data } = await supabaseAdmin.from("center_prospects").select("*").eq("id", opts.id).maybeSingle();
  const p = data as ProspectRow | null;
  if (!p) return { ok: false, error: "המועמד לא נמצא" };
  if (!p.contacted_at) return { ok: false, error: "לא סומן שניסיתם לפנות בטלפון" };
  if (p.draft_sent_at) return { ok: false, error: "כבר נשלח מייל למועמד הזה" };

  const { sendCenterNudgeEmail } = await import("./center-emails");
  const sent = await sendCenterNudgeEmail({
    to,
    subject: opts.subject?.trim() || `${p.name} - פנייה מטיפול חכם`,
    message: body,
  });
  if (!sent.ok) return { ok: false, error: sent.error || "שליחת המייל נכשלה" };

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("center_prospects")
    .update({
      email: to,
      draft_subject: opts.subject,
      draft_body: body,
      draft_sent_at: now,
      notes: [p.notes, `מייל נשלח ב-${now.slice(0, 10)}`].filter(Boolean).join(" · "),
      updated_at: now,
    })
    .eq("id", opts.id);

  return { ok: true, name: p.name, email: to };
}
