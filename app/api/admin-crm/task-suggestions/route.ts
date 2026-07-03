import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { REGION_CITIES } from "@/app/lib/regions";
import { regionsCovered } from "@/app/lib/match-fallback";

// Rule-based task suggestions computed from live CRM data + business-plan
// milestones. No AI, no cost: each rule is a deterministic query with a
// stable key, so accepting/dismissing (stored in crm_suggestion_state)
// permanently settles that instance.

export type TaskSuggestion = {
  key: string;
  title: string;
  reason: string;
  due_date: string | null;
  priority: "low" | "normal" | "high";
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
};

// Business-plan milestones (v3, launch 11.6.2026). Shown from 30 days before
// their date until dismissed/accepted.
const PLAN_MILESTONES: Array<Omit<TaskSuggestion, "entity_type" | "entity_id" | "entity_label">> = [
  {
    key: "plan-schools-2026-07",
    title: "להתחיל פניות לבתי ספר ומוסדות חינוך",
    reason: "אבן דרך בתוכנית העסקית: כניסה לבתי ספר מ-11.7. כדאי לפתוח עסקה בקנבן לכל מוסד.",
    due_date: "2026-07-11",
    priority: "high",
  },
  {
    key: "plan-teachers-2026-07",
    title: "להתחיל גיוס מורים מקצועיים",
    reason: "התוכנית מציבה יעד של 20 מורים עד ספטמבר ו-200 עד אפריל 2027 (₪880/חודש).",
    due_date: "2026-07-11",
    priority: "high",
  },
  {
    key: "plan-psych-deal-2026-09",
    title: "לקדם את עסקת שילוב הפסיכולוגים",
    reason: "אבן דרך בתוכנית: עסקה בשווי ₪50,000 מתוכננת לספטמבר–אוקטובר.",
    due_date: "2026-09-01",
    priority: "normal",
  },
  {
    key: "plan-seo-review-2026-11",
    title: "לבחון את פירות ה-SEO האורגני",
    reason: "אבן דרך בתוכנית לנובמבר: 4–6 חודשים מההשקה — עמוד ראשון בגוגל ולידים אורגניים.",
    due_date: "2026-11-01",
    priority: "normal",
  },
];

function daysFromNow(iso: string): number {
  return Math.ceil((new Date(iso + "T00:00:00Z").getTime() - Date.now()) / 86400000);
}

export async function GET() {
  try {
    const [therapistsRes, articlesRes, subsRes, stateRes] = await Promise.all([
      supabaseAdmin
        .from("therapists")
        .select("id, full_name, status, admin_approved, regions, promotion_source"),
      supabaseAdmin.from("therapist_articles").select("therapist_id"),
      supabaseAdmin
        .from("subscriptions")
        .select("therapist_id, status, promo_reverts_at")
        .eq("status", "active"),
      supabaseAdmin.from("crm_suggestion_state").select("key"),
    ]);

    const therapists = therapistsRes.data ?? [];
    const settled = new Set((stateRes.data ?? []).map((s) => s.key));
    const hasArticle = new Set((articlesRes.data ?? []).map((a) => a.therapist_id));
    const named = (t: { full_name: string | null }) => !!(t.full_name ?? "").trim();

    const listed = therapists.filter(
      (t) => named(t) && (t.status === "approved" || (t.status === "paying" && t.admin_approved))
    );
    const paying = listed.filter((t) => t.status === "paying");
    const free = listed.filter((t) => t.status === "approved");

    const suggestions: TaskSuggestion[] = [];

    // ── Rule 1: regions with thin coverage → talk to therapy centers there ──
    // therapists.regions stores CITY entries — regionsCovered() maps each
    // city to its region (the same helper the matching fallback uses).
    const regionCount: Record<string, number> = {};
    for (const region of Object.keys(REGION_CITIES)) regionCount[region] = 0;
    for (const t of listed) {
      for (const region of regionsCovered(t.regions ?? [])) {
        if (region in regionCount) regionCount[region] += 1;
      }
    }
    const thin = Object.entries(regionCount)
      .filter(([, n]) => n < 3)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3);
    for (const [region, n] of thin) {
      suggestions.push({
        key: `centers-${region}`,
        title: `לפנות למרכזים טיפוליים באזור ${region}`,
        reason: `כיסוי דליל: רק ${n} מטפלים פעילים באזור. מרכז אחד מוסיף עשרות מטפלים בבת אחת.`,
        due_date: null,
        priority: "normal",
        entity_type: null,
        entity_id: null,
        entity_label: null,
      });
    }

    // ── Rule 2: paying therapists without an article → organic-SEO outreach ──
    const noArticle = paying.filter((t) => !hasArticle.has(t.id)).slice(0, 3);
    for (const t of noArticle) {
      suggestions.push({
        key: `article-${t.id}`,
        title: `להציע ל${t.full_name} לכתוב מאמר`,
        reason: "מטפל/ת במסלול בתשלום בלי מאמר — מאמר מקדם גם את הפרופיל שלו/ה וגם את ה-SEO של האתר.",
        due_date: null,
        priority: "normal",
        entity_type: "therapist",
        entity_id: t.id,
        entity_label: t.full_name ?? "",
      });
    }

    // ── Rule 3: engaged free therapists → paid-plan upsell ──
    const freeIds = free.map((t) => t.id);
    if (freeIds.length > 0) {
      const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: engagement } = await supabaseAdmin.rpc("admin_engagement_counts", {
        ids: freeIds,
        since: monthAgo,
      });
      if (Array.isArray(engagement)) {
        const byViews = (engagement as Array<{ therapist_id: string; views_30d: number | string }>)
          .map((e) => ({ id: e.therapist_id, views: Number(e.views_30d) || 0 }))
          .filter((e) => e.views >= 10)
          .sort((a, b) => b.views - a.views)
          .slice(0, 3);
        for (const e of byViews) {
          const t = free.find((x) => x.id === e.id);
          if (!t) continue;
          suggestions.push({
            key: `upsell-${t.id}`,
            title: `להציע ל${t.full_name} מסלול בתשלום`,
            reason: `${e.views} צפיות בפרופיל בחודש האחרון במסלול החינמי — ביקוש שמצדיק שדרוג.`,
            due_date: null,
            priority: "normal",
            entity_type: "therapist",
            entity_id: t.id,
            entity_label: t.full_name ?? "",
          });
        }
      }
    }

    // ── Rule 4: promo price reverting soon → retention call ──
    const nameById = new Map(therapists.map((t) => [t.id, t.full_name ?? ""]));
    for (const s of subsRes.data ?? []) {
      if (!s.promo_reverts_at) continue;
      const days = daysFromNow(s.promo_reverts_at.slice(0, 10));
      if (days < 0 || days > 14) continue;
      const name = nameById.get(s.therapist_id) || "מטפל/ת";
      suggestions.push({
        key: `promo-revert-${s.therapist_id}-${s.promo_reverts_at.slice(0, 10)}`,
        title: `שיחת שימור ל${name} לפני עליית המחיר`,
        reason: `מחיר המבצע מסתיים בעוד ${days} ימים — שיחה קצרה עכשיו מקטינה סיכוי לביטול.`,
        due_date: new Date(Date.now() + Math.max(0, days - 3) * 86400000).toISOString().slice(0, 10),
        priority: "high",
        entity_type: "therapist",
        entity_id: s.therapist_id,
        entity_label: name,
      });
    }

    // ── Rule 5: business-plan milestones ──
    for (const m of PLAN_MILESTONES) {
      if (m.due_date && daysFromNow(m.due_date) > 30) continue; // not yet relevant
      suggestions.push({ ...m, entity_type: null, entity_id: null, entity_label: null });
    }

    return NextResponse.json({
      ok: true,
      suggestions: suggestions.filter((s) => !settled.has(s.key)),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// Accept (creates a real task) or dismiss a suggestion.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const key = String(b.key ?? "");
    const action = String(b.action ?? "");
    if (!key || !["accept", "dismiss"].includes(action)) {
      return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
    }

    if (action === "accept") {
      const { error: taskErr } = await supabaseAdmin.from("crm_tasks").insert({
        title: String(b.title ?? "").slice(0, 300),
        details: b.reason ? String(b.reason).slice(0, 2000) : null,
        entity_type: b.entity_type ? String(b.entity_type) : null,
        entity_id: b.entity_id ? String(b.entity_id) : null,
        entity_label: b.entity_label ? String(b.entity_label).slice(0, 120) : null,
        due_date: b.due_date ? String(b.due_date) : null,
        priority: ["low", "normal", "high"].includes(b.priority) ? b.priority : "normal",
        created_by: "suggestion",
      });
      if (taskErr) return NextResponse.json({ ok: false, error: taskErr.message }, { status: 500 });
    }

    const { error } = await supabaseAdmin
      .from("crm_suggestion_state")
      .upsert({ key, status: action === "accept" ? "accepted" : "dismissed" });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
}
