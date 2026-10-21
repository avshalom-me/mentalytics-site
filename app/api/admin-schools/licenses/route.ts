import type { NextRequest } from "next/server";
import { OWNER_VIEWER } from "@/app/lib/schools-crm.server";
import { licensesGet, licensesPost } from "@/app/lib/schools-api/licenses";

// רישיונות, תשלומים והתאמת העברות, לאדמין (/admin/schools/payments). הלוגיקה
// ב-app/lib/schools-api/licenses.ts, משותפת עם פורטל השותפה.

export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) => licensesGet(req, OWNER_VIEWER);
export const POST = (req: NextRequest) => licensesPost(req, OWNER_VIEWER);
