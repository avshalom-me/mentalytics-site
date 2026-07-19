import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { computeEnrichedStats } from "@/app/lib/therapist-stats";

export const dynamic = "force-dynamic";

async function getTherapistInfo(req: NextRequest): Promise<{ id: string; status: string } | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;

  // Validate token via Supabase auth using the anon key (for user context)
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
  if (error || !user) return null;

  // Strict user_id match only. No claim-by-email here: the dashboard always
  // loads /api/therapist-profile first, which performs the (guarded) claim and
  // links user_id — so by the time stats are requested, the link exists. An
  // email match without that link proves nothing (emails are not verified).
  const { data } = await supabaseAdmin
    .from("therapists")
    .select("id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  return data ? { id: data.id, status: data.status } : null;
}

type ClickRow = { click_type: string; source: string; clicked_at: string };

function sumByType(rows: ClickRow[]) {
  const result = { whatsapp: 0, phone: 0, email: 0, site_message: 0, total: 0 };
  for (const row of rows) {
    if (row.click_type === "whatsapp") result.whatsapp++;
    else if (row.click_type === "phone") result.phone++;
    else if (row.click_type === "email") result.email++;
    else if (row.click_type === "site_message") result.site_message++;
    result.total++;
  }
  return result;
}

function sumBySource(rows: ClickRow[]) {
  const match = rows.filter(r => r.source === "match");
  const directory = rows.filter(r => r.source === "directory");
  return {
    match: sumByType(match),
    directory: sumByType(directory),
  };
}

/** מגמות חודשיות — 6 חודשים אחרונים */
function buildMonthlyTrends(rows: ClickRow[]) {
  const now = new Date();
  const months: { label: string; total: number; match: number; directory: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    const monthRows = rows.filter(r => {
      const t = new Date(r.clicked_at);
      return t >= start && t < end;
    });
    months.push({
      label,
      total: monthRows.length,
      match: monthRows.filter(r => r.source === "match").length,
      directory: monthRows.filter(r => r.source === "directory").length,
    });
  }
  return months;
}

export async function GET(req: NextRequest) {
  const info = await getTherapistInfo(req);
  if (!info) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const isPaying = info.status === "paying";

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  // For trends we need 6 months of data
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const since = isPaying ? sixMonthsAgo : monthAgo;

  const { data, error } = await supabaseAdmin
    .from("therapist_contact_clicks")
    .select("click_type, source, clicked_at")
    .eq("therapist_id", info.id)
    .gte("clicked_at", since.toISOString())
    .order("clicked_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as ClickRow[];
  const monthRows = rows.filter(r => new Date(r.clicked_at) >= monthAgo);
  const weekRows = monthRows.filter(r => new Date(r.clicked_at) >= weekAgo);

  // Basic stats (for all therapists)
  const result: Record<string, unknown> = {
    ok: true,
    week: sumByType(weekRows),
    month: sumByType(monthRows),
  };

  // Enhanced stats (paying only)
  if (isPaying) {
    // Paying dashboards lead with the 6-month picture (rows already span the
    // full fetch window = sixMonthsAgo), then a month toggle — no week view.
    result.half_year = sumByType(rows);
    result.half_year_by_source = sumBySource(rows);
    result.week_by_source = sumBySource(weekRows);
    result.month_by_source = sumBySource(monthRows);
    result.trends = buildMonthlyTrends(rows);

    // Profile views split:
    //   profile_entries = source IN ('match', 'directory') — actual entries into the full profile page
    //   match_impressions = source = 'match_card'        — card impressions in the match-results list
    // Aggregated to two rows so the dashboard can show them side by side.
    try {
      const countViews = (sources: string[], sinceDate: Date) =>
        supabaseAdmin
          .from("therapist_profile_views")
          .select("*", { count: "exact", head: true })
          .eq("therapist_id", info.id)
          .in("source", sources)
          .gte("viewed_at", sinceDate.toISOString());
      const [weekEntries, monthEntries, halfYearEntries, weekImpressions, monthImpressions, halfYearImpressions] =
        await Promise.all([
          countViews(["match", "directory"], weekAgo),
          countViews(["match", "directory"], monthAgo),
          countViews(["match", "directory"], sixMonthsAgo),
          countViews(["match_card"], weekAgo),
          countViews(["match_card"], monthAgo),
          countViews(["match_card"], sixMonthsAgo),
        ]);
      result.profile_views = {
        week: weekEntries.count ?? 0,
        month: monthEntries.count ?? 0,
        half_year: halfYearEntries.count ?? 0,
      };
      result.match_impressions = {
        week: weekImpressions.count ?? 0,
        month: monthImpressions.count ?? 0,
        half_year: halfYearImpressions.count ?? 0,
      };
    } catch {
      result.profile_views = { week: 0, month: 0, half_year: 0 };
      result.match_impressions = { week: 0, month: 0, half_year: 0 };
    }

    // Enriched breakdown (by region / issue / age / gender + conversion)
    try {
      result.enriched = await computeEnrichedStats(info.id, monthAgo);
    } catch {
      // Non-critical — dashboard shows a placeholder if this is absent
    }

    // (The vs-average comparison block was removed per product decision 19/7 —
    // it read as judgmental and the average is skewed by a few heavy profiles.)
  }

  return NextResponse.json(result);
}
