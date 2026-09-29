import "server-only";
import { startAgentRun, finishAgentRun, syncAgentAlerts } from "./agent-infra";
import { budgetRecommendation } from "./budget-agent";
import { budgetFacts, narrateBudget } from "./budget-agent-narrative";
import { loadBudgetReport } from "./budget-data";

// The monthly budget agent (docs/agents/budget-agent-plan.md, step 2). On the
// 1st of the month, before the morning report, it reads the same report as
// /admin/budget and, when the budgets set in Google exceed the month's ceiling,
// puts one recommendation in the agents' queue - high severity, so it reaches
// the morning report. One recommendation per month (dedupe key budget:YYYY-MM):
// a second run that month refreshes it instead of adding another, and once the
// budgets fit, the next run closes it.
//
// Recommendation only. It changes nothing in Google Ads and sends no email.

export type BudgetRunResult = {
  ok: boolean;
  month: string | null;
  needed: boolean;
  title: string | null;
  narrated: boolean;
  created: number;
  refreshed: number;
  closed: number;
  error?: string;
};

export async function runBudgetAgent(opts: { month?: string; mode?: string } = {}): Promise<BudgetRunResult> {
  const runId = await startAgentRun("budget", opts.mode ?? "manual");
  try {
    const report = await loadBudgetReport({ month: opts.month });
    const rec = budgetRecommendation(report.projection);
    const key = `budget:${report.month}`;

    const facts = budgetFacts(report);
    const narrative = rec.needed ? await narrateBudget(rec, facts) : null;

    const sync = await syncAgentAlerts(
      "budget",
      rec.needed
        ? [
            {
              actionType: "budget_plan",
              kind: "action" as const,
              severity: "high" as const,
              title: rec.title,
              body: narrative ? `${rec.body}\n\nלמה: ${narrative}` : rec.body,
              dedupeKey: key,
              payload: {
                month: report.month,
                ceiling: report.ceiling?.value ?? null,
                current_monthly: report.projection.current.monthly,
                plan_monthly: report.projection.plan.monthly,
                plan_seekers: report.projection.plan.seekers,
                changes: rec.changes,
              },
            },
          ]
        : [],
      { managedKeys: [key], recoveryNote: "התקציבים בגוגל כבר בתוך התקרה - נסגר אוטומטית" }
    );

    await finishAgentRun(runId, {
      status: rec.needed ? "ok" : "empty",
      summary: rec.needed ? `${rec.title}: ${rec.changes.length} שינויים` : `${rec.title}. ${report.sentence}`,
      details: {
        month: report.month,
        ceiling: report.ceiling?.value ?? null,
        current_monthly: report.projection.current.monthly,
        plan_monthly: report.projection.plan.monthly,
        plan_seekers: report.projection.plan.seekers,
        last_30_days: report.projection.lastMonth,
        changes: rec.changes,
        narrated: !!narrative,
        ads_data_through: report.adsDataThrough,
      },
    });

    return {
      ok: true,
      month: report.month,
      needed: rec.needed,
      title: rec.title,
      narrated: !!narrative,
      created: sync.created,
      refreshed: sync.refreshed,
      closed: sync.recovered,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishAgentRun(runId, { status: "error", summary: `סוכן התקציב נכשל: ${msg}`, error: msg });
    return { ok: false, month: null, needed: false, title: null, narrated: false, created: 0, refreshed: 0, closed: 0, error: msg };
  }
}
