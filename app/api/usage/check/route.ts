import { NextRequest, NextResponse } from "next/server";
import { cleanFp, consumeUsage, getIp, getUsage, isStaffRequest } from "@/app/lib/usage";

// The answer depends on the caller's cookie, so it is never served from a cache.
export const dynamic = "force-dynamic";

// GET /api/usage/check?type=adults&fp=HASH  — check without incrementing.
// Used by the quiz pages on mount to decide whether to show the paywall up
// front. The authoritative enforcement lives in the score routes.
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  if (!type) return NextResponse.json({ error: "missing type" }, { status: 400 });

  // A staff browser - one that has passed the admin gate and carries its cookie
  // (app/lib/staff-cookie.ts) - is never limited and never counted, so the quiz
  // opens for it whatever its device id has used.
  if (await isStaffRequest(req, null)) {
    return NextResponse.json(
      { allowed: true, count: 0, paymentRequired: false, staff: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

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
