import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { ARTICLE_LIMITS, ARTICLE_TOPICS, slugify } from "@/app/lib/articles";

export const dynamic = "force-dynamic";

// Statuses that may submit articles: any approved therapist (free or paying).
const SUBMIT_STATUSES = ["approved", "paying"];
const MAX_PENDING = 5;

type Therapist = { id: string; status: string };

// Resolve the authenticated therapist from the Bearer token.
async function getTherapist(req: NextRequest): Promise<Therapist | null> {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return null;

  const {
    data: { user },
  } = await createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${auth}` } } }
  ).auth.getUser();
  if (!user) return null;

  const { data } = await supabaseAdmin
    .from("therapists")
    .select("id, status")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as Therapist) ?? null;
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

// List the therapist's own submissions + whether they're allowed to submit.
export async function GET(req: NextRequest) {
  const therapist = await getTherapist(req);
  if (!therapist) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("therapist_articles")
    .select("id, title, slug, topic, summary, status, rejection_reason, created_at, approved_at")
    .eq("therapist_id", therapist.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    canSubmit: SUBMIT_STATUSES.includes(therapist.status),
    status: therapist.status,
    articles: data ?? [],
  });
}

// Create a new article submission (status = pending).
export async function POST(req: NextRequest) {
  const therapist = await getTherapist(req);
  if (!therapist) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!SUBMIT_STATUSES.includes(therapist.status)) {
    return NextResponse.json(
      { ok: false, error: "רק מטפלים מאושרים יכולים לשלוח מאמרים" },
      { status: 403 }
    );
  }

  let body: { title?: unknown; summary?: unknown; body?: unknown; topic?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  const articleBody = typeof body.body === "string" ? body.body.trim() : "";
  const topicRaw = typeof body.topic === "string" ? body.topic.trim() : "";
  const topic = (ARTICLE_TOPICS as readonly string[]).includes(topicRaw) ? topicRaw : null;

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

  // Cap concurrent pending submissions to keep the review queue sane.
  const { count } = await supabaseAdmin
    .from("therapist_articles")
    .select("id", { count: "exact", head: true })
    .eq("therapist_id", therapist.id)
    .eq("status", "pending");
  if ((count ?? 0) >= MAX_PENDING) {
    return NextResponse.json(
      { ok: false, error: "יש לך כבר כמה מאמרים הממתינים לאישור. המתן/י לאישורם לפני שליחת מאמר נוסף." },
      { status: 429 }
    );
  }

  const slug = await uniqueSlug(slugify(title));

  const { data: inserted, error } = await supabaseAdmin
    .from("therapist_articles")
    .insert({
      therapist_id: therapist.id,
      title,
      slug,
      summary,
      body: articleBody,
      topic,
      status: "pending",
    })
    .select("id, slug")
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "failed to save article" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: inserted.id, slug: inserted.slug });
}
