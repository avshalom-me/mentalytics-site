import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";

// סגירה אוטומטית של עסקאות מכונים: ברגע שהמערכת מזהה שהמרכז שההצעה
// נשלחה אליו הפך ללקוח פעיל (חשבון מרכז active עם הוראת קבע בסומיט),
// העסקה עוברת לבד ל"הרשמה נסגרה" - בלי לחכות שמישהו יזכור לעדכן CRM.
//
// הזיהוי דרך שרשרת הקישור בלבד: deal.prospect_id → prospect.center_account_id
// → therapy_center_accounts. אין ניחוש לפי שם - התאמה עמומה הייתה סוגרת
// עסקה לא נכונה, וזה גרוע מעסקה שנשארת פתוחה יום נוסף.

export async function autoCloseWonDeals(): Promise<{ closed: number }> {
  const { data: openDeals } = await supabaseAdmin
    .from("crm_deals")
    .select("id, title, prospect_id, notes")
    .in("stage", ["first_contact", "negotiation", "link_sent"])
    .not("prospect_id", "is", null);
  const deals = openDeals ?? [];
  if (deals.length === 0) return { closed: 0 };

  const { data: prospects } = await supabaseAdmin
    .from("center_prospects")
    .select("id, center_account_id")
    .in("id", deals.map((d) => d.prospect_id as string));
  const accountByProspect = new Map(
    (prospects ?? [])
      .filter((p) => p.center_account_id)
      .map((p) => [p.id as string, p.center_account_id as string])
  );
  if (accountByProspect.size === 0) return { closed: 0 };

  const { data: accounts } = await supabaseAdmin
    .from("therapy_center_accounts")
    .select("id, status, sumit_recurring_id")
    .in("id", Array.from(new Set(accountByProspect.values())));
  const activeAccounts = new Set(
    (accounts ?? [])
      .filter((a) => a.status === "active" && a.sumit_recurring_id)
      .map((a) => a.id as string)
  );
  if (activeAccounts.size === 0) return { closed: 0 };

  let closed = 0;
  for (const d of deals) {
    const acct = accountByProspect.get(d.prospect_id as string);
    if (!acct || !activeAccounts.has(acct)) continue;
    const note = "נסגרה אוטומטית: זוהה מנוי מרכז פעיל בסומיט.";
    const { error } = await supabaseAdmin
      .from("crm_deals")
      .update({
        stage: "closed",
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: d.notes ? `${d.notes}\n${note}` : note,
      })
      .eq("id", d.id)
      .in("stage", ["first_contact", "negotiation", "link_sent"]);
    if (!error) closed++;
  }
  return { closed };
}
