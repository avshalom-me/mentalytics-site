import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// Recruitment report: therapist signups grouped by the campaign / channel that
// drove them. Powers the /admin/recruitment A/B view (which Facebook ad brings
// the better therapist leads). Guarded by the admin Basic-Auth middleware
// (every /api/admin-* route is).

export const dynamic = "force-dynamic";

type Period = "week" | "month" | "all";

function periodToDate(period: Period): string | null {
  if (period === "all") return null;
  const ms = period === "week" ? 7 * 86_400_000 : 30 * 86_400_000;
  return new Date(Date.now() - ms).toISOString();
}

type Row = {
  signup_channel: string | null;
  signup_utm_campaign: string | null;
  status: string | null;
  admin_approved: boolean | null;
  created_at: string | null;
};

// A signup counts as "approved" once it passed manual review and is listable;
// "paying" once the therapist is on a paid / promoted plan.
const isApproved = (r: Row) =>
  Boolean(r.admin_approved) && (r.status === "approved" || r.status === "paying");
const isPaying = (r: Row) => r.status === "paying";

type Bucket = { signups: number; approved: number; paying: number };
const emptyBucket = (): Bucket => ({ signups: 0, approved: 0, paying: 0 });

function tally(bucket: Bucket, r: Row): void {
  bucket.signups++;
  if (isApproved(r)) bucket.approved++;
  if (isPaying(r)) bucket.paying++;
}

export async function GET(req: NextRequest) {
  const requested = (req.nextUrl.searchParams.get("period") ?? "all") as Period;
  const validPeriods: Period[] = ["week", "month", "all"];
  const period: Period = validPeriods.includes(requested) ? requested : "all";
  const since = periodToDate(period);

  try {
    let q = supabaseAdmin
      .from("therapists")
      .select("signup_channel, signup_utm_campaign, status, admin_approved, created_at");
    if (since) q = q.gte("created_at", since);

    // Signups (from therapists) + ad visitors per campaign (from analytics_events
    // via RPC — distinct sessions, cap-safe) so the view shows the full funnel:
    // how many people the ad brought, and how many of them registered.
    const [therapistsRes, visitsRes] = await Promise.all([
      q,
      supabaseAdmin.rpc("admin_recruitment_visits", { p_since: since }),
    ]);
    if (therapistsRes.error) throw therapistsRes.error;
    if (visitsRes.error) throw visitsRes.error;

    const rows = (therapistsRes.data ?? []) as Row[];
    const visitorsByCampaign = new Map<string, number>();
    for (const v of (visitsRes.data ?? []) as { campaign: string; visitors: number }[]) {
      if (v.campaign) visitorsByCampaign.set(v.campaign, Number(v.visitors) || 0);
    }

    const byCampaign = new Map<string, Bucket & { channel: string | null }>();
    const byChannel = new Map<string, Bucket>();

    for (const r of rows) {
      const campaign = r.signup_utm_campaign ?? "(ללא קמפיין)";
      const channel = r.signup_channel ?? "unknown";

      let c = byCampaign.get(campaign);
      if (!c) {
        c = { ...emptyBucket(), channel: r.signup_channel };
        byCampaign.set(campaign, c);
      }
      tally(c, r);

      let ch = byChannel.get(channel);
      if (!ch) {
        ch = emptyBucket();
        byChannel.set(channel, ch);
      }
      tally(ch, r);
    }

    // Merge signups + visitors, including campaigns that have visitors but no
    // signups yet (a live ad before its first registration).
    const campaignKeys = new Set<string>([...byCampaign.keys(), ...visitorsByCampaign.keys()]);
    const campaigns = [...campaignKeys]
      .map((campaign) => {
        const c = byCampaign.get(campaign);
        return {
          campaign,
          visitors: visitorsByCampaign.get(campaign) ?? 0,
          signups: c?.signups ?? 0,
          approved: c?.approved ?? 0,
          paying: c?.paying ?? 0,
          channel: c?.channel ?? null,
        };
      })
      .sort((a, b) => b.signups - a.signups || b.visitors - a.visitors);
    const channels = [...byChannel.entries()]
      .map(([channel, v]) => ({ channel, ...v }))
      .sort((a, b) => b.signups - a.signups);

    return NextResponse.json({
      ok: true,
      period,
      totalSignups: rows.length,
      campaigns,
      channels,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
