import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { sanitizeAttribution } from "@/app/lib/attribution";
import { isBotRequest } from "@/app/lib/bot-detect";
import { rateLimit, clientIp, tooManyRequests } from "@/app/lib/rate-limit";
import { TEACHER_LISTED_STATES } from "@/app/lib/teacher-options";

// אירועים על מורים: הופעה בכרטיס תוצאה, לחיצת וואטסאפ/טלפון, צפייה בפרופיל.
// המקבילה של track-view + track-click למטפלים, בטבלה אחת (teacher_events).
// הופעות נשלחות במנה אחת לכל תוצאות החיפוש; לחיצה - אחת-אחת.

const VALID_TYPES = ["impression", "whatsapp", "phone", "profile_view"] as const;
type EventType = (typeof VALID_TYPES)[number];
const VALID_SOURCES = ["match", "profile"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit("teacher-event", ip, 120, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds, "Too many requests");
  if (isBotRequest(req)) return NextResponse.json({ ok: true, bot: true });

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const eventType = body.event_type as EventType;
    if (!VALID_TYPES.includes(eventType)) return NextResponse.json({ ok: false, error: "Invalid event_type" }, { status: 400 });
    const asked = Array.from(
      new Set(
        (Array.isArray(body.teacher_ids) ? body.teacher_ids : [body.teacher_id])
          .filter((x): x is string => typeof x === "string" && UUID_RE.test(x))
          .slice(0, 20),
      ),
    );
    if (asked.length === 0) return NextResponse.json({ ok: false, error: "Missing teacher_id" }, { status: 400 });
    // רק מורים שמוצגים כרגע. בלי הבדיקה, מזהה אחד של מורה שנמחק/ה מפיל את כל
    // המנה על המפתח הזר (עשר הופעות אובדות), ואפשר לנפח מבחוץ את המספרים של
    // מורה בארכיון - המספרים שמייל יום 85 מצטט.
    const { data: live, error: liveError } = await supabaseAdmin
      .from("teachers")
      .select("id")
      .in("id", asked)
      .in("listing_state", [...TEACHER_LISTED_STATES]);
    if (liveError) return NextResponse.json({ ok: false, error: liveError.message }, { status: 500 });
    const liveIds = new Set((live ?? []).map((r) => String(r.id)));
    const ids = asked.filter((id) => liveIds.has(id));
    if (ids.length === 0) return NextResponse.json({ ok: true, recorded: 0 });
    const source = VALID_SOURCES.includes(body.source as (typeof VALID_SOURCES)[number]) ? (body.source as string) : "match";
    const sessionId = typeof body.session_id === "string" && body.session_id.length <= 128 ? body.session_id : null;
    const quizType = body.quiz_type === "kids" || body.quiz_type === "school" ? (body.quiz_type as string) : null;
    const subject = typeof body.subject === "string" ? body.subject.slice(0, 40) : null;
    const att = sanitizeAttribution(body);

    const rows = ids.map((teacher_id) => ({
      teacher_id,
      event_type: eventType,
      source,
      session_id: sessionId,
      quiz_type: quizType,
      subject,
      channel: att.channel ?? null,
      utm_source: att.utm_source ?? null,
      utm_medium: att.utm_medium ?? null,
      utm_campaign: att.utm_campaign ?? null,
    }));
    const { error } = await supabaseAdmin.from("teacher_events").insert(rows);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, recorded: rows.length });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
}
