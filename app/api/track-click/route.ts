import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { sanitizeAttribution } from "@/app/lib/attribution";

const VALID_TYPES = ["whatsapp", "phone", "email", "site_message"] as const;
const VALID_SOURCES = ["match", "directory"] as const;
type ClickType = (typeof VALID_TYPES)[number];
type Source = (typeof VALID_SOURCES)[number];

// Simple in-memory rate limiter: max 30 clicks per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 30) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { therapist_id, click_type, source } = body ?? {};

    if (!therapist_id || typeof therapist_id !== "string") {
      return NextResponse.json({ ok: false, error: "Missing therapist_id" }, { status: 400 });
    }
    if (!VALID_TYPES.includes(click_type as ClickType)) {
      return NextResponse.json({ ok: false, error: "Invalid click_type" }, { status: 400 });
    }
    const safeSource: Source = VALID_SOURCES.includes(source as Source) ? source : "directory";

    const { error } = await supabaseAdmin
      .from("therapist_contact_clicks")
      .insert({ therapist_id, click_type, source: safeSource, ...sanitizeAttribution(body) });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
}
