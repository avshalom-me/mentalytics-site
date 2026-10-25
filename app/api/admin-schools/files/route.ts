import type { NextRequest } from "next/server";
import { OWNER_VIEWER } from "@/app/lib/schools-crm.server";
import { filesGet, filesPost } from "@/app/lib/schools-api/workspace";

// הקבצים של ענף בתי הספר (טיוטות ומסמכים), לבעלים. הקבצים עצמם בדלי פרטי.

export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) => filesGet(req);
export const POST = (req: NextRequest) => filesPost(req, OWNER_VIEWER);
