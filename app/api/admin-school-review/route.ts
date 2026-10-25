import type { NextRequest } from "next/server";
import { reviewGet, reviewPost } from "@/app/lib/schools-api/review";

// The owner's side of the /school review mode - behind the admin middleware
// (/api/admin-*). The screen is "תיקוני השאלון" in the schools CRM; the partner
// reaches the same logic through /api/partner-schools/review.

export const dynamic = "force-dynamic";

export const GET = () => reviewGet();
export const POST = (req: NextRequest) => reviewPost(req);
