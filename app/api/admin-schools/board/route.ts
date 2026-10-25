import type { NextRequest } from "next/server";
import { OWNER_VIEWER } from "@/app/lib/schools-crm.server";
import { boardGet, boardPost } from "@/app/lib/schools-api/workspace";

// לוח העבודה של ענף בתי הספר (פתקים, החלטות, נוסחים, קישורים ותזכורות), לבעלים.

export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) => boardGet(req, OWNER_VIEWER);
export const POST = (req: NextRequest) => boardPost(req, OWNER_VIEWER);
