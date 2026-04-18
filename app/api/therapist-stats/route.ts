import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

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

  const { data } = await supabaseAdmin
    .from("therapists")
    .select("id, status")
    .eq("user_id", user.id)
    .single();

  if (!data && user.email) {
    const { data: byEmail } = await supabaseAdmin
      .from("therapists")
      .select("id, status")
      .eq("email", user.email)
      .single();
    return byEmail ? { id: byEmail.id, status: byEmail.status } : null;
  }

  return data ? { id: data.id, status: data.status } : null;
}

type ClickRow = { click_type: string; source: string; clicked_at: string };

function sumByType(rows: ClickRow[]) {
  const result = { whatsapp: 0, phone: 0, email: 0, total: 0 };
  for (const row of rows) {
    if (row.click_type === "whatsapp") result.whatsapp++;
    else if (row.click_type === "phone") result.phone++;
    else if (row.click_type === "email") result.email++;
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
    result.week_by_source = sumBySource(weekRows);
    result.month_by_source = sumBySource(monthRows);
    result.trends = buildMonthlyTrends(rows);

    // Profile views (if table exists)
    try {
      const { count: weekViews } = await supabaseAdmin
        .from("therapist_profile_views")
        .select("*", { count: "exact", head: true })
        .eq("therapist_id", info.id)
        .gte("viewed_at", weekAgo.toISOString());
      const { count: monthViews } = await supabaseAdmin
        .from("therapist_profile_views")
        .select("*", { count: "exact", head: true })
        .eq("therapist_id", info.id)
        .gte("viewed_at", monthAgo.toISOString());
      result.profile_views = { week: weekViews ?? 0, month: monthViews ?? 0 };
    } catch {
      result.profile_views = { week: 0, month: 0 };
    }

    // Comparison: average clicks for paying therapists
    try {
      const { data: allClicks } = await supabaseAdmin
        .from("therapist_contact_clicks")
        .select("therapist_id")
        .gte("clicked_at", monthAgo.toISOString());

      if (allClicks && allClicks.length > 0) {
        const byTherapist = new Map<string, number>();
        for (const c of allClicks) {
          byTherapist.set(c.therapist_id, (byTherapist.get(c.therapist_id) ?? 0) + 1);
        }
        const counts = Array.from(byTherapist.values());
        const avg = Math.round(counts.reduce((a, b) => a + b, 0) / counts.length);
        result.comparison = {
          your_month: monthRows.length,
          avg_month: avg,
          therapist_count: counts.length,
        };
      }
    } catch {
      // comparison not critical
    }
  }

  return NextResponse.json(result);
}
