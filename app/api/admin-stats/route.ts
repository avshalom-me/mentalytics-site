import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

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
  total: number;
  match_clicks: number;
  directory_clicks: number;
  match_whatsapp: number;
  match_phone: number;
  match_email: number;
  directory_whatsapp: number;
  directory_phone: number;
  directory_email: number;
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

  // Fetch clicks, filtered by period if needed
  const since = periodToDate(safePeriod);
  let query = supabaseAdmin
    .from("therapist_contact_clicks")
    .select("therapist_id, click_type, source");
  if (since) query = query.gte("clicked_at", since);

  const { data: clicks } = await query;

  // Aggregate
  type ClickCounts = {
    whatsapp: number; phone: number; email: number;
    match: number; directory: number;
    match_whatsapp: number; match_phone: number; match_email: number;
    directory_whatsapp: number; directory_phone: number; directory_email: number;
  };
  const clickMap: Record<string, ClickCounts> = {};
  for (const row of (clicks ?? []) as { therapist_id: string; click_type: string; source: string }[]) {
    if (!clickMap[row.therapist_id]) {
      clickMap[row.therapist_id] = {
        whatsapp: 0, phone: 0, email: 0,
        match: 0, directory: 0,
        match_whatsapp: 0, match_phone: 0, match_email: 0,
        directory_whatsapp: 0, directory_phone: 0, directory_email: 0,
      };
    }
    const c = clickMap[row.therapist_id];
    if (row.click_type === "whatsapp") c.whatsapp++;
    else if (row.click_type === "phone") c.phone++;
    else if (row.click_type === "email") c.email++;

    if (row.source === "match") {
      c.match++;
      if (row.click_type === "whatsapp") c.match_whatsapp++;
      else if (row.click_type === "phone") c.match_phone++;
      else if (row.click_type === "email") c.match_email++;
    } else {
      c.directory++;
      if (row.click_type === "whatsapp") c.directory_whatsapp++;
      else if (row.click_type === "phone") c.directory_phone++;
      else if (row.click_type === "email") c.directory_email++;
    }
  }

  const rows = (therapists ?? []) as { id: string; full_name: string | null; email: string | null; status: string }[];

  const stats: TherapistStat[] = rows.map((t) => {
    const c = clickMap[t.id] ?? {
      whatsapp: 0, phone: 0, email: 0,
      match: 0, directory: 0,
      match_whatsapp: 0, match_phone: 0, match_email: 0,
      directory_whatsapp: 0, directory_phone: 0, directory_email: 0,
    };
    return {
      id: t.id,
      full_name: t.full_name ?? "",
      email: t.email ?? "",
      status: t.status as "paying" | "approved",
      whatsapp: c.whatsapp,
      phone: c.phone,
      email_clicks: c.email,
      total: c.whatsapp + c.phone + c.email,
      match_clicks: c.match,
      directory_clicks: c.directory,
      match_whatsapp: c.match_whatsapp,
      match_phone: c.match_phone,
      match_email: c.match_email,
      directory_whatsapp: c.directory_whatsapp,
      directory_phone: c.directory_phone,
      directory_email: c.directory_email,
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
