import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { fetchAllRows } from "@/app/lib/fetch-all-rows";
import { CITY_TO_REGION } from "@/app/lib/regions";
import { TEACHER_LISTED_STATES } from "@/app/lib/teacher-options";
import { computeCareFindings, loadPendingCareDrafts, runTeacherCare } from "@/app/lib/teacher-care.server";

// "מבט על" של ענף לימוד חכם באדמין: שישה מספרים, מה דורש טיפול, ושלושה
// גרפים שבועיים (הרשמות לפי ערוץ, חיפושים מול פניות, היצע מול ביקוש לפי
// אזור). אותו פורמט כמו מבט העל של ענף בתי הספר. הנתונים מהטבלאות של
// הענף בלבד (teachers, teacher_searches, teacher_events) ומצפיות הדלת
// (analytics_events עם source של הדלת); אף שאילתה לא נוגעת במטפלים.
// POST {action:"care_run"} מפעיל את כללי הטיפול עכשיו (כמו הקרון).

export const dynamic = "force-dynamic";

const WEEKS = 12;
const DAY = 86_400_000;

type TeacherRow = {
  id: string;
  full_name: string;
  listing_state: string;
  created_at: string;
  photo_path: string | null;
  regions: string[] | null;
  online: boolean;
  signup_channel: string | null;
  signup_utm_source: string | null;
  signup_utm_campaign: string | null;
};
type SearchRow = { created_at: string; region: string | null; online: boolean | null; returned: number | null };
type EventRow = { created_at: string; event_type: string };
type ViewRow = { created_at: string; session_id: string | null; channel: string | null; utm_source: string | null; referrer_host: string | null };

/** תחילת השבוע (יום שני, UTC) של חותמת זמן, כמו date_trunc('week'). */
function weekStart(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

/** ערוץ ההרשמה של מורה, בחמש קבוצות שהגרף מציג. */
export type SignupChannel = "ai" | "community" | "google" | "direct" | "other";
function signupChannel(t: TeacherRow): SignupChannel {
  const ch = (t.signup_channel ?? "").toLowerCase();
  const src = (t.signup_utm_source ?? "").toLowerCase();
  if (ch === "ai" || /chatgpt|openai|gemini|claude|perplexity|copilot/.test(src)) return "ai";
  if (ch === "community" || src === "community" || /facebook|whatsapp|fb\./.test(src) || (t.signup_utm_campaign ?? "").startsWith("teachers-")) return "community";
  if (ch === "google_organic" || ch === "google_ads" || src === "google") return "google";
  if (ch === "direct" || (!ch && !src)) return "direct";
  return "other";
}

/** מקור הצפייה בדלת, בחמש קבוצות. אותה חלוקה כמו traffic_source_key, בדפדפן של השרת. */
export type ViewSource = "google" | "ai" | "direct" | "social" | "other";
function viewSource(v: ViewRow): ViewSource {
  const ch = (v.channel ?? "").toLowerCase();
  const src = (v.utm_source ?? "").toLowerCase();
  const host = (v.referrer_host ?? "").toLowerCase();
  if (ch === "ai" || /chatgpt|openai|gemini|claude|perplexity|copilot/.test(`${src} ${host}`)) return "ai";
  if (ch.startsWith("google") || /google\./.test(host) || src === "google") return "google";
  if (/facebook|instagram|whatsapp|fb\.|t\.co|linkedin/.test(`${src} ${host}`) || ch === "social" || ch === "community") return "social";
  if (ch === "direct" || (!host && !src)) return "direct";
  return "other";
}

export async function GET() {
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * DAY).toISOString();
  const sinceWeeks = new Date(now.getTime() - WEEKS * 7 * DAY).toISOString();

  try {
    const [teachers, searches, events, views, joinViews, drafts, care] = await Promise.all([
      fetchAllRows<TeacherRow>(() =>
        supabaseAdmin
          .from("teachers")
          .select("id, full_name, listing_state, created_at, photo_path, regions, online, signup_channel, signup_utm_source, signup_utm_campaign")
          .order("id"),
      ),
      fetchAllRows<SearchRow>(() => supabaseAdmin.from("teacher_searches").select("created_at, region, online, returned").gte("created_at", sinceWeeks).order("created_at")),
      fetchAllRows<EventRow>(() =>
        supabaseAdmin.from("teacher_events").select("created_at, event_type").gte("created_at", sinceWeeks).in("event_type", ["impression", "whatsapp", "phone", "profile_view"]).order("created_at"),
      ),
      fetchAllRows<ViewRow>(() =>
        supabaseAdmin
          .from("analytics_events")
          .select("created_at, session_id, channel, utm_source, referrer_host")
          .eq("event_type", "page_view")
          .in("source", ["learning", "learning-teachers"])
          .gte("created_at", sinceWeeks)
          .order("created_at"),
      ),
      supabaseAdmin.from("analytics_events").select("id", { count: "exact", head: true }).eq("event_type", "recruit_page_view").eq("source", "learning-join").gte("created_at", since30),
      loadPendingCareDrafts(),
      computeCareFindings(now),
    ]);

    const listed = teachers.filter((t) => (TEACHER_LISTED_STATES as readonly string[]).includes(t.listing_state));
    const pending = teachers.filter((t) => t.listing_state === "pending");
    const contacts30 = events.filter((e) => (e.event_type === "whatsapp" || e.event_type === "phone") && e.created_at >= since30).length;
    const impressions30 = events.filter((e) => e.event_type === "impression" && e.created_at >= since30).length;
    const views30 = new Set(views.filter((v) => v.created_at >= since30).map((v) => v.session_id ?? v.created_at)).size;

    // ── שבועות ──────────────────────────────────────────────────────────
    const weekKeys: string[] = [];
    for (let i = WEEKS - 1; i >= 0; i--) weekKeys.push(weekStart(new Date(now.getTime() - i * 7 * DAY).toISOString()));
    const firstWeek = weekKeys[0];
    const empty = () => ({
      signups: { ai: 0, community: 0, google: 0, direct: 0, other: 0 } as Record<SignupChannel, number>,
      searches: 0,
      contacts: 0,
      impressions: 0,
      views: { google: 0, ai: 0, direct: 0, social: 0, other: 0 } as Record<ViewSource, number>,
    });
    const weeks = new Map(weekKeys.map((w) => [w, empty()]));
    const bucket = (iso: string) => {
      const w = weekStart(iso);
      return w >= firstWeek ? weeks.get(w) : undefined;
    };
    for (const t of teachers) {
      const b = bucket(t.created_at);
      if (b) b.signups[signupChannel(t)]++;
    }
    for (const s of searches) {
      const b = bucket(s.created_at);
      if (b) b.searches++;
    }
    for (const e of events) {
      const b = bucket(e.created_at);
      if (!b) continue;
      if (e.event_type === "impression") b.impressions++;
      else if (e.event_type === "whatsapp" || e.event_type === "phone") b.contacts++;
    }
    const seenSessions = new Set<string>();
    for (const v of views) {
      const key = `${weekStart(v.created_at)}:${v.session_id ?? v.created_at}`;
      if (seenSessions.has(key)) continue;
      seenSessions.add(key);
      const b = bucket(v.created_at);
      if (b) b.views[viewSource(v)]++;
    }

    // ── היצע מול ביקוש לפי אזור (30 יום) ──────────────────────────────────
    const supply = new Map<string, Set<string>>();
    for (const t of listed) {
      const regions = new Set((t.regions ?? []).map((c) => CITY_TO_REGION[c] ?? c));
      if (t.online) regions.add("אונליין");
      for (const r of regions) (supply.get(r) ?? supply.set(r, new Set()).get(r)!).add(t.id);
    }
    const demand = new Map<string, { searches: number; empty: number }>();
    for (const s of searches) {
      if (s.created_at < since30) continue;
      const r = s.region || (s.online ? "אונליין" : "ללא אזור");
      const d = demand.get(r) ?? { searches: 0, empty: 0 };
      d.searches++;
      if (!s.returned) d.empty++;
      demand.set(r, d);
    }
    const regionsAll = new Set([...supply.keys(), ...demand.keys()]);
    const supplyDemand = [...regionsAll]
      .map((region) => ({ region, teachers: supply.get(region)?.size ?? 0, searches: demand.get(region)?.searches ?? 0, empty_searches: demand.get(region)?.empty ?? 0 }))
      .sort((a, b) => b.searches - a.searches || b.teachers - a.teachers);

    // ── ערוצי הרשמה ─────────────────────────────────────────────────────
    const channels: Record<SignupChannel, { total: number; last30: number }> = {
      ai: { total: 0, last30: 0 },
      community: { total: 0, last30: 0 },
      google: { total: 0, last30: 0 },
      direct: { total: 0, last30: 0 },
      other: { total: 0, last30: 0 },
    };
    for (const t of teachers) {
      const c = channels[signupChannel(t)];
      c.total++;
      if (t.created_at >= since30) c.last30++;
    }

    // ── דורש טיפול ──────────────────────────────────────────────────────
    const draftRows = Object.values(drafts).flat();
    const draftsByKind: Record<string, number> = {};
    for (const d of draftRows) draftsByKind[d.action_type] = (draftsByKind[d.action_type] ?? 0) + 1;
    const oldestPendingDays = pending.length ? Math.max(...pending.map((t) => Math.floor((now.getTime() - new Date(t.created_at).getTime()) / DAY))) : 0;
    const emptySearches30 = searches.filter((s) => s.created_at >= since30 && !s.returned).length;

    return NextResponse.json(
      {
        ok: true,
        today: now.toISOString().slice(0, 10),
        tiles: {
          listed: listed.length,
          pending: pending.length,
          with_photo: listed.filter((t) => t.photo_path).length,
          searches_30d: searches.filter((s) => s.created_at >= since30).length,
          contacts_30d: contacts30,
          impressions_30d: impressions30,
          signups_30d: teachers.filter((t) => t.created_at >= since30).length,
          door_views_30d: views30,
          join_views_30d: joinViews.count ?? 0,
        },
        attention: {
          pending: pending.length,
          oldest_pending_days: oldestPendingDays,
          drafts: draftRows.length,
          drafts_by_kind: draftsByKind,
          no_contacts: care.findings.filter((f) => f.kind === "no_contacts").length,
          empty_searches_30d: emptySearches30,
        },
        weeks: weekKeys.map((w) => ({ week: w, ...weeks.get(w)! })),
        supply_demand: supplyDemand,
        channels,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  if (body?.action !== "care_run") return NextResponse.json({ ok: false, error: "פעולה לא מוכרת" }, { status: 400 });
  try {
    const result = await runTeacherCare();
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
