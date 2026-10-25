import type { NextRequest } from "next/server";
import { OWNER_VIEWER } from "@/app/lib/schools-crm.server";
import { tasksGet, tasksPatch, tasksPost } from "@/app/lib/schools-api/tasks";

// משימות ענף בתי הספר בלבד (מסך "משימות" ב-CRM המשותף), לבעלים. אותה לוגיקה
// כמו בפורטל השותפה: רק ישויות הענף, ו-mine=1 לפי שם הבעלים.

export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) => tasksGet(req, OWNER_VIEWER);
export const POST = (req: NextRequest) => tasksPost(req, OWNER_VIEWER);
export const PATCH = (req: NextRequest) => tasksPatch(req);
