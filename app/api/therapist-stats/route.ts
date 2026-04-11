import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function getTherapistId(req: NextRequest): Promise<string | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data } = await supabaseAdmin
    .from("therapists")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!data && user.email) {
    const { data: byEmail } = await supabaseAdmin
      .from("therapists")
      .select("id")
      .eq("email", user.email)
      .single();
    return byEmail?.id ?? null;
  }

  return data?.id ?? null;
}

function sumByType(rows: { click_type: string }[]) {
  const result = { whatsapp: 0, phone: 0, email: 0, total: 0 };
  for (const row of rows) {
    if (row.click_type === "whatsapp") result.whatsapp++;
    else if (row.click_type === "phone") result.phone++;
    else if (row.click_type === "email") result.email++;
    result.total++;
  }
  return result;
}

export async function GET(req: NextRequest) {
  const therapistId = await getTherapistId(req);
  if (!therapistId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabaseAdmin
    .from("therapist_contact_clicks")
    .select("click_type, clicked_at")
    .eq("therapist_id", therapistId)
    .gte("clicked_at", monthAgo.toISOString())
    .order("clicked_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as { click_type: string; clicked_at: string }[];
  const weekRows = rows.filter((r) => new Date(r.clicked_at) >= weekAgo);

  return NextResponse.json({
    ok: true,
    week: sumByType(weekRows),
    month: sumByType(rows),
  });
}
