import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import OpenAI from "openai";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const resend = new Resend(process.env.RESEND_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CRON_SECRET = process.env.CRON_SECRET;
const REPORT_TO = (process.env.WEEKLY_REPORT_TO ?? "avshalom84@gmail.com,tpool406@gmail.com")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

type Period = { since: string; until: string };

function getWeekRange(weeksAgo = 0): Period {
  const now = Date.now();
  const ms = 7 * 86_400_000;
  const until = new Date(now - weeksAgo * ms).toISOString();
  const since = new Date(now - (weeksAgo + 1) * ms).toISOString();
  return { since, until };
}

function topN<T extends { name: string; count: number }>(rows: T[], n: number): T[] {
  return [...rows].sort((a, b) => b.count - a.count).slice(0, n);
}

function diffPct(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return Math.round(((curr - prev) / prev) * 100);
}

// ── DATA AGGREGATORS ────────────────────────────────────────────────

type PatientData = {
  pageViews: number;
  impressions: number;
  profileViews: number;
  contactClicks: number;
  popularFilters: { name: string; count: number }[];
  byRegion: { name: string; count: number }[];
  byIssue: { name: string; count: number }[];
  byAgeBand: { name: string; count: number }[];
  byGender: { name: string; count: number }[];
  clickTypeBreakdown: Record<string, number>;
  quizStarted: { adults: number; kids: number };
  quizCompleted: { adults: number; kids: number };
};

async function aggregatePatientData(period: Period): Promise<PatientData> {
  const [eventsRes, viewsRes, clicksRes] = await Promise.all([
    supabaseAdmin
      .from("analytics_events")
      .select("event_type, metadata, created_at")
      .gte("created_at", period.since)
      .lt("created_at", period.until),
    supabaseAdmin
      .from("therapist_profile_views")
      .select("therapist_id, viewer_region, viewer_issue, viewer_age_band, viewer_gender")
      .gte("viewed_at", period.since)
      .lt("viewed_at", period.until),
    supabaseAdmin
      .from("therapist_contact_clicks")
      .select("therapist_id, click_type")
      .gte("clicked_at", period.since)
      .lt("clicked_at", period.until),
  ]);

  const events = (eventsRes.data ?? []) as { event_type: string; metadata: Record<string, string> }[];
  const views = (viewsRes.data ?? []) as { viewer_region?: string; viewer_issue?: string; viewer_age_band?: string; viewer_gender?: string }[];
  const clicks = (clicksRes.data ?? []) as { click_type: string }[];

  const pageViews = events.filter(e => e.event_type === "page_view").length;
  const impressions = events.filter(e => e.event_type === "profile_impression").length;

  const filterCounts: Record<string, number> = {};
  for (const e of events) {
    if (e.event_type === "filter_used" && e.metadata?.filter_value) {
      filterCounts[e.metadata.filter_value] = (filterCounts[e.metadata.filter_value] ?? 0) + 1;
    }
  }

  function countField(field: keyof typeof views[number]) {
    const counts: Record<string, number> = {};
    for (const v of views) {
      const val = v[field] as string | undefined;
      if (val) counts[val] = (counts[val] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }

  const clickTypeBreakdown: Record<string, number> = {};
  for (const c of clicks) {
    clickTypeBreakdown[c.click_type] = (clickTypeBreakdown[c.click_type] ?? 0) + 1;
  }

  const adultStarts = events.filter(e => e.event_type === "quiz_step" && e.metadata?.quiz_type === "adults").length;
  const kidStarts = events.filter(e => e.event_type === "quiz_step" && e.metadata?.quiz_type === "kids").length;
  const adultCompletes = events.filter(e => e.event_type === "quiz_complete" && e.metadata?.quiz_type === "adults").length;
  const kidCompletes = events.filter(e => e.event_type === "quiz_complete" && e.metadata?.quiz_type === "kids").length;

  return {
    pageViews,
    impressions,
    profileViews: views.length,
    contactClicks: clicks.length,
    popularFilters: topN(Object.entries(filterCounts).map(([name, count]) => ({ name, count })), 10),
    byRegion: topN(countField("viewer_region"), 10),
    byIssue: topN(countField("viewer_issue"), 10),
    byAgeBand: countField("viewer_age_band"),
    byGender: countField("viewer_gender"),
    clickTypeBreakdown,
    quizStarted: { adults: adultStarts, kids: kidStarts },
    quizCompleted: { adults: adultCompletes, kids: kidCompletes },
  };
}

type SilentTherapist = {
  id: string;
  full_name: string;
  email: string | null;
  views: number;
  clicks: number;
  bio_length: number;
  training_count: number;
  region_count: number;
  has_photo: boolean;
};

type TherapistData = {
  totalActive: number;
  paying: number;
  free: number;
  byTherapistType: { name: string; count: number }[];
  byTrainingArea: { name: string; count: number }[];
  byRegion: { name: string; count: number }[];
  byGender: { name: string; count: number }[];
  rareTrainingAreas: { name: string; count: number }[];
  newThisWeek: number;
  silentPayingTherapists: SilentTherapist[];
  invisiblePayingCount: number;
  viewedNoClickPayingCount: number;
};

async function aggregateTherapistData(period: Period): Promise<TherapistData> {
  const { data: therapists } = await supabaseAdmin
    .from("therapists")
    .select("id, full_name, email, status, therapist_types, training_areas, regions, gender, bio, photo_url, created_at")
    .in("status", ["paying", "approved"]);

  const list = (therapists ?? []) as {
    id: string;
    full_name: string | null;
    email: string | null;
    status: string;
    therapist_types: string[] | null;
    training_areas: string[] | null;
    regions: string[] | null;
    gender: string | null;
    bio: string | null;
    photo_url: string | null;
    created_at: string;
  }[];

  const paying = list.filter(t => t.status === "paying").length;
  const free = list.filter(t => t.status === "approved").length;

  function countArrayField(field: "therapist_types" | "training_areas" | "regions") {
    const counts: Record<string, number> = {};
    for (const t of list) {
      for (const v of t[field] ?? []) {
        counts[v] = (counts[v] ?? 0) + 1;
      }
    }
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }

  const byTherapistType = countArrayField("therapist_types");
  const byTrainingArea = countArrayField("training_areas");
  const byRegion = countArrayField("regions");

  const genderCounts: Record<string, number> = {};
  for (const t of list) {
    const g = t.gender ?? "לא צוין";
    genderCounts[g] = (genderCounts[g] ?? 0) + 1;
  }

  const newThisWeek = list.filter(t => t.created_at >= period.since && t.created_at < period.until).length;

  const sortedTraining = [...byTrainingArea].sort((a, b) => a.count - b.count);

  // Per-therapist click + view counts for the week (paying only)
  const payingList = list.filter(t => t.status === "paying");
  const payingIds = payingList.map(t => t.id);

  const [viewsRes, clicksRes] = await Promise.all([
    supabaseAdmin
      .from("therapist_profile_views")
      .select("therapist_id")
      .gte("viewed_at", period.since)
      .lt("viewed_at", period.until)
      .in("therapist_id", payingIds.length > 0 ? payingIds : ["00000000-0000-0000-0000-000000000000"]),
    supabaseAdmin
      .from("therapist_contact_clicks")
      .select("therapist_id")
      .gte("clicked_at", period.since)
      .lt("clicked_at", period.until)
      .in("therapist_id", payingIds.length > 0 ? payingIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);

  const viewsByT: Record<string, number> = {};
  for (const v of (viewsRes.data ?? []) as { therapist_id: string }[]) {
    viewsByT[v.therapist_id] = (viewsByT[v.therapist_id] ?? 0) + 1;
  }
  const clicksByT: Record<string, number> = {};
  for (const c of (clicksRes.data ?? []) as { therapist_id: string }[]) {
    clicksByT[c.therapist_id] = (clicksByT[c.therapist_id] ?? 0) + 1;
  }

  const silentPayingTherapists: SilentTherapist[] = payingList
    .filter(t => (clicksByT[t.id] ?? 0) === 0)
    .map(t => ({
      id: t.id,
      full_name: t.full_name ?? "—",
      email: t.email,
      views: viewsByT[t.id] ?? 0,
      clicks: 0,
      bio_length: (t.bio ?? "").length,
      training_count: t.training_areas?.length ?? 0,
      region_count: t.regions?.length ?? 0,
      has_photo: Boolean(t.photo_url),
    }))
    .sort((a, b) => b.views - a.views);

  const invisiblePayingCount = silentPayingTherapists.filter(t => t.views === 0).length;
  const viewedNoClickPayingCount = silentPayingTherapists.filter(t => t.views > 0).length;

  return {
    totalActive: list.length,
    paying,
    free,
    byTherapistType: topN(byTherapistType, 15),
    byTrainingArea: topN(byTrainingArea, 15),
    byRegion: topN(byRegion, 15),
    byGender: Object.entries(genderCounts).map(([name, count]) => ({ name, count })),
    rareTrainingAreas: sortedTraining.slice(0, 8),
    newThisWeek,
    silentPayingTherapists,
    invisiblePayingCount,
    viewedNoClickPayingCount,
  };
}

// ── LLM SYNTHESIS ───────────────────────────────────────────────────

async function generateInsights(
  current: { patient: PatientData; therapist: TherapistData },
  previous: { patient: PatientData; therapist: TherapistData },
  weekStart: string,
  weekEnd: string,
): Promise<{ summary: string; recommendations: string; silentTherapistsAdvice: string }> {
  const wow = {
    pageViews: diffPct(current.patient.pageViews, previous.patient.pageViews),
    profileViews: diffPct(current.patient.profileViews, previous.patient.profileViews),
    contactClicks: diffPct(current.patient.contactClicks, previous.patient.contactClicks),
    quizCompletedAdults: diffPct(current.patient.quizCompleted.adults, previous.patient.quizCompleted.adults),
    quizCompletedKids: diffPct(current.patient.quizCompleted.kids, previous.patient.quizCompleted.kids),
  };

  const prompt = `אתה אנליסט מוצר עבור "טיפול חכם" — פלטפורמה ישראלית לחיבור בין מטופלים למטפלים. אני מנהל המוצר וקיבלת את נתוני השבוע האחרון.

תקופה: ${weekStart} עד ${weekEnd}

## נתוני השבוע (ביקוש מצד מטופלים פוטנציאליים)
- כניסות לדירקטוריה: ${current.patient.pageViews} (שינוי מהשבוע הקודם: ${wow.pageViews}%)
- צפיות בפרופילים: ${current.patient.profileViews} (שינוי: ${wow.profileViews}%)
- לחיצות יצירת קשר: ${current.patient.contactClicks} (שינוי: ${wow.contactClicks}%)
- שאלון מבוגרים — סיומים: ${current.patient.quizCompleted.adults} (שינוי: ${wow.quizCompletedAdults}%)
- שאלון ילדים — סיומים: ${current.patient.quizCompleted.kids} (שינוי: ${wow.quizCompletedKids}%)

### פילוח אזורים שמטופלים חיפשו (לפי צפיות בפרופילים):
${JSON.stringify(current.patient.byRegion, null, 2)}

### פילוח נושאים שמטופלים חיפשו:
${JSON.stringify(current.patient.byIssue, null, 2)}

### פילטרים פופולריים:
${JSON.stringify(current.patient.popularFilters, null, 2)}

### גיל ומגדר של הצופים:
גיל: ${JSON.stringify(current.patient.byAgeBand)}
מגדר: ${JSON.stringify(current.patient.byGender)}

## נתוני המטפלים (היצע)
- סה"כ פעילים: ${current.therapist.totalActive} (מקודמים: ${current.therapist.paying}, חינמיים: ${current.therapist.free})
- מטפלים חדשים שהתווספו השבוע: ${current.therapist.newThisWeek}

### פילוח לפי סוג מטפל:
${JSON.stringify(current.therapist.byTherapistType, null, 2)}

### פילוח לפי תחומי הכשרה:
${JSON.stringify(current.therapist.byTrainingArea, null, 2)}

### תחומי הכשרה נדירים (מעט מטפלים):
${JSON.stringify(current.therapist.rareTrainingAreas, null, 2)}

### פילוח לפי אזורים:
${JSON.stringify(current.therapist.byRegion, null, 2)}

### פילוח לפי מגדר:
${JSON.stringify(current.therapist.byGender, null, 2)}

### מטפלים ממומנים שלא קיבלו אף פנייה השבוע (${current.therapist.silentPayingTherapists.length}):
מתוכם ${current.therapist.invisiblePayingCount} בכלל לא נצפו (חוסר חשיפה), ${current.therapist.viewedNoClickPayingCount} נצפו אבל לא לחצו (חוסר המרה).
${JSON.stringify(current.therapist.silentPayingTherapists.slice(0, 15).map(t => ({
  שם: t.full_name,
  צפיות: t.views,
  אורך_ביו: t.bio_length,
  תחומים: t.training_count,
  אזורים: t.region_count,
  תמונה: t.has_photo,
})), null, 2)}

---

אנא הפק שלושה חלקים נפרדים, בעברית פשוטה וברורה:

**חלק 1 — סיכום השבוע (5-7 משפטים):**
מצב כללי, מגמות בולטות מול השבוע הקודם, ושני-שלושה דברים שראויים לתשומת לב מיידית.

**חלק 2 — המלצות פעולה ממוקדות (3-6 פעולות):**
זהה גאפים בין ביקוש להיצע (אזורים/נושאים שמבוקשים אבל אין מספיק מטפלים, או להפך). תן המלצות קונקרטיות לפרסום ממוקד — מי הקהל (מטפלים או מטופלים), איזה אזור/תחום, ולמה. כל המלצה במשפט-שניים, עם הסבר מספרי קצר.

**חלק 3 — מטפלים ממומנים בלי פניות:**
התייחס ספציפית למטפלים שלא קיבלו אף פנייה השבוע. הפרד בין שתי קבוצות:
- "לא נצפו בכלל" — בעיית חשיפה. הצע פעולות מוצריות (קידום במערכת ההתאמות, שיפור התאמת אזורים/תחומים בפרופיל, פרסום ממוקד באזור שלהם).
- "נצפו אבל לא לחצו" — בעיית המרה. הצע פעולות שיפור פרופיל (ביו ארוך יותר, תמונה איכותית, הוספת תחומי הכשרה, ניסוח התמחות חד יותר).
תן 3-5 פעולות קונקרטיות שאני יכול לבצע השבוע.

חשוב: דבר ישירות בלי מבוא, בלי "כמובן" / "בוודאי" / "אשמח". התחל מיד בחלק 1.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "אתה אנליסט מוצר ישראלי ענייני. אתה כותב עברית טבעית, ממוקדת מספרים וללא מליצות." },
      { role: "user", content: prompt },
    ],
    temperature: 0.4,
  });

  const text = completion.choices[0]?.message?.content ?? "";

  const part2Split = text.split(/\*\*חלק 2.*?\*\*/);
  const summary = (part2Split[0] ?? text).replace(/\*\*חלק 1.*?\*\*/, "").trim();
  const afterPart1 = part2Split[1] ?? "";
  const part3Split = afterPart1.split(/\*\*חלק 3.*?\*\*/);
  const recommendations = (part3Split[0] ?? "").trim();
  const silentTherapistsAdvice = (part3Split[1] ?? "").trim();

  return { summary, recommendations, silentTherapistsAdvice };
}

// ── EMAIL ───────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function mdToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^### (.+)$/gm, '<h3 style="font-size:15px;color:#0F5468;margin:18px 0 8px;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:17px;color:#0F5468;margin:22px 0 10px;">$1</h2>')
    .replace(/^- (.+)$/gm, '<li style="margin-bottom:6px;">$1</li>')
    .replace(/(<li[^>]*>[\s\S]*?<\/li>\s*)+/g, m => `<ul style="padding-right:20px;margin:8px 0;">${m}</ul>`)
    .replace(/\n{2,}/g, '</p><p style="margin:10px 0;line-height:1.7;">')
    .replace(/^/, '<p style="margin:10px 0;line-height:1.7;">')
    .replace(/$/, "</p>");
}

function buildSilentTherapistsTable(silent: SilentTherapist[]): string {
  if (silent.length === 0) {
    return `<p style="margin:8px 0;color:#22c55e;font-size:13px;">🎉 כל המטפלים הממומנים קיבלו לפחות פנייה אחת השבוע.</p>`;
  }

  const rows = silent.slice(0, 20).map(t => {
    const concerns: string[] = [];
    if (t.bio_length < 80) concerns.push("ביו קצר");
    if (!t.has_photo) concerns.push("אין תמונה");
    if (t.training_count <= 2) concerns.push("מעט תחומים");
    if (t.region_count <= 1) concerns.push("מעט אזורים");
    const flag = t.views === 0 ? "🔇 לא נצפה" : "👁️ נצפה — לא לחצו";
    const flagColor = t.views === 0 ? "#dc2626" : "#d97706";
    return `
      <tr>
        <td style="padding:8px 10px;border:1px solid #e8e0d8;font-size:13px;">${escapeHtml(t.full_name)}</td>
        <td style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;color:${flagColor};font-size:11px;font-weight:bold;">${flag}</td>
        <td style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:13px;">${t.views}</td>
        <td style="padding:8px 10px;border:1px solid #e8e0d8;font-size:11px;color:#888;">${concerns.length > 0 ? escapeHtml(concerns.join(" · ")) : "—"}</td>
      </tr>`;
  }).join("");

  return `
    <table style="width:100%;border-collapse:collapse;margin:8px 0 16px;background:white;">
      <thead>
        <tr style="background:#f5f5f4;">
          <th style="padding:8px 10px;border:1px solid #e8e0d8;text-align:right;font-size:11px;color:#666;">מטפל</th>
          <th style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#666;">סטטוס</th>
          <th style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#666;">צפיות</th>
          <th style="padding:8px 10px;border:1px solid #e8e0d8;text-align:right;font-size:11px;color:#666;">דגלים בפרופיל</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${silent.length > 20 ? `<p style="font-size:11px;color:#999;margin:0;">מציג 20 ראשונים מתוך ${silent.length}.</p>` : ""}
  `;
}

function buildEmailHtml(
  weekStart: string,
  weekEnd: string,
  patient: PatientData,
  therapist: TherapistData,
  insights: { summary: string; recommendations: string; silentTherapistsAdvice: string },
): string {
  return `
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#333;">
      <div style="background:linear-gradient(135deg,#0F5468,#2e7d8c);padding:24px 32px;border-radius:12px 12px 0 0;">
        <h1 style="color:white;margin:0;font-size:22px;">דוח שבועי — טיפול חכם</h1>
        <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">${weekStart} עד ${weekEnd}</p>
      </div>

      <div style="background:#f9f8f6;padding:24px 32px;border:1px solid #e8e0d8;border-top:0;">
        <h2 style="font-size:17px;color:#0F5468;margin:0 0 12px;">סיכום</h2>
        ${mdToHtml(insights.summary)}

        <h2 style="font-size:17px;color:#0F5468;margin:24px 0 12px;">המלצות פעולה</h2>
        ${mdToHtml(insights.recommendations)}

        <h2 style="font-size:17px;color:#0F5468;margin:24px 0 12px;">
          מטפלים ממומנים בלי פניות השבוע
          <span style="font-size:13px;color:#888;font-weight:normal;">(${therapist.silentPayingTherapists.length})</span>
        </h2>
        <p style="font-size:12px;color:#666;margin:0 0 8px;">
          🔇 ${therapist.invisiblePayingCount} לא נצפו בכלל · 👁️ ${therapist.viewedNoClickPayingCount} נצפו אבל לא יצרו קשר
        </p>
        ${buildSilentTherapistsTable(therapist.silentPayingTherapists)}
        ${insights.silentTherapistsAdvice ? `<div style="background:white;padding:14px 16px;border-radius:8px;border:1px solid #e8e0d8;">${mdToHtml(insights.silentTherapistsAdvice)}</div>` : ""}

        <h2 style="font-size:17px;color:#0F5468;margin:24px 0 12px;">מספרים מרכזיים</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr style="background:white;">
            <td style="padding:10px;border:1px solid #e8e0d8;text-align:center;font-weight:bold;">${patient.pageViews}</td>
            <td style="padding:10px;border:1px solid #e8e0d8;text-align:center;font-weight:bold;">${patient.profileViews}</td>
            <td style="padding:10px;border:1px solid #e8e0d8;text-align:center;font-weight:bold;">${patient.contactClicks}</td>
            <td style="padding:10px;border:1px solid #e8e0d8;text-align:center;font-weight:bold;">${patient.quizCompleted.adults + patient.quizCompleted.kids}</td>
            <td style="padding:10px;border:1px solid #e8e0d8;text-align:center;font-weight:bold;background:#0F5468;color:white;">${therapist.totalActive}</td>
          </tr>
          <tr>
            <td style="padding:6px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#888;">כניסות</td>
            <td style="padding:6px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#888;">צפיות</td>
            <td style="padding:6px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#888;">לחיצות קשר</td>
            <td style="padding:6px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#888;">סיומי שאלון</td>
            <td style="padding:6px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#888;">מטפלים פעילים</td>
          </tr>
        </table>
      </div>

      <div style="padding:14px 32px;text-align:center;font-size:12px;color:#999;border:1px solid #e8e0d8;border-top:0;border-radius:0 0 12px 12px;">
        <a href="https://www.mentalytics.co.il/admin/weekly-reports" style="color:#0F5468;">צפייה בכל הדוחות הקודמים</a>
      </div>
    </div>
  `;
}

// ── MAIN ────────────────────────────────────────────────────────────

export async function runWeeklyReport(): Promise<{
  ok: boolean;
  week_start?: string;
  emailStatus?: string;
  error?: string;
  status?: number;
}> {
  try {
    const current = getWeekRange(0);
    const previous = getWeekRange(1);

    const [patient, therapist, prevPatient, prevTherapist] = await Promise.all([
      aggregatePatientData(current),
      aggregateTherapistData(current),
      aggregatePatientData(previous),
      aggregateTherapistData(previous),
    ]);

    const insights = await generateInsights(
      { patient, therapist },
      { patient: prevPatient, therapist: prevTherapist },
      current.since.slice(0, 10),
      current.until.slice(0, 10),
    );

    const html = buildEmailHtml(
      current.since.slice(0, 10),
      current.until.slice(0, 10),
      patient,
      therapist,
      insights,
    );

    let emailStatus = "sent";
    try {
      await resend.emails.send({
        from: "טיפול חכם <noreply@mentalytics.co.il>",
        to: REPORT_TO,
        subject: `דוח שבועי — ${current.since.slice(0, 10)} עד ${current.until.slice(0, 10)}`,
        html,
      });
    } catch (e) {
      emailStatus = `failed: ${e instanceof Error ? e.message : "unknown"}`;
    }

    const { error: insertErr } = await supabaseAdmin
      .from("weekly_reports")
      .upsert(
        {
          week_start: current.since.slice(0, 10),
          week_end: current.until.slice(0, 10),
          patient_data: patient,
          therapist_data: therapist,
          ai_summary: insights.summary,
          ai_recommendations: insights.recommendations,
          ai_silent_therapists_advice: insights.silentTherapistsAdvice,
          email_sent_to: REPORT_TO.join(", "),
          email_status: emailStatus,
        },
        { onConflict: "week_start" },
      );

    if (insertErr) {
      return { ok: false, error: `DB save failed: ${insertErr.message}`, emailStatus, status: 500 };
    }

    return { ok: true, week_start: current.since.slice(0, 10), emailStatus };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error", status: 500 };
  }
}

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get("user-agent")?.includes("vercel-cron");
  const hasSecret = CRON_SECRET && req.headers.get("authorization") === `Bearer ${CRON_SECRET}`;
  if (!isVercelCron && !hasSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await runWeeklyReport();
  const { status, ...body } = result;
  return NextResponse.json(body, { status: status ?? 200 });
}
