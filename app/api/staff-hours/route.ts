import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { rateLimit, clientIp, tooManyRequests } from "@/app/lib/rate-limit";
import { lockedOut, recordFailure } from "@/app/lib/failed-attempts";
import { underDailyCap } from "@/app/lib/daily-cap";

// דיווח שעות לעובדים — API ציבורי המשרת את עמוד הנוכחות /staff.
// זיהוי בקוד אישי (PIN) בלבד: העובד לא חשוף לנתוני אף אחד אחר, וכל פעולה
// מאומתת מחדש מול ה-PIN (אין session).
//
// הגנה מניחוש (13/10/2026): עד אז הבלם היחיד היה 20 בקשות בדקה לכתובת, וקוד
// של 4 ספרות (10,000 אפשרויות) נופל כך בתוך שעות. עכשיו נספרים רק קודים
// שגויים: חמישה מאותה כתובת נועלים אותה לרבע שעה, ו-30 מכל הכתובות יחד
// נועלים את הנתיב לשעה. מי שמקליד את הקוד הנכון לא מרגיש בזה.

export const dynamic = "force-dynamic";

const REQUESTS_PER_MINUTE = 20;
const WRONG_PINS_PER_ADDRESS = 5;
const ADDRESS_LOCK_MS = 15 * 60_000;
const WRONG_PINS_SITE_WIDE = 30;
const SITE_LOCK_MS = 60 * 60_000;
// המונים למעלה חיים בזיכרון של instance אחד, ומנחש שמפוזר על כמה instances
// מאפס אותם. התקציב היומי הזה נספר במסד (daily_counters) ולכן מחזיק בכולם:
// 60 קודים שגויים ביום לכל האתר, ואחריהם כל קוד שגוי נוסף נענה בנעילה. קוד נכון
// עובר תמיד, כך שעובד/ת שמקליד/ה נכון לא נפגע/ת; 60 ניחושים ביום מול 10,000
// אפשרויות הם חודשים של עבודה (19/10/2026).
const WRONG_PINS_PER_DAY = 60;

const LOCKED_MESSAGE = "יותר מדי ניסיונות שגויים - נסו שוב מאוחר יותר";

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
  const ip = clientIp(req);
  const pace = rateLimit("staff-hours", ip, REQUESTS_PER_MINUTE, 60_000);
  if (!pace.ok) {
    return tooManyRequests(pace.retryAfterSeconds, "יותר מדי ניסיונות - נסו שוב בעוד דקה");
  }
  if (lockedOut("staff-pin", ip, WRONG_PINS_PER_ADDRESS) || lockedOut("staff-pin-all", "all", WRONG_PINS_SITE_WIDE)) {
    return NextResponse.json({ ok: false, error: LOCKED_MESSAGE }, { status: 429 });
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
    recordFailure("staff-pin", ip, ADDRESS_LOCK_MS);
    recordFailure("staff-pin-all", "all", SITE_LOCK_MS);
    if (!(await underDailyCap("staff-pin-wrong", WRONG_PINS_PER_DAY))) {
      return NextResponse.json({ ok: false, error: LOCKED_MESSAGE }, { status: 429 });
    }
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
