import type { NextRequest } from "next/server";
import { OWNER_VIEWER } from "@/app/lib/schools-crm.server";
import { planGet, planPost } from "@/app/lib/schools-api/workspace";

// התוכנית השנתית של ענף בתי הספר (הגנט), לבעלים. אותה לוגיקה כמו בפורטל השותפה.

export const dynamic = "force-dynamic";

export const GET = () => planGet();
export const POST = (req: NextRequest) => planPost(req, OWNER_VIEWER);
