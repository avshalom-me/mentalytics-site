import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { rowInRegion } from "@/app/lib/therapist-directory";

// דוח חשיפה/לחיצות לאזור, לצורך שיתוף עם מרכזים טיפוליים שמתלבטים אם
// להצטרף (17/8/2026). מטפלים מקודמים בלבד (תשלום או מתנה) - לא ישויות-מרכז,
// כי המספר של ישות אחת מייצג מרפאה שלמה ומטעה מרכז ששוקל מסלול פרטני.

const WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// יום זיהום נתונים מוכר: סורק ייצר באותו יום זינוק בצפיות בכל האתר (הוכח -
// לא אדם: 22 סשנים מתוך 22 בירושלים לבדה, אחד עם אינטראקציה, אפס לחיצות).
// חסימת בוטים בכתיבה נפרסה ב-12/8/2026 (app/lib/bot-detect.ts) - התאריך
// הזה הוא ניקוי חד-פעמי להיסטוריה שלפני החסימה, לא רשימה שצריך לתחזק. הוא
// יוצא מעצמו מחלון 30 הימים אחרי 7/9/2026 והופך לקוד מת לא-מזיק - אין צורך
// להסיר אותו אז, ואין סיבה להוסיף תאריכים נוספים אחריו.
const KNOWN_BOT_DAY = "2026-08-08";

function isBotDay(iso: string): boolean {
  return iso.slice(0, 10) === KNOWN_BOT_DAY;
}

type EligibleTherapist = {
  id: string;
  promotion_source: string | null;
  promoted_since: string | null;
  created_at: string | null;
  training_areas: string[] | null;
};

export type SpecialtyRow = {
  area: string;
  therapists: number;
  views: number;
  clicks: number;
};

export type RegionReport = {
  region: string;
  windowDays: number;
  therapistCount: number;
  totalViews: number;
  uniqueViewers: number;
  totalClicks: number;
  uniqueClickers: number;
  /** לחיצות ממוצעות למטפל/ת בחודש, מנורמל לפי זמן הופעה בפועל בחלון. */
  avgClicksPerMonth: number;
  clicksMin: number;
  clicksMedian: number;
  clicksMax: number;
  specialties: SpecialtyRow[];
  generatedAt: string;
};

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * טוען דוח חי לאזור נתון (שם מלא, לא slug). null אם אין אף מטפל/ת מקודמ/ת
 * באזור - עמוד ריק לא נשלח למרכז, גם אם זה אומר 404.
 */
export async function loadRegionReport(region: string): Promise<RegionReport | null> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);

  const { data: rows } = await supabaseAdmin
    .from("therapists")
    .select("id, promotion_source, promoted_since, created_at, training_areas, regions")
    .eq("status", "paying")
    .eq("admin_approved", true)
    .neq("entity_type", "center");

  const eligible = ((rows ?? []) as (EligibleTherapist & { regions: string[] | null })[])
    .filter((t) => rowInRegion(t.regions, region));
  if (eligible.length === 0) return null;

  const ids = eligible.map((t) => t.id);
  const [{ data: viewRows }, { data: clickRows }] = await Promise.all([
    supabaseAdmin
      .from("therapist_profile_views")
      .select("therapist_id, viewed_at, session_id")
      .in("therapist_id", ids)
      .in("source", ["match", "directory"])
      .gte("viewed_at", windowStart.toISOString()),
    supabaseAdmin
      .from("therapist_contact_clicks")
      .select("therapist_id, clicked_at, session_id")
      .in("therapist_id", ids)
      .gte("clicked_at", windowStart.toISOString()),
  ]);

  const views = (viewRows ?? []).filter((v) => !isBotDay(v.viewed_at as string));
  const clicks = (clickRows ?? []).filter((c) => !isBotDay(c.clicked_at as string));

  const viewsByTherapist = new Map<string, number>();
  const viewerSessions = new Set<string>();
  for (const v of views) {
    viewsByTherapist.set(v.therapist_id as string, (viewsByTherapist.get(v.therapist_id as string) ?? 0) + 1);
    if (v.session_id) viewerSessions.add(v.session_id as string);
  }

  const clicksByTherapist = new Map<string, number>();
  const clickerSessions = new Set<string>();
  for (const c of clicks) {
    clicksByTherapist.set(c.therapist_id as string, (clicksByTherapist.get(c.therapist_id as string) ?? 0) + 1);
    if (c.session_id) clickerSessions.add(c.session_id as string);
  }

  // ימי-כיסוי בפועל בתוך החלון, לפי promoted_since - כך שמי שהצטרף באמצע
  // התקופה לא מדלל כלפי מטה את הממוצע החודשי (אותה שיטה כמו הדוח שנשלח
  // ידנית קודם, עכשיו חיה).
  let coverageDays = 0;
  for (const t of eligible) {
    const sinceIso = t.promoted_since ?? t.created_at;
    const since = sinceIso ? new Date(sinceIso) : windowStart;
    const effectiveStart = since > windowStart ? since : windowStart;
    const days = Math.max(1, Math.round((now.getTime() - effectiveStart.getTime()) / DAY_MS));
    coverageDays += Math.min(WINDOW_DAYS, days);
  }

  const totalClicks = clicks.length;
  const monthsCovered = coverageDays / WINDOW_DAYS;
  const perTherapistClicks = eligible.map((t) => clicksByTherapist.get(t.id) ?? 0).sort((a, b) => a - b);

  const specialtyMap = new Map<string, { therapists: Set<string>; views: number; clicks: number }>();
  for (const t of eligible) {
    const tv = viewsByTherapist.get(t.id) ?? 0;
    const tc = clicksByTherapist.get(t.id) ?? 0;
    for (const area of t.training_areas ?? []) {
      let entry = specialtyMap.get(area);
      if (!entry) specialtyMap.set(area, (entry = { therapists: new Set(), views: 0, clicks: 0 }));
      entry.therapists.add(t.id);
      entry.views += tv;
      entry.clicks += tc;
    }
  }
  const specialties: SpecialtyRow[] = [...specialtyMap.entries()]
    .map(([area, v]) => ({ area, therapists: v.therapists.size, views: v.views, clicks: v.clicks }))
    .filter((s) => s.views > 0)
    .sort((a, b) => b.views - a.views || b.clicks - a.clicks);

  return {
    region,
    windowDays: WINDOW_DAYS,
    therapistCount: eligible.length,
    totalViews: views.length,
    uniqueViewers: viewerSessions.size,
    totalClicks,
    uniqueClickers: clickerSessions.size,
    avgClicksPerMonth: monthsCovered > 0 ? Math.round((totalClicks / monthsCovered) * 10) / 10 : 0,
    clicksMin: perTherapistClicks[0] ?? 0,
    clicksMedian: median(perTherapistClicks),
    clicksMax: perTherapistClicks[perTherapistClicks.length - 1] ?? 0,
    specialties,
    generatedAt: now.toISOString(),
  };
}
