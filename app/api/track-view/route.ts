import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

const VALID_SOURCES = ["match", "directory"] as const;
type Source = (typeof VALID_SOURCES)[number];

// Simple in-memory rate limiter: max 60 views per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 60) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { therapist_id, source } = body ?? {};

    if (!therapist_id || typeof therapist_id !== "string") {
      return NextResponse.json({ ok: false, error: "Missing therapist_id" }, { status: 400 });
    }
    const safeSource: Source = VALID_SOURCES.includes(source as Source) ? source : "directory";

    await supabaseAdmin
      .from("therapist_profile_views")
      .insert({ therapist_id, source: safeSource });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
