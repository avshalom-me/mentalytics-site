import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { regionsCovered } from "./match-fallback";
import { LOAD_WINDOW_DAYS } from "./match-load-shedding";
import {
  classifyRegion,
  classifyRow,
  summarize,
  type DistributionRow,
  type DistributionSummary,
  type RegionRow,
  type RegionVerdict,
  type Verdict,
} from "./match-distribution-rules";

// הנתונים לרובריקת חלוקת הפניות (29/10/2026): שלוש פונקציות במסד
// (20261029_match_load_distribution.sql) ושורת המטפלים. הסיווג עצמו טהור
// (match-distribution-rules.ts). החלון: 30 יום, מול 30 הימים שלפניו.

export const DISTRIBUTION_WINDOW_DAYS = 30;

const ONLINE_LABEL = "אונליין";
const NO_REGION_LABEL = "(ללא אזור)";

type TherapistRow = {
  id: string;
  full_name: string | null;
  promotion_source: string | null;
  entity_type: string | null;
  status: string;
  online: boolean | null;
  regions: string[] | null;
  promoted_since: string | null;
  match_paused_until: string | null;
};

type DistRpcRow = {
  therapist_id: string;
  people: number | string;
  people_prev: number | string;
  match_people: number | string;
  appearances: number | string;
  appearances_prev: number | string;
  opens: number | string;
};

type RegionRpcRow = {
  region: string;
  searches: number | string;
  people: number | string;
  therapists_with_contacts: number | string;
  top1: number | string;
  top3: number | string;
};

export type DistributionReport = {
  window_days: number;
  load_window_days: number;
  generated_at: string;
  summary: DistributionSummary;
  rows: (DistributionRow & { verdict: Verdict; paused_now: boolean })[];
  regions: (RegionRow & { verdict: RegionVerdict })[];
};

const n = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

export async function loadMatchDistribution(now: Date = new Date()): Promise<DistributionReport> {
  const [therapistsRes, distRes, regionsRes, loadRes] = await Promise.all([
    supabaseAdmin
      .from("therapists")
      .select("id, full_name, promotion_source, entity_type, status, online, regions, promoted_since, match_paused_until")
      .eq("status", "paying")
      .eq("admin_approved", true),
    supabaseAdmin.rpc("admin_match_distribution", { p_days: DISTRIBUTION_WINDOW_DAYS }),
    supabaseAdmin.rpc("admin_match_distribution_regions", { p_days: DISTRIBUTION_WINDOW_DAYS }),
    supabaseAdmin.rpc("match_contact_load", { p_days: LOAD_WINDOW_DAYS }),
  ]);
  for (const [what, res] of [
    ["therapists", therapistsRes],
    ["admin_match_distribution", distRes],
    ["admin_match_distribution_regions", regionsRes],
    ["match_contact_load", loadRes],
  ] as const) {
    if (res.error) throw new Error(`${what}: ${res.error.message}`);
  }

  const dist = new Map<string, DistRpcRow>();
  for (const r of (distRes.data ?? []) as DistRpcRow[]) dist.set(String(r.therapist_id), r);
  const load = new Map<string, number>();
  for (const r of (loadRes.data ?? []) as { therapist_id: string; people: number | string }[]) {
    load.set(String(r.therapist_id), n(r.people));
  }

  const nowMs = now.getTime();
  const rows: (DistributionRow & { verdict: Verdict; paused_now: boolean })[] = ((therapistsRes.data ?? []) as TherapistRow[])
    .map((t) => {
      const d = dist.get(t.id);
      const row: DistributionRow = {
        id: t.id,
        name: (t.full_name ?? "").trim() || "(ללא שם)",
        promotion_source: t.promotion_source,
        entity_type: t.entity_type,
        status: t.status,
        online: t.online === true,
        regions: Array.isArray(t.regions) ? t.regions : [],
        promoted_days: t.promoted_since ? Math.floor((nowMs - Date.parse(t.promoted_since)) / 86_400_000) : null,
        paused_until: t.match_paused_until,
        people: n(d?.people),
        people_prev: n(d?.people_prev),
        match_people: n(d?.match_people),
        appearances: n(d?.appearances),
        appearances_prev: n(d?.appearances_prev),
        opens: n(d?.opens),
        load14: load.get(t.id) ?? 0,
      };
      return {
        ...row,
        verdict: classifyRow(row, nowMs),
        paused_now: !!row.paused_until && Date.parse(row.paused_until) > nowMs,
      };
    })
    .sort((a, b) => b.people - a.people || b.appearances - a.appearances);

  const covering = (region: string): number => {
    if (region === NO_REGION_LABEL) return rows.length;
    if (region === ONLINE_LABEL) return rows.filter((r) => r.online).length;
    return rows.filter((r) => regionsCovered(r.regions).has(region)).length;
  };
  const regions = ((regionsRes.data ?? []) as RegionRpcRow[]).map((r) => {
    const row: RegionRow = {
      region: r.region,
      searches: n(r.searches),
      people: n(r.people),
      therapists_with_contacts: n(r.therapists_with_contacts),
      top1: n(r.top1),
      top3: n(r.top3),
      covering: covering(r.region),
    };
    return { ...row, verdict: classifyRegion(row) };
  });

  return {
    window_days: DISTRIBUTION_WINDOW_DAYS,
    load_window_days: LOAD_WINDOW_DAYS,
    generated_at: now.toISOString(),
    summary: summarize(rows),
    rows,
    regions,
  };
}
