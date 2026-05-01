import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("monthly_admin_reports")
    .select("id, month_start, month_end, patient_data, therapist_data, ai_summary, ai_recommendations, ai_silent_therapists_advice, email_status, created_at")
    .order("month_start", { ascending: false })
    .limit(36);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reports: data ?? [] });
}
