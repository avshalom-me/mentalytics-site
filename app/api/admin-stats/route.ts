import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { fetchAllRows } from "@/app/lib/fetch-all-rows";

export const dynamic = "force-dynamic";

export type Period = "week" | "month" | "all";

export type TherapistStat = {
  id: string;
  full_name: string;
  email: string;
  status: "paying" | "approved";
  whatsapp: number;
  phone: number;
  email_clicks: number;
  site_message: number;
  total: number;
  match_clicks: number;
  directory_clicks: number;
  match_whatsapp: number;
  match_phone: number;
  match_email: number;
  match_site_message: number;
  directory_whatsapp: number;
  directory_phone: number;
  directory_email: number;
  directory_site_message: number;
  profile_views: number;
  match_views: number;
  directory_views: number;
};

export type AdminStatsResponse = {
  ok: true;
  period: Period;
  paying: TherapistStat[];
  free: TherapistStat[];
  generated_at: string;
} | {
  ok: false;
  error: string;
};

function periodToDate(period: Period): string | null {
  if (period === "all") return null;
  const ms = period === "week" ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms).toISOString();
}

export async function GET(req: NextRequest): Promise<NextResponse<AdminStatsResponse>> {
  const period = (req.nextUrl.searchParams.get("period") ?? "all") as Period;
  const validPeriods: Period[] = ["week", "month", "all"];
  const safePeriod: Period = validPeriods.includes(period) ? period : "all";

  // Fetch all active therapists
  const { data: therapists, error: tErr } = await supabaseAdmin
    .from("therapists")
    .select("id, full_name, email, status")
    .in("status", ["paying", "approved"])
    .order("full_name", { ascending: true });

  if (tErr) {
    return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });
  }

  // Fetch clicks + views, paging past the 1000-row cap. profile_views already
  // exceeds 1000 for the default all-time period, which would otherwise freeze
  // every therapist's view/CTR numbers below at a truncated total.
  const since = periodToDate(safePeriod);
  const clicks = await fetchAllRows<{ therapist_id: string; click_type: string; source: string }>(() => {
    let q = supabaseAdmin.from("therapist_contact_clicks").select("therapist_id, click_type, source");
    if (since) q = q.gte("clicked_at", since);
    return q;
  });

  const views = await fetchAllRows<{ therapist_id: string; source: string }>(() => {
    let q = supabaseAdmin.from("therapist_profile_views").select("therapist_id, source");
    if (since) q = q.gte("viewed_at", since);
    return q;
  });

  // Aggregate profile views. match_card rows are CARD IMPRESSIONS in the match
  // results list, not profile entries — the else-branch used to dump them into
  // "directory views", inflating that column ~4x (1,664 impressions vs ~500
  // real directory views). Count only real profile entries, like the rest of
  // admin (analytics / marketing / attribution).
  const viewsMap: Record<string, { total: number; match: number; directory: number }> = {};
  for (const row of views) {
    if (row.source === "match_card") continue;
    if (!viewsMap[row.therapist_id]) viewsMap[row.therapist_id] = { total: 0, match: 0, directory: 0 };
    viewsMap[row.therapist_id].total++;
    if (row.source === "match") viewsMap[row.therapist_id].match++;
    else viewsMap[row.therapist_id].directory++;
  }

  // Aggregate. site_message counts like any other contact type — it used to be
  // in the source splits but missing from the per-type columns and the total,
  // so the columns didn't add up once site messages existed.
  type ClickCounts = {
    whatsapp: number; phone: number; email: number; site_message: number;
    match: number; directory: number;
    match_whatsapp: number; match_phone: number; match_email: number; match_site_message: number;
    directory_whatsapp: number; directory_phone: number; directory_email: number; directory_site_message: number;
  };
  const emptyClickCounts = (): ClickCounts => ({
    whatsapp: 0, phone: 0, email: 0, site_message: 0,
    match: 0, directory: 0,
    match_whatsapp: 0, match_phone: 0, match_email: 0, match_site_message: 0,
    directory_whatsapp: 0, directory_phone: 0, directory_email: 0, directory_site_message: 0,
  });
  const clickMap: Record<string, ClickCounts> = {};
  for (const row of clicks) {
    const c = (clickMap[row.therapist_id] ??= emptyClickCounts());
    if (row.click_type === "whatsapp") c.whatsapp++;
    else if (row.click_type === "phone") c.phone++;
    else if (row.click_type === "email") c.email++;
    else if (row.click_type === "site_message") c.site_message++;

    if (row.source === "match") {
      c.match++;
      if (row.click_type === "whatsapp") c.match_whatsapp++;
      else if (row.click_type === "phone") c.match_phone++;
      else if (row.click_type === "email") c.match_email++;
      else if (row.click_type === "site_message") c.match_site_message++;
    } else {
      // directory + profile (a site message sent from a directory-origin
      // profile page records source='profile') both belong to the directory side.
      c.directory++;
      if (row.click_type === "whatsapp") c.directory_whatsapp++;
      else if (row.click_type === "phone") c.directory_phone++;
      else if (row.click_type === "email") c.directory_email++;
      else if (row.click_type === "site_message") c.directory_site_message++;
    }
  }

  const rows = (therapists ?? []) as { id: string; full_name: string | null; email: string | null; status: string }[];

  const stats: TherapistStat[] = rows.map((t) => {
    const c = clickMap[t.id] ?? emptyClickCounts();
    const v = viewsMap[t.id] ?? { total: 0, match: 0, directory: 0 };
    return {
      id: t.id,
      full_name: t.full_name ?? "",
      email: t.email ?? "",
      status: t.status as "paying" | "approved",
      whatsapp: c.whatsapp,
      phone: c.phone,
      email_clicks: c.email,
      site_message: c.site_message,
      total: c.whatsapp + c.phone + c.email + c.site_message,
      match_clicks: c.match,
      directory_clicks: c.directory,
      match_whatsapp: c.match_whatsapp,
      match_phone: c.match_phone,
      match_email: c.match_email,
      match_site_message: c.match_site_message,
      directory_whatsapp: c.directory_whatsapp,
      directory_phone: c.directory_phone,
      directory_email: c.directory_email,
      directory_site_message: c.directory_site_message,
      profile_views: v.total,
      match_views: v.match,
      directory_views: v.directory,
    };
  });

  return NextResponse.json({
    ok: true,
    period: safePeriod,
    paying: stats.filter((s) => s.status === "paying"),
    free: stats.filter((s) => s.status === "approved"),
    generated_at: new Date().toISOString(),
  });
}
