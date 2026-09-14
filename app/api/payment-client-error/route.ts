import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// איתות תקלת-תשלום מצד הלקוח. שני אירועי "יש תקלה" אצל לקוחות אמיתיים לא
// השאירו שום עקבות בשרת - הכשל קרה בדפדפן (למשל חוסם פרסומות שחוסם את
// api.sumit.co.il), והטופס בלע אותו להודעה גנרית. כל ענף כשל בטופס שולח
// לכאן דיווח קטן, כך שבאירוע הבא רואים מיד את השלב ואת ההודעה.

export const dynamic = "force-dynamic";

const rl = new Map<string, { count: number; resetAt: number }>();
function allowed(ip: string): boolean {
  const now = Date.now();
  const e = rl.get(ip);
  if (!e || now > e.resetAt) {
    rl.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (e.count >= 10) return false;
  e.count++;
  return true;
}

const STAGES = new Set(["config", "tokenize", "subscribe", "exception"]);
const SOURCES = new Set(["center_join", "quiz", "gift_join"]);

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!allowed(ip)) return NextResponse.json({ ok: true }); // שקט - אין מה להפציץ

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const source = typeof body.source === "string" && SOURCES.has(body.source) ? body.source : "center_join";
  const stage = typeof body.stage === "string" && STAGES.has(body.stage) ? body.stage : "exception";
  const message = typeof body.message === "string" ? body.message.slice(0, 300) : null;
  const refPrefix = typeof body.ref === "string" ? body.ref.slice(0, 8) : null;

  await supabaseAdmin.from("client_payment_errors").insert({
    source,
    stage,
    message,
    ref_prefix: refPrefix,
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 250),
  });
  return NextResponse.json({ ok: true });
}
