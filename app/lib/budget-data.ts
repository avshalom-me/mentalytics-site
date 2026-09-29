import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import {
  defaultTargetMonth,
  projectBudget,
  summarySentence,
  type BudgetCampaignInput,
  type BudgetProjection,
} from "./budget-agent";

// Everything the budget page and the monthly budget agent read, in one place,
// so the page and the recommendation in the queue can never disagree.

type RegistryRow = {
  google_name: string;
  utm_campaign: string | null;
  budget_type: "daily" | "total";
  budget_amount: number | string | null;
  active: boolean;
  protected_reason: string | null;
  protected_until: string | null;
};

type ConfigRow = {
  campaign_name: string;
  status: string | null;
  daily_budget: number | string | null;
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

export type BudgetReport = {
  today: string;
  month: string;
  ceiling: { value: number; since: string } | null;
  cplTarget: { value: number; since: string } | null;
  sentence: string;
  projection: BudgetProjection;
  /** The last day with Google spend in the database. */
  adsDataThrough: string | null;
};

export function israelToday(): string {
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

export async function loadBudgetReport(opts: { month?: string } = {}): Promise<BudgetReport> {
  const today = israelToday();
  const month =
    opts.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(opts.month) ? opts.month : defaultTargetMonth(today);

  const [registryQ, configQ, statsQ, ceiling, cplTarget, lastDayQ] = await Promise.all([
    supabaseAdmin
      .from("ads_campaign_registry")
      .select("google_name, utm_campaign, budget_type, budget_amount, active, protected_reason, protected_until"),
    // What is set in Google right now, from the nightly sync. The registry is
    // typed by hand and can lag behind a change made in Google.
    supabaseAdmin.from("ads_campaign_config").select("campaign_name, status, daily_budget"),
    supabaseAdmin.rpc("budget_campaign_stats"),
    targetInForce("ads_budget_month", month),
    targetInForce("cpl_max", month),
    supabaseAdmin.from("ads_campaign_daily").select("date").order("date", { ascending: false }).limit(1),
  ]);
  if (registryQ.error) throw new Error(`ads_campaign_registry: ${registryQ.error.message}`);
  if (configQ.error) throw new Error(`ads_campaign_config: ${configQ.error.message}`);
  if (statsQ.error) throw new Error(`budget_campaign_stats: ${statsQ.error.message}`);

  const stats = new Map(((statsQ.data ?? []) as StatsRow[]).map((s) => [s.utm_campaign, s]));
  const config = new Map(((configQ.data ?? []) as ConfigRow[]).map((c) => [c.campaign_name, c]));

  const campaigns: BudgetCampaignInput[] = ((registryQ.data ?? []) as RegistryRow[])
    .filter((r) => r.utm_campaign)
    .map((r) => {
      const s = stats.get(r.utm_campaign!);
      const cfg = config.get(r.google_name);
      const registryBudget = r.budget_amount == null ? null : Number(r.budget_amount);
      const googleBudget = cfg?.daily_budget == null ? null : Number(cfg.daily_budget);
      // Google's own status and budget win when the sync has seen the campaign;
      // a campaign launched since the last sync falls back to the registry.
      const active = cfg ? cfg.status === "ENABLED" : r.active;
      const dailyBudget =
        r.budget_type !== "daily"
          ? null
          : googleBudget != null && Number.isFinite(googleBudget) && googleBudget > 0
            ? googleBudget
            : registryBudget != null && Number.isFinite(registryBudget)
              ? registryBudget
              : null;
      return {
        googleName: r.google_name,
        utmCampaign: r.utm_campaign!,
        active,
        budgetType: r.budget_type,
        dailyBudget,
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
    })
    .filter((c) => c.active || stats.has(c.utmCampaign));

  const projection = projectBudget({ campaigns, ceiling: ceiling?.value ?? null, month, today });
  projection.campaigns.sort(
    (a, b) => Number(b.inPlan) - Number(a.inPlan) || b.cost30 - a.cost30 || a.googleName.localeCompare(b.googleName)
  );

  return {
    today,
    month,
    ceiling,
    cplTarget,
    sentence: summarySentence(projection),
    projection,
    adsDataThrough: (lastDayQ.data?.[0]?.date as string | undefined) ?? null,
  };
}
