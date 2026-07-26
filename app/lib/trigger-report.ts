// Shared client helper for the admin "generate report now" buttons.
// The report trigger runs a reasoning LLM for ~2-3 minutes. If it ever overruns
// the serverless limit, Vercel returns a plain-text/HTML error page (a 504),
// which the old `await res.json()` choked on with a cryptic
// "Unexpected token 'A', 'An error o'... is not valid JSON". Read as text first,
// parse defensively, and turn a timeout into a clear Hebrew message.

export type TriggerResult =
  | { ok: true; period_start?: string; emailStatus?: string }
  | { ok: false; error: string };

export async function triggerReport(url: string): Promise<TriggerResult> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", cache: "no-store" });
  } catch {
    return { ok: false, error: "שגיאת רשת - בדוק את החיבור ונסה שוב." };
  }

  const text = await res.text();
  try {
    const json = JSON.parse(text) as TriggerResult & { ok: boolean; error?: string };
    return json.ok ? json : { ok: false, error: json.error ?? "שגיאה לא ידועה" };
  } catch {
    // Not our JSON - a platform error page. A 504 (or a body mentioning timeout)
    // means the LLM generation exceeded the function's time budget.
    if (res.status === 504 || /timeout|timed out/i.test(text)) {
      return {
        ok: false,
        error: "הפקת הדוח ארכה יותר מדי (חריגת זמן). ההפקה כוללת ניתוח AI ויכולה לקחת 2-3 דקות - נסה/י שוב.",
      };
    }
    return { ok: false, error: `שגיאת שרת (${res.status}). נסה/י שוב בעוד רגע.` };
  }
}
