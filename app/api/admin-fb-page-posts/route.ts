import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { therapistTypeLabel } from "@/app/lib/therapist-options";
import {
  buildPostText,
  campaignFor,
  dayLabel,
  israelDate,
  nextSlots,
  pickArticle,
  postLink,
  SLOT_TIME,
  type PostArticle,
  type PostStatus,
  type QueuedPost,
} from "@/app/lib/fb-page-posts";

// The queue of weekly posts for the company's Facebook page (/admin/fb-page-posts).
// Guarded by the admin Basic-Auth middleware, like every /api/admin-* route. Nothing
// here talks to Facebook: the owner copies each post and schedules it himself.

export const dynamic = "force-dynamic";

type TherapistJoin = { full_name: string | null; therapist_types: string[] | null; gender: string | null; age_groups: string[] | null };
type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  approved_at: string | null;
  therapist_id: string | null;
  author_name: string | null;
  therapists: TherapistJoin | TherapistJoin[] | null;
};
type PostRow = {
  id: string;
  article_id: string;
  planned_on: string;
  post_text: string;
  status: PostStatus;
  scheduled_marked_at: string | null;
};
type FunnelRow = { campaign: string; sessions?: number; quiz_started?: number; viewed_profile?: number; contacting_people?: number };

/** The byline exactly as the article page builds it (house name, else name and profession). */
function toArticle(r: ArticleRow): PostArticle {
  const t = Array.isArray(r.therapists) ? r.therapists[0] : r.therapists;
  const house = r.author_name?.trim() || null;
  const firstType = (t?.therapist_types ?? []).find(Boolean);
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    image_url: r.image_url,
    approved_at: r.approved_at,
    author_key: r.therapist_id ?? house ?? r.id,
    author: house ?? t?.full_name ?? "מטפל/ת",
    role: house || !firstType ? "" : therapistTypeLabel(firstType, t?.gender, t?.age_groups ?? null),
  };
}

async function load() {
  const [articlesRes, postsRes] = await Promise.all([
    supabaseAdmin
      .from("therapist_articles")
      .select("id, slug, title, summary, image_url, approved_at, therapist_id, author_name, therapists(full_name, therapist_types, gender, age_groups)")
      .eq("status", "approved"),
    supabaseAdmin
      .from("fb_page_posts")
      .select("id, article_id, planned_on, post_text, status, scheduled_marked_at")
      .order("planned_on", { ascending: true }),
  ]);
  if (articlesRes.error) throw articlesRes.error;
  if (postsRes.error) throw postsRes.error;
  return {
    articles: ((articlesRes.data ?? []) as unknown as ArticleRow[]).map(toArticle),
    posts: (postsRes.data ?? []) as PostRow[],
  };
}

const toQueue = (posts: PostRow[]): QueuedPost[] =>
  posts.map((p) => ({ article_id: p.article_id, planned_on: p.planned_on, status: p.status }));

async function insertPost(article: PostArticle, plannedOn: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("fb_page_posts")
    .insert({ article_id: article.id, planned_on: plannedOn, post_text: buildPostText(article), status: "planned" });
  // Two tabs filling the same week at once: the unique indexes keep one, the other is a no-op.
  if (error && !/duplicate key/i.test(error.message)) throw error;
}

/** Keep the next WEEKS_AHEAD posting days filled, each with an article not used before. */
async function ensureQueue(): Promise<void> {
  const { articles, posts } = await load();
  const queue = toQueue(posts);
  for (const day of nextSlots(israelDate())) {
    if (posts.some((p) => p.planned_on === day && p.status !== "skipped")) continue;
    const next = pickArticle(articles, queue);
    if (!next) break;
    await insertPost(next, day);
    queue.push({ article_id: next.id, planned_on: day, status: "planned" });
  }
}

/** What the page shows: the coming posts, the last eight weeks with their visits, and what is left. */
async function payload() {
  const { articles, posts } = await load();
  const today = israelDate();
  const since = new Date(`${today}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - 56);
  const sinceIso = since.toISOString().slice(0, 10);

  const { data: funnel } = await supabaseAdmin.rpc("admin_campaign_funnel", { p_since: null });
  const stats = new Map<string, FunnelRow>(
    ((funnel ?? []) as FunnelRow[]).filter((r) => r.campaign?.startsWith("page-")).map((r) => [r.campaign, r])
  );
  const byId = new Map(articles.map((a) => [a.id, a]));
  const used = new Set(posts.map((p) => p.article_id));

  const rows = posts
    .filter((p) => p.status !== "skipped" && p.planned_on >= sinceIso)
    .map((p) => {
      const a = byId.get(p.article_id);
      const s = stats.get(campaignFor(p.planned_on));
      return {
        id: p.id,
        planned_on: p.planned_on,
        day: dayLabel(p.planned_on),
        status: p.status,
        upcoming: p.planned_on > today,
        post_text: p.post_text,
        link: a ? postLink(a.slug, p.planned_on) : null,
        article: a
          ? { title: a.title, slug: a.slug, image_url: a.image_url, author: a.author, has_summary: (a.summary ?? "").trim().length >= 40 }
          : null,
        stats: {
          visits: Number(s?.sessions ?? 0),
          quiz_started: Number(s?.quiz_started ?? 0),
          viewed_profile: Number(s?.viewed_profile ?? 0),
          contacting: Number(s?.contacting_people ?? 0),
        },
      };
    });

  return {
    ok: true,
    slot_time: SLOT_TIME,
    today,
    remaining: articles.filter((a) => !used.has(a.id)).length,
    posts: rows,
  };
}

const fail = (e: unknown, status = 500) =>
  NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status });

export async function GET() {
  try {
    return NextResponse.json(await payload());
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  let body: { action?: string; id?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return fail("בקשה לא תקינה", 400);
  }
  const { action, id } = body;

  try {
    if (action === "ensure") {
      await ensureQueue();
      return NextResponse.json(await payload());
    }

    if (!id) return fail("חסר מזהה פוסט", 400);
    const { data: row, error } = await supabaseAdmin
      .from("fb_page_posts")
      .select("id, article_id, planned_on, status")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!row) return fail("הפוסט לא נמצא", 404);

    if (action === "scheduled" || action === "unscheduled") {
      const scheduled = action === "scheduled";
      const { error: e } = await supabaseAdmin
        .from("fb_page_posts")
        .update({ status: scheduled ? "scheduled" : "planned", scheduled_marked_at: scheduled ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (e) throw e;
      return NextResponse.json(await payload());
    }

    if (action === "text") {
      const text = String(body.text ?? "").trim().slice(0, 3000);
      if (!text) return fail("הטקסט ריק", 400);
      const { error: e } = await supabaseAdmin.from("fb_page_posts").update({ post_text: text, updated_at: new Date().toISOString() }).eq("id", id);
      if (e) throw e;
      return NextResponse.json(await payload());
    }

    if (action === "replace") {
      // Facebook already holds a scheduled post: swapping it here only would split the two.
      if (row.status === "scheduled") return fail("הפוסט מסומן כמתוזמן. קודם לבטל את הסימון, ולמחוק אותו גם בפייסבוק.", 409);
      const { error: e } = await supabaseAdmin.from("fb_page_posts").update({ status: "skipped", updated_at: new Date().toISOString() }).eq("id", id);
      if (e) throw e;
      const { articles, posts } = await load();
      const next = pickArticle(articles, toQueue(posts));
      if (next) await insertPost(next, row.planned_on);
      return NextResponse.json(await payload());
    }

    return fail("פעולה לא מוכרת", 400);
  } catch (e) {
    return fail(e);
  }
}
