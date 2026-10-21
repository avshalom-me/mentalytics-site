import { OWNER_VIEWER } from "@/app/lib/schools-crm.server";
import { overviewGet } from "@/app/lib/schools-api/overview";

// "מבט על" של ענף בתי הספר, לבעלים. הלוגיקה ב-app/lib/schools-api/overview.ts,
// משותפת עם פורטל השותפה.

export const dynamic = "force-dynamic";

export const GET = () => overviewGet(OWNER_VIEWER);
