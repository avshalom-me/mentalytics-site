import { NextRequest, NextResponse } from "next/server";
import { cleanFp, consumeUsage, getIp, getUsage } from "@/app/lib/usage";

// GET /api/usage/check?type=adults&fp=HASH  — check without incrementing.
// Used by the quiz pages on mount to decide whether to show the paywall up
// front. The authoritative enforcement lives in the score routes.
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  if (!type) return NextResponse.json({ error: "missing type" }, { status: 400 });

  const ip = getIp(req);
  const fp = cleanFp(req.nextUrl.searchParams.get("fp"));
  const usage = await getUsage(ip, fp, type);

  return NextResponse.json({
    allowed: usage.allowed,
    count: usage.count,
    paymentRequired: usage.paymentRequired,
  });
}

// POST /api/usage/check — increment and return new status. Retained for
// backward compatibility; the score routes now consume credits directly.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const type = body.type;
  if (!type) return NextResponse.json({ error: "missing type" }, { status: 400 });

  const ip = getIp(req);
  const fp = cleanFp(body.fp);

  const usage = await getUsage(ip, fp, type);
  if (usage.paymentRequired) {
    return NextResponse.json({ allowed: false, count: usage.count, paymentRequired: true });
  }

  await consumeUsage(ip, fp, type);
  return NextResponse.json({ allowed: true, count: usage.count + 1 });
}
