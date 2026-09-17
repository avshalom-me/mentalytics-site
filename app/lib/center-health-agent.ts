import "server-only";
import { startAgentRun, finishAgentRun, syncAgentAlerts, agentEnabled } from "./agent-infra";
import { loadCenterHealth, type CenterHealth } from "./center-health";

// סוכן בריאות המרכזים: ממצא אחד לכל מרכז עם דגל, לא שורה לכל דגל.
//
// הלקח שהוליד אותו: ממצאי "N ממטפלי המרכז בלי לחיצה" של סוכן השימור ישבו
// בתור מ-4/9 וב-28/8 ואיש לא ראה אותם - דוח הבוקר מונה ~50 פריטים, ושורה
// על מרכז בודד טובעת בו. ממצא אחד לכל מרכז, עם החומרה הגבוהה ביותר מבין
// הדגלים שלו, עולה לראש הדוח כשמגיע לו (critical/high) ונשאר שורה אחת.
//
// קורא בלבד: לא שולח מייל, לא נוגע בקידום. הדגלים שבאחריות המרכז מגיעים
// למייל רק דרך טיוטת הנדנוד שהסוכן השני מכין ושאתה שולח בקליק.

export type CenterHealthFinding = {
  key: string;
  center: string;
  severity: "critical" | "high" | "normal";
  title: string;
};

export type CenterHealthRun = {
  ok: boolean;
  checked: number;
  findings: CenterHealthFinding[];
  error?: string;
};

function findingTitle(h: CenterHealth): string {
  const first = h.flags[0];
  const rest = h.flags.length - 1;
  return `${h.name}: ${first.label}${rest > 0 ? ` ועוד ${rest}` : ""}`;
}

function findingBody(h: CenterHealth, benchmarkCards: number | null, benchmarkContacts: number | null): string {
  const lines = h.flags.map((f) => `• ${f.label} - ${f.detail}`);
  if (h.perUnit30) {
    const bench =
      benchmarkCards !== null && benchmarkContacts !== null
        ? ` (מטפל פרטי משלם: ${benchmarkCards} ו-${benchmarkContacts})`
        : "";
    lines.push(
      `חשיפה למטפל ב-30 יום: ${h.perUnit30.cards} הופעות בתוצאות השאלון, ${h.perUnit30.contacts} פניות${bench}.`
    );
  }
  if (h.readiness.headline) lines.push(`מוכנות: ${h.readiness.headline}.`);
  if (h.daysToBilling !== null) {
    lines.push(h.daysToBilling >= 0 ? `החיוב מתחיל בעוד ${h.daysToBilling} ימים.` : "החיוב כבר פעיל.");
  }
  return lines.join("\n");
}

export async function runCenterHealth(): Promise<CenterHealthRun> {
  const empty: CenterHealthRun = { ok: true, checked: 0, findings: [] };
  if (!agentEnabled("center_health")) return empty;

  const runId = await startAgentRun("center_health", "monitor");
  try {
    const report = await loadCenterHealth();
    const flagged = report.centers.filter((h) => h.flags.length > 0);

    const findings: CenterHealthFinding[] = flagged.map((h) => ({
      key: `center_health:${h.id}`,
      center: h.name,
      severity: h.severity ?? "normal",
      title: findingTitle(h),
    }));

    const { recovered } = await syncAgentAlerts(
      "center_health",
      flagged.map((h) => ({
        actionType: "center_health",
        kind: "finding" as const,
        severity: h.severity ?? "normal",
        title: findingTitle(h),
        body: findingBody(h, report.benchmark?.cards ?? null, report.benchmark?.contacts ?? null),
        entityType: "center",
        entityId: h.id,
        entityLabel: h.trackLabel,
        payload: {
          center_id: h.id,
          center_name: h.name,
          flags: h.flags.map((f) => ({ key: f.key, severity: f.severity, owner: f.owner, label: f.label })),
          days_to_billing: h.daysToBilling,
        },
        dedupeKey: `center_health:${h.id}`,
      })),
      {
        // כל מרכז פעיל נבדק - ממצא של מרכז שהדגלים שלו נעלמו נסגר לבד.
        managedKeys: report.centers.map((h) => `center_health:${h.id}`),
        recoveryNote: "הדגלים נסגרו - המרכז במצב תקין",
      }
    );

    await finishAgentRun(runId, {
      status: findings.length > 0 ? "ok" : "empty",
      summary:
        findings.length > 0
          ? `${findings.length} מתוך ${report.centers.length} מרכזים עם דגל: ${findings.slice(0, 3).map((f) => f.title).join(" · ")}${findings.length > 3 ? " ..." : ""}`
          : `כל ${report.centers.length} המרכזים הפעילים בלי דגלים`,
      details: {
        findings,
        checked: report.centers.length,
        benchmark: report.benchmark,
        recovered_alerts: recovered,
      },
    });

    return { ok: true, checked: report.centers.length, findings };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishAgentRun(runId, { status: "error", error: msg });
    return { ...empty, ok: false, error: msg };
  }
}
