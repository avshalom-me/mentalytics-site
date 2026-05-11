import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STALE_HOURS = 24;

function verifyCron(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Marks payments stuck in 'pending' for more than STALE_HOURS as 'failed'.
// A payment is 'pending' once we've inserted the row and called Sumit —
// but the user may have closed the tab before paying, never returned, etc.
// Without cleanup, these accumulate forever.
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "server misconfigured" }, { status: 503 });
  }
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("payments")
    .update({ status: "failed" })
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .select("id");

  if (error) {
    console.error("cleanup-pending-payments error:", error);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }

  return NextResponse.json({ expired: data?.length ?? 0 });
}
