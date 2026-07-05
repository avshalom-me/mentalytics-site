import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// דיווח שעות לעובדים — API ציבורי המשרת את עמוד הנוכחות /staff.
// זיהוי בקוד אישי (PIN) בלבד: העובד לא חשוף לנתוני אף אחד אחר, וכל פעולה
// מאומתת מחדש מול ה-PIN (אין session). הגבלת קצב לפי IP מקשה על ניחוש קודים.

export const dynamic = "force-dynamic";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

const MAX_SESSION_HOURS = 16; // משמרת ארוכה מזה היא כמעט ודאי טעות הקלדה

type StaffRow = { id: string; full_name: string; active: boolean };

async function findByPin(pin: string): Promise<StaffRow | null> {
  if (!/^\d{4,8}$/.test(pin)) return null;
  const { data } = await supabaseAdmin
    .from("staff_members")
    .select("id, full_name, active")
    .eq("pin", pin)
    .eq("active", true)
    .maybeSingle();
  return (data as StaffRow) ?? null;
}

function parseTime(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// חודש נוכחי לפי שעון ישראל — גבולות החודש לתצוגת העובד.
function monthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

type SessionRow = {
  id: string;
  clock_in: string;
  clock_out: string | null;
  note: string | null;
  source: string;
};

async function buildStatus(staff: StaffRow) {
  const { from, to } = monthRange();
  const [monthRes, openRes] = await Promise.all([
    supabaseAdmin
      .from("staff_work_sessions")
      .select("id, clock_in, clock_out, note, source")
      .eq("staff_id", staff.id)
      .gte("clock_in", from)
      .lt("clock_in", to)
      .order("clock_in", { ascending: false })
      .limit(200),
    supabaseAdmin
      .from("staff_work_sessions")
      .select("id, clock_in")
      .eq("staff_id", staff.id)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const sessions = (monthRes.data ?? []) as SessionRow[];
  const totalMinutes = sessions.reduce((sum, s) => {
    if (!s.clock_out) return sum;
    return sum + Math.round((new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()) / 60_000);
  }, 0);

  return {
    ok: true,
    name: staff.full_name,
    openSession: openRes.data ?? null,
    sessions,
    monthTotalMinutes: totalMinutes,
  };
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "יותר מדי ניסיונות — נסו שוב בעוד דקה" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";
  const staff = await findByPin(pin);
  if (!staff) {
    return NextResponse.json({ ok: false, error: "קוד אישי שגוי" }, { status: 401 });
  }

  const now = new Date();
  const notTooFuture = (d: Date) => d.getTime() <= now.getTime() + 10 * 60_000;

  try {
    if (action === "status") {
      return NextResponse.json(await buildStatus(staff));
    }

    if (action === "clock_in") {
      const at = parseTime(body.at) ?? now;
      if (!notTooFuture(at)) {
        return NextResponse.json({ ok: false, error: "אי אפשר לדווח כניסה עתידית" }, { status: 400 });
      }
      const { data: open } = await supabaseAdmin
        .from("staff_work_sessions")
        .select("id")
        .eq("staff_id", staff.id)
        .is("clock_out", null)
        .limit(1)
        .maybeSingle();
      if (open) {
        return NextResponse.json({ ok: false, error: "יש כבר משמרת פתוחה — יש לדווח יציאה קודם" }, { status: 400 });
      }
      await supabaseAdmin
        .from("staff_work_sessions")
        .insert({ staff_id: staff.id, clock_in: at.toISOString(), source: "self" })
        .throwOnError();
      return NextResponse.json(await buildStatus(staff));
    }

    if (action === "clock_out") {
      const at = parseTime(body.at) ?? now;
      const { data: open } = await supabaseAdmin
        .from("staff_work_sessions")
        .select("id, clock_in")
        .eq("staff_id", staff.id)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!open) {
        return NextResponse.json({ ok: false, error: "אין משמרת פתוחה" }, { status: 400 });
      }
      const inTime = new Date(open.clock_in as string);
      if (at.getTime() <= inTime.getTime()) {
        return NextResponse.json({ ok: false, error: "שעת היציאה חייבת להיות אחרי שעת הכניסה" }, { status: 400 });
      }
      if (at.getTime() - inTime.getTime() > MAX_SESSION_HOURS * 3_600_000) {
        return NextResponse.json({ ok: false, error: `משמרת ארוכה מ-${MAX_SESSION_HOURS} שעות — כנראה טעות. אפשר להזין ידנית או לפנות לאדמין` }, { status: 400 });
      }
      await supabaseAdmin
        .from("staff_work_sessions")
        .update({ clock_out: at.toISOString(), updated_at: now.toISOString() })
        .eq("id", open.id as string)
        .throwOnError();
      return NextResponse.json(await buildStatus(staff));
    }

    if (action === "add_manual") {
      const inAt = parseTime(body.clock_in);
      const outAt = parseTime(body.clock_out);
      const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : null;
      if (!inAt || !outAt) {
        return NextResponse.json({ ok: false, error: "יש למלא שעת כניסה ושעת יציאה" }, { status: 400 });
      }
      if (outAt.getTime() <= inAt.getTime()) {
        return NextResponse.json({ ok: false, error: "שעת היציאה חייבת להיות אחרי שעת הכניסה" }, { status: 400 });
      }
      if (!notTooFuture(inAt) || !notTooFuture(outAt)) {
        return NextResponse.json({ ok: false, error: "אי אפשר לדווח שעות עתידיות" }, { status: 400 });
      }
      if (outAt.getTime() - inAt.getTime() > MAX_SESSION_HOURS * 3_600_000) {
        return NextResponse.json({ ok: false, error: `משמרת ארוכה מ-${MAX_SESSION_HOURS} שעות — כנראה טעות` }, { status: 400 });
      }
      await supabaseAdmin
        .from("staff_work_sessions")
        .insert({
          staff_id: staff.id,
          clock_in: inAt.toISOString(),
          clock_out: outAt.toISOString(),
          note,
          source: "self",
        })
        .throwOnError();
      return NextResponse.json(await buildStatus(staff));
    }

    if (action === "delete") {
      const sessionId = typeof body.session_id === "string" ? body.session_id : "";
      if (!sessionId) {
        return NextResponse.json({ ok: false, error: "רישום לא נמצא" }, { status: 400 });
      }
      // מחיקה רק של רישומים של אותו עובד — לעולם לא של עובד אחר.
      await supabaseAdmin
        .from("staff_work_sessions")
        .delete()
        .eq("id", sessionId)
        .eq("staff_id", staff.id)
        .throwOnError();
      return NextResponse.json(await buildStatus(staff));
    }

    return NextResponse.json({ ok: false, error: "פעולה לא מוכרת" }, { status: 400 });
  } catch (err) {
    console.error("[staff-hours] error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "שגיאה פנימית — נסו שוב" }, { status: 500 });
  }
}
