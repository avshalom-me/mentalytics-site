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

function getMaxCount(rows: { count: number }[]): number {
  if (rows.length === 0) return 0;
  return Math.max(...rows.map((r) => r.count));
}

// GET /api/usage/check?type=adults&fp=HASH  — check without incrementing
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  if (!type) return NextResponse.json({ error: "missing type" }, { status: 400 });

  const ip = getIp(req);
  const fp = req.nextUrl.searchParams.get("fp");

  const identifiers = [ip];
  if (fp) identifiers.push(`fp:${fp}`);

  const { data } = await supabase
    .from("quiz_usage")
    .select("count")
    .in("ip", identifiers)
    .eq("quiz_type", type);

  const count = getMaxCount(data ?? []);
  return NextResponse.json({ allowed: count < MAX_FREE, count });
}

// POST /api/usage/check  — increment and return new status
export async function POST(req: NextRequest) {
  const { type, fp } = await req.json();
  if (!type) return NextResponse.json({ error: "missing type" }, { status: 400 });

  const ip = getIp(req);

  const identifiers = [ip];
  if (fp) identifiers.push(`fp:${fp}`);

  const { data: existing } = await supabase
    .from("quiz_usage")
    .select("ip, count")
    .in("ip", identifiers)
    .eq("quiz_type", type);

  const maxCount = getMaxCount(existing ?? []);

  if (maxCount >= MAX_FREE) {
    return NextResponse.json({ allowed: false, count: maxCount });
  }

  const newCount = maxCount + 1;
  const now = new Date().toISOString();

  for (const id of identifiers) {
    await supabase.from("quiz_usage").upsert(
      { ip: id, quiz_type: type, count: newCount, updated_at: now },
      { onConflict: "ip,quiz_type" }
    );
  }

  return NextResponse.json({ allowed: true, count: newCount });
}
