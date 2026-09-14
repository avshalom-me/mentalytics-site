import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { cleanWorkKinds } from "@/app/lib/staff-work-kinds";

// ניהול צוות ושעות עבודה — מוגן ע"י ה-middleware של האדמין (/api/admin-*).
// GET  ?month=YYYY-MM — כל העובדים + רישומי החודש + סיכומים.
// POST — פעולות ניהול: עובדים (יצירה/עדכון) ורישומי שעות (הוספה/תיקון/מחיקה).

export const dynamic = "force-dynamic";

type SessionRow = {
  id: string;
  staff_id: string;
  clock_in: string;
  clock_out: string | null;
  note: string | null;
  source: string;
};

function minutesOf(s: SessionRow): number {
  if (!s.clock_out) return 0;
  return Math.round((new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()) / 60_000);
}

function parseMonth(raw: string | null): { from: string; to: string; label: string } {
  const m = raw && /^\d{4}-\d{2}$/.test(raw) ? raw : null;
  const now = new Date();
  const year = m ? parseInt(m.slice(0, 4), 10) : now.getFullYear();
  const month = m ? parseInt(m.slice(5, 7), 10) - 1 : now.getMonth();
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 1);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    label: `${year}-${String(month + 1).padStart(2, "0")}`,
  };
}

export async function GET(req: NextRequest) {
  const { from, to, label } = parseMonth(req.nextUrl.searchParams.get("month"));

  try {
    const [staffRes, sessionsRes, openRes] = await Promise.all([
      supabaseAdmin
        .from("staff_members")
        .select("id, full_name, pin, hourly_rate, active, created_at")
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("staff_work_sessions")
        .select("id, staff_id, clock_in, clock_out, note, source, work_kinds")
        .gte("clock_in", from)
        .lt("clock_in", to)
        .order("clock_in", { ascending: false })
        .limit(2000),
      // משמרות פתוחות מוצגות תמיד, גם אם נפתחו בחודש אחר
      supabaseAdmin
        .from("staff_work_sessions")
        .select("id, staff_id, clock_in, clock_out, note, source, work_kinds")
        .is("clock_out", null),
    ]);
    if (staffRes.error) throw staffRes.error;
    if (sessionsRes.error) throw sessionsRes.error;

    const sessions = (sessionsRes.data ?? []) as SessionRow[];
    const openSessions = (openRes.data ?? []) as SessionRow[];

    const employees = (staffRes.data ?? []).map((e) => {
      const own = sessions.filter((s) => s.staff_id === e.id);
      const totalMinutes = own.reduce((sum, s) => sum + minutesOf(s), 0);
      return {
        ...e,
        sessions: own,
        openSession: openSessions.find((s) => s.staff_id === e.id) ?? null,
        monthTotalMinutes: totalMinutes,
      };
    });

    return NextResponse.json({ ok: true, month: label, employees, generated_at: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

function parseTime(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "";

  try {
    if (action === "create_employee" || action === "update_employee") {
      const fullName = typeof body.full_name === "string" ? body.full_name.trim().slice(0, 80) : "";
      const pinRaw = typeof body.pin === "string" ? body.pin.trim() : undefined;
      const hourlyRate =
        body.hourly_rate === null || body.hourly_rate === "" ? null :
        typeof body.hourly_rate === "number" ? body.hourly_rate :
        typeof body.hourly_rate === "string" && body.hourly_rate.trim() !== "" ? Number(body.hourly_rate) : undefined;
      if (pinRaw !== undefined && pinRaw !== "" && !/^\d{4,8}$/.test(pinRaw)) {
        return NextResponse.json({ ok: false, error: "קוד אישי חייב להיות 4-8 ספרות" }, { status: 400 });
      }
      if (hourlyRate !== undefined && hourlyRate !== null && (isNaN(hourlyRate) || hourlyRate < 0)) {
        return NextResponse.json({ ok: false, error: "תעריף שעתי לא תקין" }, { status: 400 });
      }

      if (action === "create_employee") {
        if (!fullName) return NextResponse.json({ ok: false, error: "חסר שם" }, { status: 400 });
        const { error } = await supabaseAdmin.from("staff_members").insert({
          full_name: fullName,
          pin: pinRaw || null,
          hourly_rate: hourlyRate ?? null,
        });
        if (error) {
          if (error.code === "23505") return NextResponse.json({ ok: false, error: "הקוד האישי הזה כבר בשימוש אצל עובד אחר" }, { status: 400 });
          throw error;
        }
        return NextResponse.json({ ok: true });
      }

      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });
      const update: Record<string, unknown> = {};
      if (fullName) update.full_name = fullName;
      if (pinRaw !== undefined) update.pin = pinRaw === "" ? null : pinRaw;
      if (hourlyRate !== undefined) update.hourly_rate = hourlyRate;
      if (typeof body.active === "boolean") update.active = body.active;
      const { error } = await supabaseAdmin.from("staff_members").update(update).eq("id", id);
      if (error) {
        if (error.code === "23505") return NextResponse.json({ ok: false, error: "הקוד האישי הזה כבר בשימוש אצל עובד אחר" }, { status: 400 });
        throw error;
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "add_session" || action === "update_session") {
      const inAt = parseTime(body.clock_in);
      const outAt = parseTime(body.clock_out);
      const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : undefined;
      // אופי העבודה חובה בכל רישום חדש או נערך. הרישומים שנוצרו לפני שהשדה
      // היה קיים נשארים ריקים במסד ואיש לא ממציא להם ערך - אבל ברגע שנוגעים
      // ברישום, צריך לומר מה נעשה בו.
      const workKinds = cleanWorkKinds(body.work_kinds);
      if (!workKinds) {
        return NextResponse.json({ ok: false, error: "יש לבחור לפחות אופי עבודה אחד" }, { status: 400 });
      }

      if (action === "add_session") {
        const staffId = typeof body.staff_id === "string" ? body.staff_id : "";
        if (!staffId || !inAt) return NextResponse.json({ ok: false, error: "חסרים פרטים" }, { status: 400 });
        if (outAt && outAt.getTime() <= inAt.getTime()) {
          return NextResponse.json({ ok: false, error: "שעת היציאה חייבת להיות אחרי הכניסה" }, { status: 400 });
        }
        await supabaseAdmin
          .from("staff_work_sessions")
          .insert({
            staff_id: staffId,
            clock_in: inAt.toISOString(),
            clock_out: outAt ? outAt.toISOString() : null,
            note: note ?? null,
            work_kinds: workKinds,
            source: "admin",
          })
          .throwOnError();
        return NextResponse.json({ ok: true });
      }

      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });
      const update: Record<string, unknown> = { source: "admin", updated_at: new Date().toISOString() };
      if (inAt) update.clock_in = inAt.toISOString();
      if (body.clock_out === null) update.clock_out = null;
      else if (outAt) update.clock_out = outAt.toISOString();
      if (note !== undefined) update.note = note;
      update.work_kinds = workKinds;
      // אימות סדר זמנים גם כשמעדכנים רק צד אחד
      const { data: existing } = await supabaseAdmin
        .from("staff_work_sessions")
        .select("clock_in, clock_out")
        .eq("id", id)
        .single();
      if (!existing) return NextResponse.json({ ok: false, error: "רישום לא נמצא" }, { status: 404 });
      const finalIn = inAt ?? new Date(existing.clock_in as string);
      const finalOut = body.clock_out === null ? null : (outAt ?? (existing.clock_out ? new Date(existing.clock_out as string) : null));
      if (finalOut && finalOut.getTime() <= finalIn.getTime()) {
        return NextResponse.json({ ok: false, error: "שעת היציאה חייבת להיות אחרי הכניסה" }, { status: 400 });
      }
      await supabaseAdmin.from("staff_work_sessions").update(update).eq("id", id).throwOnError();
      return NextResponse.json({ ok: true });
    }

    if (action === "delete_session") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });
      await supabaseAdmin.from("staff_work_sessions").delete().eq("id", id).throwOnError();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
