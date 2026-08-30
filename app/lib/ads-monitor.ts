import "server-only";
import { buildAdsInsights } from "./ads-insights";
import { startAgentRun, finishAgentRun, syncAgentAlerts } from "./agent-infra";

// סוכן הפרסום (סוכן 4): כל בוקר אחרי הסנכרון הלילי (05:00 סקריפט, 07:00
// סוכן) הוא מריץ את מנוע התובנות המשותף - אותו מנוע בדיוק שמאחורי
// /admin/ads-console - ודוחף לתור ההצעות כל ממצא אדום או כתום. הקונסולה
// נשארת מסך הצלילה; התור, הדוח היומי ועמוד הסוכנים הם איך שממצא מגיע
// אליך בלי שתפתח כלום.
//
// עד 30/8/26 היו כאן שתי מערכות נפרדות: הסוכן שאל את ה-API החי ארבע
// שאלות, והקונסולה בדקה חמש-עשרה על הטבלאות המסונכרנות. עכשיו מקור אחד
// (הטבלאות - מלאות עד אתמול, כולל מילות מפתח ומונחי חיפוש שה-API החי לא
// סיפק), ומנוע אחד. info נשאר בקונסולה בלבד - התור שומר על עצמו נקי.
//
// קריאה בלבד: הסוכן לא נוגע בקמפיינים ולא משנה תקציבים. הוא מנסח מה כדאי
// לעשות, ואתה מבצע בממשק של גוגל אחרי אישור.

export type AdsFinding = {
  key: string;
  severity: "high" | "normal";
  title: string;
  detail: string;
};

export type AdsMonitorResult = {
  ok: boolean;
  configured: boolean;
  findings: AdsFinding[];
  campaigns: {
    name: string;
    utm: string | null;
    cost: number;
    clicks: number;
    contacts: number;
    cpl: number | null;
  }[];
  spendMtd: number;
  budgetPace: { expected: number; actual: number } | null;
  error?: string;
};

function ils(n: number): string {
  return `₪${Math.round(n).toLocaleString("he-IL")}`;
}

export async function runAdsMonitor(): Promise<AdsMonitorResult> {
  const runId = await startAgentRun("ads", "monitor");
  const base: AdsMonitorResult = {
    ok: true,
    configured: true,
    findings: [],
    campaigns: [],
    spendMtd: 0,
    budgetPace: null,
  };

  try {
    const insights = await buildAdsInsights();
    base.configured = insights.lastSync != null;
    base.spendMtd = insights.spendMtd;
    base.budgetPace = insights.budgetPace;
    base.campaigns = insights.payload.campaigns
      .filter((c) => c.cost7 > 0 || c.contacts7 > 0)
      .map((c) => ({
        name: c.google_name,
        utm: c.utm_campaign,
        cost: c.cost7,
        clicks: c.clicks7,
        contacts: c.contacts7,
        cpl: c.contacts7 > 0 ? Math.round((c.cost7 / c.contacts7) * 10) / 10 : null,
      }));

    if (!base.configured) {
      await finishAgentRun(runId, { status: "empty", summary: "סנכרון האדס טרם רץ - אין נתונים לנטר (docs/ads-console-setup.md)" });
      return base;
    }

    // אדום → high, כתום → normal. info נשאר בקונסולה ולא מגיע לתור.
    base.findings = insights.alerts
      .filter((a) => a.severity !== "info")
      .map((a) => ({
        key: a.key,
        severity: a.severity === "red" ? ("high" as const) : ("normal" as const),
        title: a.title,
        detail: a.detail,
      }));

    const { recovered } = await syncAgentAlerts(
      "ads",
      base.findings.map((f) => ({
        actionType: "alert",
        // ממצא: נכון כל עוד החשבון במצב הזה. השינוי בגוגל נעשה על ידך,
        // וכשהוא נקלט בסנכרון הבא הממצא נסגר מעצמו דרך managedKeys.
        kind: "finding" as const,
        severity: f.severity === "high" ? ("high" as const) : undefined,
        title: f.title,
        body: f.detail,
        dedupeKey: f.key,
        payload: { severity: f.severity },
      })),
      { managedKeys: insights.managedKeys, recoveryNote: "הממצא כבר לא מתקיים - נסגר אוטומטית" }
    );

    await finishAgentRun(runId, {
      status: base.findings.length > 0 ? "ok" : "empty",
      summary:
        base.findings.length > 0
          ? `${base.findings.length} ממצאי פרסום: ${base.findings.slice(0, 6).map((f) => f.title).join(" · ")}${base.findings.length > 6 ? ` · +${base.findings.length - 6}` : ""}`
          : `אין ממצאים · הוצאה החודש ${ils(base.spendMtd)}`,
      details: {
        findings: base.findings.map((f) => ({ key: f.key, severity: f.severity, title: f.title })),
        campaigns: base.campaigns,
        spend_mtd: base.spendMtd,
        budget_pace: base.budgetPace,
        recovered_alerts: recovered,
        cpl_target: insights.cplTarget,
        last_sync: insights.lastSync,
      },
    });
    return base;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    base.ok = false;
    base.error = msg;
    await finishAgentRun(runId, { status: "error", summary: `סוכן הפרסום נכשל: ${msg}` });
    return base;
  }
}
