import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// פילוח SEO אורגני (/admin/seo). כל החישוב ב-RPC אחד בצד ה-DB
// (admin_seo_overview) - ראו את המתודולוגיה במיגרציה. מוגן ע"י middleware
// האדמין (נתיב /api/admin-*).

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const daysRaw = Number(req.nextUrl.searchParams.get("days"));
    const days = [30, 60, 90].includes(daysRaw) ? daysRaw : 90;
    const { data, error } = await supabaseAdmin.rpc("admin_seo_overview", { p_days: days });
    if (error) throw error;
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
