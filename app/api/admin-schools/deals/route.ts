import type { NextRequest } from "next/server";
import { OWNER_VIEWER } from "@/app/lib/schools-crm.server";
import { dealsGet, dealsPost } from "@/app/lib/schools-api/deals";

// עסקאות ענף בתי הספר, לאדמין. הלוגיקה ב-app/lib/schools-api/deals.ts, משותפת
// עם פורטל השותפה.

export const dynamic = "force-dynamic";

export const GET = () => dealsGet(OWNER_VIEWER);
export const POST = (req: NextRequest) => dealsPost(req, OWNER_VIEWER);
