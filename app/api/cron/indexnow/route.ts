import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { changedWithin, submitToIndexNow } from "@/app/lib/indexnow";
import sitemap from "@/app/sitemap";

// Once a day, at 23:50 UTC (vercel.json): tell Bing which addresses in the
// sitemap changed that day - see app/lib/indexnow.ts for why.
//
// The window is 26 hours and the hour is the end of the UTC day on purpose. A
// page whose lastmod is a bare date reads as that day's midnight. The run at
// 23:50 that day looks back to 21:50 the evening before and catches it; the
// run a day later looks back only to 21:50 of the day itself, so the same date
// is not sent twice. A page stamped by the database (a new profile, an edited
// article) is caught by whichever run follows it.
//
// ?dry=1 reports what would be sent without sending; ?all=1 sends every
// address in the sitemap, for the first run or after a long outage.
const WINDOW_HOURS = 26;

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const params = req.nextUrl.searchParams;
  const dry = params.get("dry") === "1";
  const all = params.get("all") === "1";

  const entries = (await sitemap()).map((e) => ({ url: String(e.url), lastModified: e.lastModified }));
  const urls = all ? entries.map((e) => e.url) : changedWithin(entries, WINDOW_HOURS);

  if (dry || urls.length === 0) {
    return NextResponse.json({ ok: true, dry, inSitemap: entries.length, changed: urls.length, sample: urls.slice(0, 5) });
  }
  const result = await submitToIndexNow(urls);
  return NextResponse.json(
    { ok: result.ok, inSitemap: entries.length, changed: urls.length, submitted: result.submitted, statuses: result.statuses },
    { status: result.ok ? 200 : 502 }
  );
}
