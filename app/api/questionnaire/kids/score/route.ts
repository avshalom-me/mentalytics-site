import { NextRequest, NextResponse } from "next/server";
import { scoreKidsQuestionnaire } from "@/app/lib/kids-score.server";
import {
  bumpAndCheckIpDaily,
  cleanFp,
  consumeUsage,
  getIp,
  getUsage,
  isStaffBypass,
  MAX_FREE,
} from "@/app/lib/usage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    // Server-side free-tier enforcement — see adults score route.
    const staff = isStaffBypass(body._staffToken);
    const fp = cleanFp(body._fp);
    const ip = getIp(request);

    if (!staff) {
      const usage = await getUsage(ip, fp, "kids");
      if (usage.paymentRequired) {
        return NextResponse.json({ ok: false, paymentRequired: true }, { status: 402 });
      }
      // Coarse per-IP daily backstop, only for genuinely free serves; paid
      // users (limit > MAX_FREE) bypass it. See adults score route.
      if (usage.limit <= MAX_FREE && !(await bumpAndCheckIpDaily(ip))) {
        return NextResponse.json({ ok: false, paymentRequired: true }, { status: 402 });
      }
    }

    const result = scoreKidsQuestionnaire(body);

    if (!staff) {
      await consumeUsage(ip, fp, "kids");
    }

    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
}
