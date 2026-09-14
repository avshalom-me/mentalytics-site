import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { agentEnabled } from "@/app/lib/agent-infra";
import { runCenterProspects } from "@/app/lib/center-prospects";

// סוכן איתור המכונים - ריצה שבועית. בונה ומרענן את רשימת המועמדים, ולא
// שולח דבר: מייל למכון יוצא רק מבקשה מפורשת שלך על מרכז מסוים.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!agentEnabled("center_prospects")) {
    return NextResponse.json({ ok: true, disabled: true });
  }
  const r = await runCenterProspects();
  return NextResponse.json(
    {
      ok: r.ok,
      places_configured: r.placesConfigured,
      found: r.found,
      refreshed: r.refreshed,
      warm_leads: r.warmLeads,
      calls: r.calls,
      errors: r.errors.slice(0, 10),
      error: r.error,
    },
    { status: r.ok ? 200 : 500 }
  );
}
