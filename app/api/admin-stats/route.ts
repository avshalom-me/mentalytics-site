import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export type TherapistStat = {
  id: string;
  full_name: string;
  email: string;
  status: "paying" | "approved";
  whatsapp: number;
  phone: number;
  email_clicks: number;
  total: number;
};

export type AdminStatsResponse = {
  ok: true;
  paying: TherapistStat[];
  free: TherapistStat[];
  generated_at: string;
} | {
  ok: false;
  error: string;
};

export async function GET(): Promise<NextResponse<AdminStatsResponse>> {
  // Fetch all active therapists
  const { data: therapists, error: tErr } = await supabaseAdmin
    .from("therapists")
    .select("id, full_name, email, status")
    .in("status", ["paying", "approved"])
    .order("full_name", { ascending: true });

  if (tErr) {
    return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });
  }

  // Fetch all-time clicks — gracefully handle missing table
  const { data: clicks } = await supabaseAdmin
    .from("therapist_contact_clicks")
    .select("therapist_id, click_type");

  // Aggregate clicks per therapist (clicks may be null if table doesn't exist yet)
  const clickMap: Record<string, { whatsapp: number; phone: number; email: number }> = {};
  for (const row of (clicks ?? []) as { therapist_id: string; click_type: string }[]) {
    if (!clickMap[row.therapist_id]) {
      clickMap[row.therapist_id] = { whatsapp: 0, phone: 0, email: 0 };
    }
    if (row.click_type === "whatsapp") clickMap[row.therapist_id].whatsapp++;
    else if (row.click_type === "phone") clickMap[row.therapist_id].phone++;
    else if (row.click_type === "email") clickMap[row.therapist_id].email++;
  }

  const rows = (therapists ?? []) as { id: string; full_name: string | null; email: string | null; status: string }[];

  const stats: TherapistStat[] = rows.map((t) => {
    const c = clickMap[t.id] ?? { whatsapp: 0, phone: 0, email: 0 };
    return {
      id: t.id,
      full_name: t.full_name ?? "",
      email: t.email ?? "",
      status: t.status as "paying" | "approved",
      whatsapp: c.whatsapp,
      phone: c.phone,
      email_clicks: c.email,
      total: c.whatsapp + c.phone + c.email,
    };
  });

  return NextResponse.json({
    ok: true,
    paying: stats.filter((s) => s.status === "paying"),
    free: stats.filter((s) => s.status === "approved"),
    generated_at: new Date().toISOString(),
  });
}
