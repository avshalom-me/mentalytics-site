import { NextRequest, NextResponse } from "next/server";
import { resolvePartner } from "@/app/lib/schools-auth.server";
import { schoolsGet, schoolsPost } from "@/app/lib/schools-api/schools";
import { dealsGet, dealsPost } from "@/app/lib/schools-api/deals";
import { licensesGet, licensesPost } from "@/app/lib/schools-api/licenses";
import { overviewGet } from "@/app/lib/schools-api/overview";
import { branchAssignees, notesGet, notesPost, tasksDelete, tasksGet, tasksPatch, tasksPost } from "@/app/lib/schools-api/tasks";

// פורטל השותפה (/partner): כל הנתיבים של ענף בתי הספר תחת כתובת אחת.
// אימות: Bearer של Supabase Auth ושורה פעילה ב-partner_users
// (app/lib/schools-auth.server.ts). בלי זה: 401, והפורטל מחזיר למסך הכניסה.
//
// אותה לוגיקה כמו /api/admin-schools/* (app/lib/schools-api/*), עם צופה
// "partner": בלי התאמת העברות ובלי דף הבנק, בלי הגדרות הענף, ומשימות והערות
// רק של ישויות הענף. שום נתיב כאן לא נוגע במטפלים, במרכזים או בכספי החברה.

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ resource: string }> };

async function handle(method: "GET" | "POST" | "PATCH" | "DELETE", req: NextRequest, ctx: Ctx) {
  const v = await resolvePartner(req);
  if (!v) return NextResponse.json({ ok: false, error: "צריך להתחבר מחדש", auth: true }, { status: 401 });
  const { resource } = await ctx.params;
  switch (`${method} ${resource}`) {
    case "GET me":
      return NextResponse.json({ ok: true, name: v.name, email: v.email });
    case "GET overview":
      return overviewGet(v);
    case "GET schools":
      return schoolsGet(req, v);
    case "POST schools":
      return schoolsPost(req, v);
    case "GET deals":
      return dealsGet(v);
    case "POST deals":
      return dealsPost(req, v);
    case "GET licenses":
      return licensesGet(req, v);
    case "POST licenses":
      return licensesPost(req, v);
    case "GET tasks":
      return tasksGet(req, v);
    case "POST tasks":
      return tasksPost(req, v);
    case "PATCH tasks":
      return tasksPatch(req);
    case "DELETE tasks":
      return tasksDelete(req);
    case "GET notes":
      return notesGet(req);
    case "POST notes":
      return notesPost(req, v);
    case "GET assignees":
      return branchAssignees();
    default:
      return NextResponse.json({ ok: false, error: "לא נמצא" }, { status: 404 });
  }
}

export const GET = (req: NextRequest, ctx: Ctx) => handle("GET", req, ctx);
export const POST = (req: NextRequest, ctx: Ctx) => handle("POST", req, ctx);
export const PATCH = (req: NextRequest, ctx: Ctx) => handle("PATCH", req, ctx);
export const DELETE = (req: NextRequest, ctx: Ctx) => handle("DELETE", req, ctx);
