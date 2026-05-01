import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { verifyUnsubscribeToken } from "@/app/lib/unsubscribe-token";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let id: string | null = null;
  let token: string | null = null;

  // Accept both form and JSON for flexibility
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    id = body.id ?? null;
    token = body.token ?? null;
  } else {
    const form = await req.formData();
    id = (form.get("id") as string) ?? null;
    token = (form.get("token") as string) ?? null;
  }

  if (!id || !token) {
    return NextResponse.json({ ok: false, error: "Missing id or token" }, { status: 400 });
  }

  if (!verifyUnsubscribeToken(id, token)) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("therapists")
    .update({ unsubscribed_from_stats: true })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // For form submission, redirect back to confirmation page
  if (!contentType.includes("application/json")) {
    const url = new URL(req.url);
    url.pathname = "/therapists/unsubscribe";
    url.searchParams.set("done", "1");
    return NextResponse.redirect(url, 303);
  }

  return NextResponse.json({ ok: true });
}
