import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_FREE = 3;

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

// GET /api/usage/check?type=adults  — check without incrementing
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  if (!type) return NextResponse.json({ error: "missing type" }, { status: 400 });

  const ip = getIp(req);
  const { data } = await supabase
    .from("quiz_usage")
    .select("count")
    .eq("ip", ip)
    .eq("quiz_type", type)
    .single();

  const count = data?.count ?? 0;
  return NextResponse.json({ allowed: count < MAX_FREE, count });
}

// POST /api/usage/check  — increment and return new status
export async function POST(req: NextRequest) {
  const { type } = await req.json();
  if (!type) return NextResponse.json({ error: "missing type" }, { status: 400 });

  const ip = getIp(req);

  const { data: existing } = await supabase
    .from("quiz_usage")
    .select("count")
    .eq("ip", ip)
    .eq("quiz_type", type)
    .single();

  if (existing && existing.count >= MAX_FREE) {
    return NextResponse.json({ allowed: false, count: existing.count });
  }

  const newCount = (existing?.count ?? 0) + 1;
  await supabase.from("quiz_usage").upsert(
    { ip, quiz_type: type, count: newCount, updated_at: new Date().toISOString() },
    { onConflict: "ip,quiz_type" }
  );

  return NextResponse.json({ allowed: true, count: newCount });
}
