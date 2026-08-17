import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { agentEnabled } from "@/app/lib/agent-infra";
import { runSupplyGaps } from "@/app/lib/supply-gaps";

// סוכן פערי ההיצע - ריצה שבועית (ראשון 05:30 UTC). אין דפוס send=confirm
// כי הסוכן לא שולח דבר ולא מקדם אף אחד: הוא כותב הצעות לתור, והשליחה
// והקידום נעשים על ידך אחרי אישור.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!agentEnabled("supply_gaps")) {
    return NextResponse.json({ ok: true, disabled: true });
  }

  const result = await runSupplyGaps();
  return NextResponse.json(
    {
      ok: result.ok,
      gift_gaps: result.giftGaps.map((g) => ({ region: g.region, treatment: g.treatment, events: g.events })),
      recruit_gaps: result.recruitGaps.map((g) => ({ region: g.region, treatment: g.treatment, events: g.events })),
      error: result.error,
    },
    { status: result.ok ? 200 : 500 }
  );
}
