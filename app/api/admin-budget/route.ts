import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import {
  defaultTargetMonth,
  projectBudget,
  summarySentence,
  type BudgetCampaignInput,
} from "@/app/lib/budget-agent";

// /admin/budget, read-only: the month's advertising ceiling, how the budgets
// set in Google today compare with it, and a recommended split
// (app/lib/budget-agent.ts). Nothing here writes anywhere.

type RegistryRow = {
  google_name: string;
  utm_campaign: string | null;
  budget_type: "daily" | "total";
  budget_amount: number | string | null;
  active: boolean;
  protected_reason: string | null;
  protected_until: string | null;
};

type StatsRow = {
  utm_campaign: string;
  first_spend: string | null;
  cost30: number | string;
  cost60: number | string;
  seekers30: number | string;
  seekers60: number | string;
  paid_seekers60: number | string;
  trial_seekers60: number | string;
};

function israelToday(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
}

/**
 * plan_targets holds milestones, so the value for a month is the latest row that
 * has started by then - the same reading ads-insights gives cpl_max.
 */
async function targetInForce(metric: string, month: string): Promise<{ value: number; since: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("plan_targets")
    .select("month, target")
    .eq("metric", metric)
    .eq("scenario", "base")
    .lte("month", `${month}-01`)
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`plan_targets ${metric}: ${error.message}`);
  const value = Number(data?.target);
  return data && Number.isFinite(value) && value > 0 ? { value, since: String(data.month).slice(0, 7) } : null;
}

export async function GET(req: NextRequest) {
  try {
    const today = israelToday();
    const asked = req.nextUrl.searchParams.get("month") ?? "";
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(asked) ? asked : defaultTargetMonth(today);

    const [registryQ, statsQ, ceiling, cplTarget, syncQ] = await Promise.all([
      supabaseAdmin
        .from("ads_campaign_registry")
        .select("google_name, utm_campaign, budget_type, budget_amount, active, protected_reason, protected_until"),
      supabaseAdmin.rpc("budget_campaign_stats"),
      targetInForce("ads_budget_month", month),
      targetInForce("cpl_max", month),
      supabaseAdmin.from("ads_sync_log").select("synced_at").order("synced_at", { ascending: false }).limit(1),
    ]);
    if (registryQ.error) throw new Error(`ads_campaign_registry: ${registryQ.error.message}`);
    if (statsQ.error) throw new Error(`budget_campaign_stats: ${statsQ.error.message}`);

    const stats = new Map(((statsQ.data ?? []) as StatsRow[]).map((s) => [s.utm_campaign, s]));
    const campaigns: BudgetCampaignInput[] = ((registryQ.data ?? []) as RegistryRow[])
      .filter((r) => r.utm_campaign && (r.active || stats.has(r.utm_campaign)))
      .map((r) => {
        const s = stats.get(r.utm_campaign!);
        const budget = r.budget_amount == null ? null : Number(r.budget_amount);
        return {
          googleName: r.google_name,
          utmCampaign: r.utm_campaign!,
          active: r.active,
          budgetType: r.budget_type,
          dailyBudget: r.budget_type === "daily" && Number.isFinite(budget) ? budget : null,
          firstSpend: s?.first_spend ?? null,
          cost30: Number(s?.cost30 ?? 0),
          cost60: Number(s?.cost60 ?? 0),
          seekers30: Number(s?.seekers30 ?? 0),
          seekers60: Number(s?.seekers60 ?? 0),
          paidSeekers60: Number(s?.paid_seekers60 ?? 0),
          trialSeekers60: Number(s?.trial_seekers60 ?? 0),
          protectedReason: r.protected_reason,
          protectedUntil: r.protected_until,
        };
      });

    const projection = projectBudget({ campaigns, ceiling: ceiling?.value ?? null, month, today });
    projection.campaigns.sort(
      (a, b) => Number(b.inPlan) - Number(a.inPlan) || b.cost30 - a.cost30 || a.googleName.localeCompare(b.googleName)
    );

    return NextResponse.json({
      ok: true,
      today,
      month,
      ceiling,
      cplTarget,
      sentence: summarySentence(projection),
      projection,
      adsLastSync: (syncQ.data?.[0]?.synced_at as string | undefined) ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
