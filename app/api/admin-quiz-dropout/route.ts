import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import {
  ADULTS_TERMINAL_STEPS,
  KIDS_TERMINAL_STEPS,
  stepInfo,
} from "@/app/lib/quiz-step-content";

// סוכן ניתוח נשירה מהשאלונים — עונה על שלוש שאלות עבור כל שאלון:
// (1) איפה בדיוק נוטשים — לפי session אמיתי: השלב האחרון שכל משתמש ראה לפני
//     שנעלם (ולא השוואת מוני שלבים, שמתערבבת עם הסתעפות אדפטיבית של השאלון);
// (2) מה הסיבה האפשרית — היסקים דטרמיניסטיים (תוכן רגיש, מסך ארוך, זמן שהייה)
//     + שכבת AI שמנסחת השערות מעוגנות בנתונים ובתוכן האמיתי של כל מסך;
// (3) איך משפרים — המלצות קונקרטיות פר נקודת נטישה.
// מוגן ע"י ה-middleware של האדמין (כל /api/admin-*).

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Period = "week" | "month" | "all";

function periodToDate(period: Period): string | null {
  if (period === "all") return null;
  const ms = period === "week" ? 7 * 86_400_000 : 30 * 86_400_000;
  return new Date(Date.now() - ms).toISOString();
}

// PostgREST caps selects at 1000 rows — page through (same pattern as
// /api/admin-analytics, see the comment there).
async function fetchAllRows<T>(makeQuery: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> }): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await makeQuery().range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

// ── טיפוסי הפלט ───────────────────────────────────────────────────────────────

export type StepStat = {
  step: string;
  group: string;
  desc: string;
  reached: number;      // כמה sessions ביקרו בשלב
  exitedHere: number;   // כמה sessions נטשו כאן (השלב האחרון שלהם, ללא השלמה)
  exitRate: number;     // exitedHere / reached (באחוזים, מעוגל)
  medianSec: number | null; // זמן שהייה חציוני בשלב (שניות)
  avgProgress: number;  // מיקום קנוני בשאלון (ממוצע progress) — משמש למיון
  tags: string[];       // דגלים דטרמיניסטיים ("תוכן רגיש", "מסך ארוך"...)
};

export type QuizAnalysis = {
  started: number;
  completed: number;
  completionRate: number;      // אחוז
  medianDurationMin: number | null; // משך חציוני של מסיימים (דקות)
  dropouts: number;            // sessions שהתחילו ולא השלימו
  steps: StepStat[];           // כל השלבים בסדר קנוני
  topExits: StepStat[];        // נקודות הנטישה המשמעותיות, ממוינות לפי נוטשים
  postQuiz?: { results: number; matchForm: number; matchResults: number }; // מבוגרים
  sampleNote: string | null;   // אזהרת מדגם קטן
};

type QuizEvent = {
  event_type: string;
  session_id: string | null;
  metadata: { quiz_type?: string; step?: string; progress?: number } | null;
  created_at: string;
};

// ── האלגוריתם ─────────────────────────────────────────────────────────────────

const MAX_STEP_SEC = 30 * 60; // מעל 30 דק' על שלב = השאיר טאב פתוח, לא מאמץ אמיתי

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function heuristicTags(quiz: "adults" | "kids", step: string, medianSec: number | null): string[] {
  const info = stepInfo(quiz, step);
  const terminal = quiz === "adults" ? ADULTS_TERMINAL_STEPS : KIDS_TERMINAL_STEPS;
  const tags: string[] = [];
  if (info.sensitive) tags.push("תוכן רגיש");
  if (info.heavy || (info.items ?? 0) >= 6) tags.push("מסך ארוך / מאמץ גבוה");
  if (info.input === "gate") tags.push("שאלת שער (כן/לא)");
  if (info.input === "form") tags.push("טופס עם שדות חובה");
  if (medianSec != null && medianSec >= 90) tags.push("זמן שהייה גבוה");
  if (terminal.has(step) && info.input === "system") tags.push("מסך מערכת — נטישה כאן חשודה כתקלה");
  if (info.legacy) tags.push("שלב מגרסה ישנה של השאלון");
  return tags;
}

function analyzeQuiz(quiz: "adults" | "kids", events: QuizEvent[]): QuizAnalysis {
  const terminal = quiz === "adults" ? ADULTS_TERMINAL_STEPS : KIDS_TERMINAL_STEPS;

  type SessionAcc = { steps: { step: string; progress: number; at: number }[]; completed: boolean };
  const sessions = new Map<string, SessionAcc>();

  for (const e of events) {
    if (e.metadata?.quiz_type !== quiz) continue;
    const sid = e.session_id;
    if (!sid) continue; // בודדים היסטוריים בלי session — לא ניתנים לניתוח מסלול
    let s = sessions.get(sid);
    if (!s) {
      s = { steps: [], completed: false };
      sessions.set(sid, s);
    }
    if (e.event_type === "quiz_complete") {
      s.completed = true;
    } else if (e.event_type === "quiz_step" && e.metadata?.step) {
      s.steps.push({ step: e.metadata.step, progress: Number(e.metadata.progress) || 0, at: new Date(e.created_at).getTime() });
    }
  }

  const reached = new Map<string, Set<string>>();      // step -> session ids
  const exited = new Map<string, number>();            // step -> #sessions abandoned here
  const durations = new Map<string, number[]>();       // step -> seconds spent
  const progressSum = new Map<string, { sum: number; n: number }>();
  const completedDurations: number[] = [];
  let started = 0, completed = 0;
  const post = { results: 0, matchForm: 0, matchResults: 0 };

  for (const [sid, s] of sessions) {
    if (s.steps.length === 0) continue; // רק quiz_complete בלי שלבים — לא "התחיל" בטווח
    started++;
    s.steps.sort((a, b) => a.at - b.at);

    // ההשלמה נקבעת ע"י אירוע quiz_complete או הגעה למסך סיום (חגורה ושלייקס —
    // האירוע נורה בהגעה לתוצאות, אך רשת שנפלה בדיוק אז לא תסתיר את ההשלמה).
    const visitedTerminal = s.steps.some(st => terminal.has(st.step));
    const isCompleted = s.completed || visitedTerminal;
    if (isCompleted) {
      completed++;
      const span = (s.steps[s.steps.length - 1].at - s.steps[0].at) / 1000;
      if (span > 0 && span < 3 * 3600) completedDurations.push(span / 60);
    }

    const seen = new Set<string>();
    for (let i = 0; i < s.steps.length; i++) {
      const st = s.steps[i];
      if (!seen.has(st.step)) {
        seen.add(st.step);
        let r = reached.get(st.step);
        if (!r) { r = new Set(); reached.set(st.step, r); }
        r.add(sid);
      }
      const p = progressSum.get(st.step) ?? { sum: 0, n: 0 };
      p.sum += st.progress; p.n++;
      progressSum.set(st.step, p);
      if (i < s.steps.length - 1) {
        const sec = (s.steps[i + 1].at - st.at) / 1000;
        if (sec >= 1 && sec <= MAX_STEP_SEC) {
          const d = durations.get(st.step) ?? [];
          d.push(sec);
          durations.set(st.step, d);
        }
      }
    }

    // המשפך שאחרי השאלון (מבוגרים): כמה מהמסיימים המשיכו לחיפוש מטפל
    if (quiz === "adults" && isCompleted) {
      if (seen.has("results")) post.results++;
      if (seen.has("match-form")) post.matchForm++;
      if (seen.has("match-results")) post.matchResults++;
    }

    // נקודת הנטישה: השלב האחרון כרונולוגית של session שלא השלים.
    if (!isCompleted) {
      const last = s.steps[s.steps.length - 1].step;
      exited.set(last, (exited.get(last) ?? 0) + 1);
    }
  }

  const steps: StepStat[] = [...reached.entries()].map(([step, sids]) => {
    const info = stepInfo(quiz, step);
    const med = median(durations.get(step) ?? []);
    const ex = exited.get(step) ?? 0;
    const p = progressSum.get(step)!;
    return {
      step,
      group: info.group,
      desc: info.desc,
      reached: sids.size,
      exitedHere: ex,
      exitRate: sids.size > 0 ? Math.round((ex / sids.size) * 100) : 0,
      medianSec: med != null ? Math.round(med) : null,
      avgProgress: p.n > 0 ? p.sum / p.n : 0,
      tags: heuristicTags(quiz, step, med),
    };
  }).sort((a, b) => a.avgProgress - b.avgProgress);

  const topExits = steps
    .filter(s => s.exitedHere > 0)
    .sort((a, b) => b.exitedHere - a.exitedHere || b.exitRate - a.exitRate)
    .slice(0, 10);

  return {
    started,
    completed,
    completionRate: started > 0 ? Math.round((completed / started) * 100) : 0,
    medianDurationMin: (() => { const m = median(completedDurations); return m != null ? Math.round(m * 10) / 10 : null; })(),
    dropouts: started - completed,
    steps,
    topExits,
    ...(quiz === "adults" ? { postQuiz: post } : {}),
    sampleNote: started < 30 ? `מדגם קטן (${started} משתמשים) — האחוזים רועשים, להתייחס לכיוונים ולא למספרים מדויקים` : null,
  };
}

// ── שכבת ה-AI ────────────────────────────────────────────────────────────────

export type AiFinding = {
  step: string;
  title: string;
  evidence: string;
  likely_reasons: string[];
  suggestions: string[];
};
export type AiQuizReport = { summary: string; findings: AiFinding[]; quick_wins: string[] };
export type AiReport = { adults: AiQuizReport; kids: AiQuizReport };

function aiPayload(label: string, a: QuizAnalysis) {
  return {
    שאלון: label,
    התחילו: a.started,
    השלימו: a.completed,
    אחוז_השלמה: a.completionRate,
    נטשו: a.dropouts,
    משך_חציוני_למסיימים_בדקות: a.medianDurationMin,
    הערת_מדגם: a.sampleNote,
    משפך_אחרי_השאלון: a.postQuiz ?? undefined,
    נקודות_נטישה: a.topExits.map(s => ({
      שלב: s.step,
      רובריקה: s.group,
      מה_מוצג_שם: s.desc,
      הגיעו: s.reached,
      נטשו_כאן: s.exitedHere,
      אחוז_נטישה_מהמגיעים: s.exitRate,
      זמן_שהייה_חציוני_שניות: s.medianSec,
      דגלים: s.tags,
    })),
  };
}

const SYSTEM_PROMPT = `אתה אנליסט מוצר ו-UX עם רקע קליני, שמנתח נשירה משאלוני התאמת טיפול נפשי (פלטפורמת "טיפול חכם"). הנתונים חושבו מאירועי אנליטיקס אמיתיים: לכל משתמש זוהה השלב האחרון שבו היה לפני שנטש.

הקשר חשוב:
- השאלונים אדפטיביים: משתמשים מדלגים על ענפים שלא רלוונטיים להם, ולכן "כמה הגיעו לשלב" יורד גם בלי נשירה. השתמש רק בשדות נטשו_כאן / אחוז_נטישה_מהמגיעים כעדות לנטישה אמיתית.
- שאלון הילדים ממולא על ידי הורה על ילדו.
- "מה_מוצג_שם" מתאר את התוכן האמיתי של המסך — התבסס עליו, אל תמציא תוכן שלא מתואר.
- שלב עם דגל "מסך מערכת" (scoring) לא דורש קלט — נטישה בו מחשידה תקלה טכנית או המתנה ארוכה, לא חוסר מוטיבציה.
- נטישה בשלבי הפתיחה (לפני שאלה קלינית ראשונה) מעידה בדרך כלל על פער ציפיות/כוונה, לא על תוכן השאלון.

המשימה: עבור כל שאלון בנפרד — היכן בדיוק הנשירה, מהן הסיבות הסבירות, ואיך לשפר.

כללים:
- עדויות = אך ורק המספרים שסופקו. ציין מספרים מפורשים (למשל "12 מתוך 45 שהגיעו — 27%").
- אם הערת_מדגם קיימת — סייג את המסקנות בהתאם.
- סיבות: 2-3 השערות לכל ממצא, מנומקות מתוך תוכן המסך והדגלים (תוכן רגיש, אורך, זמן שהייה, מיקום בשאלון). נסח כהשערות, לא כעובדות.
- הצעות: קונקרטיות וישימות (פיצול מסך, הפיכת שדה לאופציונלי, חשיפה הדרגתית, ניסוח מרכך לשאלות רגישות, שמירת התקדמות, שינוי סדר, מיקרו-קופי מרגיע, בדיקה טכנית). לא "לשפר את חוויית המשתמש" באוויר.
- אל תציע להסיר תוכן קליני חיוני (סינון אובדנות למשל) — אפשר להציע ריכוך ניסוח או הסבר מדוע שואלים.
- אל תציע לוותר על הסכמה משפטית או להפוך אותה לאופציונלית — מותר להציע רק לשפר את הצגתה (קיצור, מבנה, מיקרו-קופי).
- עברית בלבד. עד 5 ממצאים לכל שאלון, החשובים ביותר תחילה (לפי כמות נוטשים, לא אחוז בודד על מדגם זעיר).

החזר JSON בלבד במבנה:
{
  "adults": { "summary": "2-3 משפטים על התמונה הכוללת", "findings": [{ "step": "מזהה השלב", "title": "כותרת קצרה", "evidence": "המספרים", "likely_reasons": ["..."], "suggestions": ["..."] }], "quick_wins": ["עד 3 פעולות מהירות"] },
  "kids": { אותו מבנה }
}`;

async function callAi(adults: QuizAnalysis, kids: QuizAnalysis): Promise<AiReport> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 3000,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          adults: aiPayload("שאלון מבוגרים", adults),
          kids: aiPayload("שאלון ילדים (ממולא ע\"י הורה)", kids),
        }, null, 1),
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(content) as Partial<AiReport>;
  const valid = (q: unknown): q is AiQuizReport => {
    const x = q as AiQuizReport;
    return Boolean(x && typeof x.summary === "string" && Array.isArray(x.findings) && Array.isArray(x.quick_wins));
  };
  if (!valid(parsed.adults) || !valid(parsed.kids)) {
    throw new Error("AI response missing required fields");
  }
  return parsed as AiReport;
}

// ניתוח AI עולה כסף וזהה לאורך שעות — cache קצר בזיכרון מונע ריצות כפולות
// (נשטף בכל cold start; זה בסדר, מדובר בכלי אדמין).
const cache = new Map<string, { at: number; body: unknown }>();
const CACHE_MS = 10 * 60_000;

export async function GET(req: NextRequest) {
  const requested = (req.nextUrl.searchParams.get("period") ?? "all") as Period;
  const validPeriods: Period[] = ["week", "month", "all"];
  const period: Period = validPeriods.includes(requested) ? requested : "all";
  const force = req.nextUrl.searchParams.get("force") === "1";
  const since = periodToDate(period);

  const cached = cache.get(period);
  if (!force && cached && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json(cached.body);
  }

  try {
    const events = await fetchAllRows<QuizEvent>(() => {
      let q = supabaseAdmin
        .from("analytics_events")
        .select("event_type, session_id, metadata, created_at")
        .in("event_type", ["quiz_step", "quiz_complete"])
        .order("created_at", { ascending: true });
      if (since) q = q.gte("created_at", since);
      return q;
    });

    const adults = analyzeQuiz("adults", events);
    const kids = analyzeQuiz("kids", events);

    let ai: AiReport | null = null;
    let aiError: string | null = null;
    if (!process.env.OPENAI_API_KEY) {
      aiError = "OPENAI_API_KEY לא מוגדר — מוצג הניתוח הדטרמיניסטי בלבד";
    } else if (adults.started === 0 && kids.started === 0) {
      aiError = "אין נתוני שאלונים בתקופה שנבחרה";
    } else {
      try {
        ai = await callAi(adults, kids);
      } catch (err) {
        console.error("[admin-quiz-dropout] AI call failed:", err);
        aiError = "ניתוח ה-AI נכשל — מוצג הניתוח הדטרמיניסטי בלבד";
      }
    }

    const body = { ok: true, period, adults, kids, ai, aiError, generated_at: new Date().toISOString() };
    cache.set(period, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
