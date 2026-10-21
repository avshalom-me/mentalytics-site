import type { NextRequest } from "next/server";
import { OWNER_VIEWER } from "@/app/lib/schools-crm.server";
import { schoolsGet, schoolsPost } from "@/app/lib/schools-api/schools";

// בתי ספר, אנשי קשר, בעלויות, הדרכות ויומן, לאדמין (/admin/schools). Basic Auth
// ושומר ה-CSRF של ה-middleware מכסים את כל /api/admin-*. הלוגיקה ב-
// app/lib/schools-api/schools.ts, משותפת עם פורטל השותפה.

export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) => schoolsGet(req, OWNER_VIEWER);
export const POST = (req: NextRequest) => schoolsPost(req, OWNER_VIEWER);
