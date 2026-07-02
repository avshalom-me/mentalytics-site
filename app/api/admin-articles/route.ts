import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { sendArticleReviewedEmail } from "@/app/lib/therapist-emails";
import { ARTICLE_TOPICS, ARTICLE_LIMITS, slugify, type ArticleStatus } from "@/app/lib/articles";

export const dynamic = "force-dynamic";

// Auth is enforced by middleware (Basic Auth on /api/admin-*).

// Unsplash's API guidelines require triggering the photo's download_location
// when an image is actually used. Best-effort: never block article creation.
async function triggerUnsplashDownload(downloadLocation: unknown) {
  const loc = typeof downloadLocation === "string" ? downloadLocation : "";
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!loc || !key || !loc.startsWith("https://api.unsplash.com/")) return;
  try {
    await fetch(loc, { headers: { Authorization: `Client-ID ${key}` } });
  } catch {
    /* ignore — attribution ping is not critical to the article */
  }
}

async function uniqueSlug(base: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await supabaseAdmin
      .from("therapist_articles")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

type Joined = { full_name: string | null; email: string | null };
function therapistOf(rel: unknown): Joined {
  const t = Array.isArray(rel) ? rel[0] : rel;
  return {
    full_name: (t as Joined)?.full_name ?? null,
    email: (t as Joined)?.email ?? null,
  };
}

// List every submission grouped by status, newest first, with author name.
// Also returns the list of attributable therapists for the "write an editorial
// article" form (admin authors it, attributes it to a listed therapist).
export async function GET() {
  const [{ data, error }, { data: therapistRows }] = await Promise.all([
    supabaseAdmin
      .from("therapist_articles")
      .select(
        "id, therapist_id, title, slug, summary, body, topic, status, rejection_reason, created_at, approved_at, image_url, image_alt, image_credit, canonical_url, therapists(full_name)"
      )
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("therapists")
      .select("id, full_name")
      .in("status", ["approved", "paying"])
      .eq("admin_approved", true)
      .order("full_name", { ascending: true }),
  ]);

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
    therapists: (therapistRows ?? []).map((t) => ({
      id: t.id,
      full_name: t.full_name ?? "מטפל/ת",
    })),
  });
}

// Create an admin-authored editorial article, attributed to a real listed
// therapist and published immediately (status = approved).
export async function POST(req: NextRequest) {
  let body: {
    therapist_id?: unknown;
    title?: unknown;
    summary?: unknown;
    body?: unknown;
    topic?: unknown;
    image_url?: unknown;
    image_alt?: unknown;
    image_credit?: unknown;
    canonical_url?: unknown;
    download_location?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  const therapistId = typeof body.therapist_id === "string" ? body.therapist_id : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  const articleBody = typeof body.body === "string" ? body.body.trim() : "";
  const topicRaw = typeof body.topic === "string" ? body.topic.trim() : "";
  const topic = (ARTICLE_TOPICS as readonly string[]).includes(topicRaw) ? topicRaw : null;
  const imageUrl = typeof body.image_url === "string" ? body.image_url.trim() : "";
  const imageAlt = typeof body.image_alt === "string" ? body.image_alt.trim() : "";
  const imageCredit = typeof body.image_credit === "string" ? body.image_credit.trim() : "";
  const canonicalUrl = typeof body.canonical_url === "string" ? body.canonical_url.trim() : "";

  if (!therapistId) {
    return NextResponse.json({ ok: false, error: "יש לבחור מטפל/ת לשיוך המאמר" }, { status: 400 });
  }
  if (title.length < ARTICLE_LIMITS.titleMin || title.length > ARTICLE_LIMITS.titleMax) {
    return NextResponse.json(
      { ok: false, error: `הכותרת צריכה להיות בין ${ARTICLE_LIMITS.titleMin} ל-${ARTICLE_LIMITS.titleMax} תווים` },
      { status: 400 }
    );
  }
  if (summary.length > ARTICLE_LIMITS.summaryMax) {
    return NextResponse.json(
      { ok: false, error: `התקציר ארוך מדי (עד ${ARTICLE_LIMITS.summaryMax} תווים)` },
      { status: 400 }
    );
  }
  if (articleBody.length < ARTICLE_LIMITS.bodyMin || articleBody.length > ARTICLE_LIMITS.bodyMax) {
    return NextResponse.json(
      { ok: false, error: `גוף המאמר צריך להיות בין ${ARTICLE_LIMITS.bodyMin} ל-${ARTICLE_LIMITS.bodyMax} תווים` },
      { status: 400 }
    );
  }
  if (imageUrl && !/^https:\/\//.test(imageUrl)) {
    return NextResponse.json({ ok: false, error: "כתובת התמונה חייבת להיות https" }, { status: 400 });
  }
  if (canonicalUrl && !/^https:\/\//.test(canonicalUrl)) {
    return NextResponse.json({ ok: false, error: "כתובת המקור (canonical) חייבת להיות https" }, { status: 400 });
  }

  // The attributed therapist must be a real, publicly-listed therapist.
  const { data: therapist } = await supabaseAdmin
    .from("therapists")
    .select("id, status, admin_approved")
    .eq("id", therapistId)
    .maybeSingle();
  if (!therapist || !therapist.admin_approved || !["approved", "paying"].includes(therapist.status)) {
    return NextResponse.json({ ok: false, error: "המטפל/ת שנבחר/ה אינו/ה זמין/ה לשיוך" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const slug = await uniqueSlug(slugify(title));

  const { data: inserted, error } = await supabaseAdmin
    .from("therapist_articles")
    .insert({
      therapist_id: therapistId,
      title,
      slug,
      summary,
      body: articleBody,
      topic,
      status: "approved",
      approved_at: now,
      reviewed_by: "admin",
      image_url: imageUrl || null,
      image_alt: imageAlt || null,
      image_credit: imageCredit || null,
      canonical_url: canonicalUrl || null,
    })
    .select("id, slug")
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "failed to save article" },
      { status: 500 }
    );
  }

  if (imageUrl) await triggerUnsplashDownload(body.download_location);

  return NextResponse.json({ ok: true, id: inserted.id, slug: inserted.slug });
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
    image_url?: unknown;
    image_alt?: unknown;
    image_credit?: unknown;
    canonical_url?: unknown;
    download_location?: unknown;
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
    if (typeof body.image_url === "string") {
      const u = body.image_url.trim();
      if (u && !/^https:\/\//.test(u)) {
        return NextResponse.json({ ok: false, error: "כתובת התמונה חייבת להיות https" }, { status: 400 });
      }
      update.image_url = u || null;
    }
    if (typeof body.image_alt === "string") update.image_alt = body.image_alt.trim() || null;
    if (typeof body.image_credit === "string") update.image_credit = body.image_credit.trim() || null;
    if (typeof body.canonical_url === "string") {
      const c = body.canonical_url.trim();
      if (c && !/^https:\/\//.test(c)) {
        return NextResponse.json({ ok: false, error: "כתובת המקור (canonical) חייבת להיות https" }, { status: 400 });
      }
      update.canonical_url = c || null;
    }
    const { error } = await supabaseAdmin.from("therapist_articles").update(update).eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (typeof update.image_url === "string") await triggerUnsplashDownload(body.download_location);
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
