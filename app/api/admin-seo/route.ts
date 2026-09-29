import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { seoCacheFreshness } from "@/app/lib/admin-seo-cache";

// פילוח SEO אורגני (/admin/seo). כל החישוב ב-RPC אחד בצד ה-DB
// (admin_seo_overview) - ראו את המתודולוגיה במיגרציה. מוגן ע"י middleware
// האדמין (נתיב /api/admin-*).

export const dynamic = "force-dynamic";

type WeekRow = { week: string; demand: number; home: number; name: number; recruit: number; other: number; ai?: number };
type AiWeekly = {
  weekly?: { week: string; ai: number }[];
  window_sessions?: number;
  by_assistant?: { assistant: string; sessions: number }[];
};

// עותק (admin_report_cache, מתמלא ע"י refresh_admin_seo_cache ב-pg_cron כל 6
// שעות). חישוב חי של 90 יום לקח 2.5 שניות בממוצע ו-10 שניות בריצה קרה - מעל
// מגבלת 8 השניות של PostgREST, וזו ה-ERROR שחלפה בניסיון חוזר (23/9/2026).
// העותק הוא הפלט של אותן שתי פונקציות בדיוק.
//
// עותק חסר או ישן (ראו admin-seo-cache.ts) - חישוב חי. אם גם החישוב החי נכשל
// (בסיס הנתונים תקוע, וזה בדיוק המצב שבו גם הריצה המתוזמנת נופלת) - עדיף
// העותק הישן עם סימון "ישן" על עמוד שגיאה. ?live=1 מכריח חישוב חי, להשוואה,
// וכשל שלו הוא שגיאה גלויה: מי שביקש נתון חי לא צריך לקבל ישן בלי לדעת.

// העותק בכל גיל, או null אם חסר. ההחלטה אם הוא טרי היא של הקורא.
async function readCached(days: number): Promise<{ seo: unknown; ai: unknown; computedAt: string } | null> {
  const keys = [`seo_overview:${days}`, `ai_weekly:${days}`];
  const { data, error } = await supabaseAdmin
    .from("admin_report_cache")
    .select("key, data, computed_at")
    .in("key", keys);
  if (error || !data) return null;
  const seo = data.find((r) => r.key === keys[0]);
  const ai = data.find((r) => r.key === keys[1]);
  if (!seo || !ai) return null;
  return { seo: seo.data, ai: ai.data, computedAt: seo.computed_at as string };
}

export async function GET(req: NextRequest) {
  try {
    const daysRaw = Number(req.nextUrl.searchParams.get("days"));
    const days = [30, 60, 90].includes(daysRaw) ? daysRaw : 90;
    const forceLive = req.nextUrl.searchParams.get("live") === "1";

    const cached = forceLive ? null : await readCached(days);
    const useCopy = cached !== null && seoCacheFreshness(cached.computedAt) === "fresh";
    let seoData: unknown;
    let aiData: unknown;
    // null = חושב עכשיו. אחרת: מתי חושב העותק שמוצג.
    let computedAt: string | null = null;
    let stale = false;
    if (cached && useCopy) {
      seoData = cached.seo;
      aiData = cached.ai;
      computedAt = cached.computedAt;
    } else {
      try {
        // שני ה-RPC רצים במקביל. סדרת ה-AI נוספה אחרי שהעמוד כבר עבד, ולכן
        // כישלון שלה לא מפיל אותו: הגרף פשוט מוצג בלי הקו.
        const [seo, aiRes] = await Promise.all([
          supabaseAdmin.rpc("admin_seo_overview", { p_days: days }),
          supabaseAdmin.rpc("admin_ai_weekly", { p_days: days }),
        ]);
        if (seo.error) throw seo.error;
        seoData = seo.data;
        aiData = aiRes.error ? null : aiRes.data;
      } catch (err) {
        // אין עותק (או שביקשו חי במפורש) - השגיאה אמיתית.
        if (!cached) throw err;
        seoData = cached.seo;
        aiData = cached.ai;
        computedAt = cached.computedAt;
        stale = true;
      }
    }

    const data = (seoData ?? {}) as { weekly?: WeekRow[] } & Record<string, unknown>;
    const ai = (aiData ?? null) as AiWeekly | null;
    // מתי חושבו הנתונים - העמוד מציג את זה, ומסמן בכתום כשהם ישנים.
    data.computed_at = computedAt;
    data.stale = stale;

    if (ai) {
      // מיזוג לפי תחילת השבוע. שני ה-RPC גוזרים אותה באותו date_trunc('week'),
      // כך שהמפתחות זהים; שבוע שיש בו רק AI (בלי אף מבקר אורגני) מתווסף באפסים.
      const aiByWeek = new Map((ai.weekly ?? []).map((w) => [w.week, Number(w.ai) || 0]));
      const weeks = new Map<string, WeekRow>((data.weekly ?? []).map((w) => [w.week, { ...w, ai: aiByWeek.get(w.week) ?? 0 }]));
      const firstOrganic = (data.weekly ?? [])[0]?.week;
      for (const [week, n] of aiByWeek) {
        if (!weeks.has(week) && firstOrganic && week >= firstOrganic) {
          weeks.set(week, { week, demand: 0, home: 0, name: 0, recruit: 0, other: 0, ai: n });
        }
      }
      data.weekly = [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week));
      data.ai = {
        sessions: Number(ai.window_sessions) || 0,
        by_assistant: (ai.by_assistant ?? []).map((a) => ({ assistant: String(a.assistant), sessions: Number(a.sessions) || 0 })),
      };
    }

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
