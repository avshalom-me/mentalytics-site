import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { verifyUnsubscribeToken } from "@/app/lib/unsubscribe-token";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let id: string | null = null;
  let token: string | null = null;
  let type: string | null = null;

  // Accept both form and JSON for flexibility
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    id = body.id ?? null;
    token = body.token ?? null;
    type = body.type ?? null;
  } else {
    const form = await req.formData();
    id = (form.get("id") as string) ?? null;
    token = (form.get("token") as string) ?? null;
    type = (form.get("type") as string) ?? null;
  }

  if (!id || !token) {
    return NextResponse.json({ ok: false, error: "Missing id or token" }, { status: 400 });
  }

  // "newsletter" removes the recipient from the marketing list; anything else
  // (including legacy links that carry no type) is the monthly stats report.
  const isNewsletter = type === "newsletter";
  const purpose = isNewsletter ? "newsletter" : "";

  if (!verifyUnsubscribeToken(id, token, purpose)) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 403 });
  }

  if (isNewsletter) {
    // Flip the denormalized "current status" so they drop out of the send segment.
    const { error: updErr } = await supabaseAdmin
      .from("therapists")
      .update({ newsletter_consent: false })
      .eq("id", id);

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }

    // Record the withdrawal as an immutable audit row (best-effort — the status
    // flip above is what actually stops the mail).
    const { data: t } = await supabaseAdmin
      .from("therapists")
      .select("email")
      .eq("id", id)
      .single();

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;

    await supabaseAdmin.from("consent_events").insert({
      therapist_id: id,
      email: t?.email ?? "",
      consent_type: "newsletter",
      action: "withdrawn",
      source: "email_unsubscribe_link",
      ip,
      user_agent: req.headers.get("user-agent") || null,
    });
  } else {
    const { error } = await supabaseAdmin
      .from("therapists")
      .update({ unsubscribed_from_stats: true })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }

  // For form submission, redirect back to confirmation page
  if (!contentType.includes("application/json")) {
    const url = new URL(req.url);
    url.pathname = "/therapists/unsubscribe";
    url.searchParams.set("done", "1");
    if (isNewsletter) url.searchParams.set("type", "newsletter");
    return NextResponse.redirect(url, 303);
  }

  return NextResponse.json({ ok: true });
}
