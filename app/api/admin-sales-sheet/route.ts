import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// דף הכנה פנימי לשיחת מכירה למרכזים. מסמך רגיש (רצפות מחיר, מרווחים,
// אסטרטגיית התמקחות) — לכן הוא לא נשמר בריפו (שהוא ציבורי) אלא ב-bucket
// פרטי ב-Supabase Storage ('internal-docs'), ונמשך כאן דרך service-role.
// הנתיב מתחיל ב-/api/admin- ולכן ה-middleware דורש עליו Basic Auth.
// עדכון הקובץ: מעלים גרסה חדשה של docs/sales-centers.pdf ל-bucket 'internal-docs'.

export const dynamic = "force-dynamic";

const BUCKET = "internal-docs";
const OBJECT = "sales-centers.pdf";

export async function GET() {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(OBJECT);

  if (error || !data) {
    return new NextResponse("Not found", { status: 404 });
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="sales-centers.pdf"',
      // מסמך פנימי — לעולם לא לשמור במטמון משותף/CDN
      "Cache-Control": "no-store, private",
    },
  });
}
