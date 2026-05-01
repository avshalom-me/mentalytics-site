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
};

async function aggregateTherapistData(period: Period): Promise<TherapistData> {
  const { data: therapists } = await supabaseAdmin
    .from("therapists")
    .select("id, status, therapist_types, training_areas, regions, gender, created_at")
    .in("status", ["paying", "approved"]);

  const list = (therapists ?? []) as {
    id: string;
    status: string;
    therapist_types: string[] | null;
    training_areas: string[] | null;
    regions: string[] | null;
    gender: string | null;
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
  };
}

// ── LLM SYNTHESIS ───────────────────────────────────────────────────

async function generateInsights(
  current: { patient: PatientData; therapist: TherapistData },
  previous: { patient: PatientData; therapist: TherapistData },
  weekStart: string,
  weekEnd: string,
): Promise<{ summary: string; recommendations: string }> {
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

---

אנא הפק שני חלקים נפרדים, בעברית פשוטה וברורה:

**חלק 1 — סיכום השבוע (5-7 משפטים):**
מצב כללי, מגמות בולטות מול השבוע הקודם, ושני-שלושה דברים שראויים לתשומת לב מיידית.

**חלק 2 — המלצות פעולה ממוקדות (3-6 פעולות):**
זהה גאפים בין ביקוש להיצע (אזורים/נושאים שמבוקשים אבל אין מספיק מטפלים, או להפך). תן המלצות קונקרטיות לפרסום ממוקד — מי הקהל (מטפלים או מטופלים), איזה אזור/תחום, ולמה. כל המלצה במשפט-שניים, עם הסבר מספרי קצר.

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

  const split = text.split(/\*\*חלק 2.*?\*\*/);
  const summary = (split[0] ?? text).replace(/\*\*חלק 1.*?\*\*/, "").trim();
  const recommendations = (split[1] ?? "").trim();

  return { summary, recommendations };
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

function buildEmailHtml(
  weekStart: string,
  weekEnd: string,
  patient: PatientData,
  therapist: TherapistData,
  insights: { summary: string; recommendations: string },
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

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get("user-agent")?.includes("vercel-cron");
  const hasSecret = CRON_SECRET && req.headers.get("authorization") === `Bearer ${CRON_SECRET}`;
  if (!isVercelCron && !hasSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

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
          email_sent_to: REPORT_TO.join(", "),
          email_status: emailStatus,
        },
        { onConflict: "week_start" },
      );

    if (insertErr) {
      return NextResponse.json({ ok: false, error: `DB save failed: ${insertErr.message}`, emailStatus }, { status: 500 });
    }

    return NextResponse.json({ ok: true, week_start: current.since.slice(0, 10), emailStatus });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
