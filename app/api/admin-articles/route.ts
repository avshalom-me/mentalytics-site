import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { sendArticleReviewedEmail } from "@/app/lib/therapist-emails";
import { ARTICLE_TOPICS, type ArticleStatus } from "@/app/lib/articles";

export const dynamic = "force-dynamic";

// Auth is enforced by middleware (Basic Auth on /api/admin-*).

type Joined = { full_name: string | null; email: string | null };
function therapistOf(rel: unknown): Joined {
  const t = Array.isArray(rel) ? rel[0] : rel;
  return {
    full_name: (t as Joined)?.full_name ?? null,
    email: (t as Joined)?.email ?? null,
  };
}

// List every submission grouped by status, newest first, with author name.
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("therapist_articles")
    .select(
      "id, therapist_id, title, slug, summary, body, topic, status, rejection_reason, created_at, approved_at, therapists(full_name)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((r) => ({
    ...r,
    therapist_name: therapistOf(r.therapists).full_name,
    therapists: undefined,
  }));

  const byStatus = (s: ArticleStatus) => rows.filter((r) => r.status === s);
  return NextResponse.json({
    ok: true,
    pending: byStatus("pending"),
    approved: byStatus("approved"),
    rejected: byStatus("rejected"),
  });
}

// Approve / reject / edit a submission.
export async function PATCH(req: NextRequest) {
  let body: {
    id?: unknown;
    action?: unknown;
    reason?: unknown;
    title?: unknown;
    summary?: unknown;
    body?: unknown;
    topic?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });
  }

  if (action === "edit") {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.title === "string") update.title = body.title.trim();
    if (typeof body.summary === "string") update.summary = body.summary.trim();
    if (typeof body.body === "string") update.body = body.body.trim();
    if (typeof body.topic === "string") {
      const t = body.topic.trim();
      update.topic = (ARTICLE_TOPICS as readonly string[]).includes(t) ? t : null;
    }
    const { error } = await supabaseAdmin.from("therapist_articles").update(update).eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ ok: false, error: "invalid action" }, { status: 400 });
  }

  const { data: art } = await supabaseAdmin
    .from("therapist_articles")
    .select("id, title, slug, therapists(full_name, email)")
    .eq("id", id)
    .maybeSingle();
  if (!art) {
    return NextResponse.json({ ok: false, error: "article not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const reason = action === "reject" && typeof body.reason === "string" ? body.reason.trim() : null;
  const { error } = await supabaseAdmin
    .from("therapist_articles")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      approved_at: action === "approve" ? now : null,
      rejection_reason: reason,
      reviewed_by: "admin",
      updated_at: now,
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Notify the therapist (best-effort — never fail the review on a mail error).
  const ther = therapistOf((art as { therapists: unknown }).therapists);
  if (ther.email) {
    try {
      await sendArticleReviewedEmail({
        to: ther.email,
        name: ther.full_name ?? "",
        approved: action === "approve",
        title: art.title,
        slug: art.slug,
        reason: reason ?? undefined,
      });
    } catch (mailErr) {
      console.error(
        "admin-articles: review email failed:",
        mailErr instanceof Error ? mailErr.message : mailErr
      );
    }
  }

  return NextResponse.json({ ok: true });
}
