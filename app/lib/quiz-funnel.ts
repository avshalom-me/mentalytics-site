import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { startAgentRun, finishAgentRun, syncAgentAlerts } from "./agent-infra";
import { fetchAllRows } from "./fetch-all-rows";

// סוכן השאלונים: שומר על המשפך שדרכו נכנס כל הקהל.
//
// מה הוא *לא* עושה: מדווח כמה נושרים. את זה כבר יודעים - הנשירה מרוכזת
// בפתיחה (25% במבוגרים, 37% בילדים), היא נבדקה בשלושה סבבי שיפוץ, ודיווח
// יומי עליה הוא רעש.
//
// מה הוא כן עושה: משווה את המשפך של השבוע האחרון לשלושת השבועות שלפניו,
// ומתריע כשמשהו **השתנה לרעה**. זה סוג התקלה שאי אפשר לראות בעין: ביקורת
// ה-E2E מ-14/8 מצאה ידנית שכפתור "חזרה" בלע תחום שלם - באג שחי בשקט,
// ושהסוכן הזה היה תופס למחרת.
//
// למה יחס-לכניסה ולא סדר שלבים: השאלון מסתעף (e1/e4/r1 תלויים בתחומים
// שנבחרו), ואין רצף אחד שכולם עוברים. לעומת זאת היחס בין "כמה סשנים הגיעו
// לשלב X" ל"כמה נכנסו בכלל" יציב לאורך זמן, וירידה חדה בו היא אות אמיתי
// גם בשלב מסתעף.

const RECENT_DAYS = 7;
const BASELINE_DAYS = 28; // כולל את השבוע האחרון; הבסיס הוא ההפרש
// כמה סשנים צריך בבסיס כדי שהשוואה תהיה משמעותית. מתחת לזה הרעש גדול
// מהאות, ושלב נדיר היה מייצר התראה כל שבוע.
const MIN_BASELINE_SESSIONS = 20;
// ירידה בנקודות אחוז שמצדיקה התראה.
const DROP_ALERT_PP = 12;
const DROP_HIGH_PP = 22;

export type FunnelStep = {
  step: string;
  recentSessions: number;
  baselineSessions: number;
  recentRate: number; // 0-1, יחס לכניסה
  baselineRate: number;
  dropPp: number; // בנקודות אחוז; חיובי = הידרדרות
};

export type QuizFunnel = {
  quiz: string;
  entryStep: string;
  recentEntries: number;
  baselineEntries: number;
  recentCompletion: number; // 0-1
  baselineCompletion: number;
  steps: FunnelStep[];
};

export type QuizFunnelResult = {
  ok: boolean;
  funnels: QuizFunnel[];
  findings: number;
  error?: string;
};

type StepRow = { session_id: string | null; metadata: Record<string, unknown> | null; created_at: string };

/** סשנים ייחודיים לכל שלב. ספירת אירועים מטעה - שלב יכול להישלח כמה פעמים. */
function countByStep(rows: StepRow[]): Map<string, Set<string>> {
  const byStep = new Map<string, Set<string>>();
  for (const r of rows) {
    const step = String(r.metadata?.step ?? "").trim();
    const sid = r.session_id;
    if (!step || !sid) continue;
    let set = byStep.get(step);
    if (!set) byStep.set(step, (set = new Set()));
    set.add(sid);
  }
  return byStep;
}

/**
 * שלב הסיום של השאלון - זה שמסמן "הגיע עד הסוף". נבחר מהנתונים ולא
 * מקובע: שמות השלבים משתנים עם כל שיפוץ, ורשימה קשיחה הייתה מתיישנת
 * בשקט ומדווחת השלמה של אפס.
 */
const COMPLETION_STEPS = ["match-results", "p-result", "results", "match-form"];

function completionStepFor(steps: Map<string, Set<string>>): string | null {
  for (const s of COMPLETION_STEPS) if (steps.has(s)) return s;
  return null;
}

export async function runQuizFunnel(): Promise<QuizFunnelResult> {
  const runId = await startAgentRun("quiz_funnel");
  try {
    const since = new Date(Date.now() - BASELINE_DAYS * 86_400_000).toISOString();
    const recentCut = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString();

    // fetchAllRows: מעל 1000 שורות PostgREST חותך בשקט, ובנפח הזה
    // (12,400 אירועים ב-30 יום) זה קורה תמיד.
    const rows = await fetchAllRows<StepRow>(() =>
      supabaseAdmin
        .from("analytics_events")
        .select("session_id, metadata, created_at")
        .eq("event_type", "quiz_step")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
    );

    const byQuiz = new Map<string, { recent: StepRow[]; baseline: StepRow[] }>();
    for (const r of rows) {
      const quiz = String(r.metadata?.quiz_type ?? "").trim();
      if (!quiz) continue;
      let b = byQuiz.get(quiz);
      if (!b) byQuiz.set(quiz, (b = { recent: [], baseline: [] }));
      (r.created_at >= recentCut ? b.recent : b.baseline).push(r);
    }

    const funnels: QuizFunnel[] = [];
    const alerts: Parameters<typeof syncAgentAlerts>[1] = [];

    for (const [quiz, { recent, baseline }] of byQuiz) {
      const recentSteps = countByStep(recent);
      const baseSteps = countByStep(baseline);
      if (recentSteps.size === 0 || baseSteps.size === 0) continue;

      // הכניסה = השלב שהכי הרבה סשנים עברו. זה תמיד השלב הראשון במשפך.
      const entryStep = [...baseSteps.entries()].sort((a, b) => b[1].size - a[1].size)[0][0];
      const recentEntries = recentSteps.get(entryStep)?.size ?? 0;
      const baselineEntries = baseSteps.get(entryStep)?.size ?? 0;
      if (recentEntries < 10 || baselineEntries < MIN_BASELINE_SESSIONS) continue;

      const steps: FunnelStep[] = [];
      for (const [step, baseSet] of baseSteps) {
        const recentN = recentSteps.get(step)?.size ?? 0;
        const baselineRate = baseSet.size / baselineEntries;
        const recentRate = recentN / recentEntries;
        steps.push({
          step,
          recentSessions: recentN,
          baselineSessions: baseSet.size,
          recentRate,
          baselineRate,
          dropPp: +((baselineRate - recentRate) * 100).toFixed(1),
        });
      }
      steps.sort((a, b) => b.baselineRate - a.baselineRate);

      const compStep = completionStepFor(baseSteps);
      const recentCompletion = compStep ? (recentSteps.get(compStep)?.size ?? 0) / recentEntries : 0;
      const baselineCompletion = compStep ? (baseSteps.get(compStep)?.size ?? 0) / baselineEntries : 0;

      funnels.push({
        quiz,
        entryStep,
        recentEntries,
        baselineEntries,
        recentCompletion: +recentCompletion.toFixed(3),
        baselineCompletion: +baselineCompletion.toFixed(3),
        steps,
      });

      const quizLabel = quiz === "kids" ? "ילדים ונוער" : "מבוגרים";

      for (const st of steps) {
        if (st.baselineSessions < MIN_BASELINE_SESSIONS) continue;

        // שלב שנעלם לגמרי. זה לא "פחות אנשים הגיעו" אלא מסלול שנשבר -
        // בדיוק הצורה שבה כפתור "חזרה" בלע תחום שלם באוגוסט.
        if (st.recentSessions === 0) {
          alerts.push({
            actionType: "quiz_step_vanished",
            kind: "finding",
            severity: "critical",
            title: `שלב "${st.step}" בשאלון ה${quizLabel} נעלם מהנתונים`,
            body:
              `בשלושת השבועות שקדמו הגיעו אליו ${st.baselineSessions} סשנים ` +
              `(${Math.round(st.baselineRate * 100)}% מהנכנסים), ובשבוע האחרון אפס. ` +
              `שלב שנעלם לחלוטין הוא כמעט תמיד מסלול שנשבר, לא שינוי בהתנהגות.`,
            dedupeKey: `quiz:${quiz}:vanished:${st.step}`,
          });
          continue;
        }

        if (st.dropPp >= DROP_ALERT_PP) {
          alerts.push({
            actionType: "quiz_step_drop",
            kind: "finding",
            severity: st.dropPp >= DROP_HIGH_PP ? "high" : "normal",
            title: `נשירה גדלה בשלב "${st.step}" בשאלון ה${quizLabel}`,
            body:
              `${Math.round(st.baselineRate * 100)}% מהנכנסים הגיעו לשלב הזה בשלושת השבועות שקדמו, ` +
              `ורק ${Math.round(st.recentRate * 100)}% בשבוע האחרון (ירידה של ${st.dropPp} נקודות אחוז). ` +
              `${st.recentSessions} סשנים מול ${st.baselineSessions}.`,
            dedupeKey: `quiz:${quiz}:drop:${st.step}`,
          });
        }
      }

      // השלמת השאלון כולה - המדד היחיד שמסכם את הכול.
      const compDropPp = +((baselineCompletion - recentCompletion) * 100).toFixed(1);
      if (compStep && compDropPp >= DROP_ALERT_PP) {
        alerts.push({
          actionType: "quiz_completion_drop",
          kind: "finding",
          severity: "high",
          title: `שיעור השלמת שאלון ה${quizLabel} ירד`,
          body:
            `${Math.round(baselineCompletion * 100)}% מהנכנסים סיימו בשלושת השבועות שקדמו, ` +
            `ורק ${Math.round(recentCompletion * 100)}% בשבוע האחרון. ` +
            `נמדד עד השלב "${compStep}".`,
          dedupeKey: `quiz:${quiz}:completion`,
        });
      }
    }

    // כמה מטופלים סיימו שאלון וקיבלו בחירה דלה. זה לא באג בשאלון אלא
    // בהיצע - אבל הוא נמדד כאן, כי הוא הרגע שבו המשפך נגמר בלא כלום.
    const thin = await thinResultsFinding();
    if (thin) alerts.push(thin);

    const { created } = await syncAgentAlerts("quiz_funnel", alerts, {
      recoveryNote: "המדד חזר לרמת הבסיס - נסגר אוטומטית",
    });

    await finishAgentRun(runId, {
      status: alerts.length > 0 ? "ok" : "empty",
      summary:
        funnels.length === 0
          ? "אין מספיק נתונים להשוואה"
          : funnels
              .map(
                (f) =>
                  `${f.quiz}: ${Math.round(f.recentCompletion * 100)}% השלמה (בסיס ${Math.round(
                    f.baselineCompletion * 100
                  )}%)`
              )
              .join(" · ") + (alerts.length > 0 ? ` · ${alerts.length} ממצאים` : " · אין רגרסיה"),
      details: { funnels, findings: alerts.length },
    });

    return { ok: true, funnels, findings: created };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    await finishAgentRun(runId, { status: "error", error: msg });
    return { ok: false, funnels: [], findings: 0, error: msg };
  }
}

/**
 * חיפושי התאמה שהחזירו פחות מארבע אפשרויות. המדד הזה קיים רק מ-30/8/26
 * (לפני כן ה-constraint דחה את האירוע בשקט), ולכן הוא מדווח רק כשיש
 * מספיק נתונים - אחרת הוא היה מכריז "0% דל" על מדגם ריק.
 */
async function thinResultsFinding() {
  const since = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString();
  const { data } = await supabaseAdmin
    .from("analytics_events")
    .select("metadata")
    .eq("event_type", "match_results")
    .gte("created_at", since)
    .limit(1000);
  const rows = data ?? [];
  if (rows.length < 25) return null;

  const thin = rows.filter((r) => (r.metadata as { thin?: boolean } | null)?.thin === true).length;
  const pct = Math.round((thin / rows.length) * 100);
  if (pct < 25) return null;

  return {
    actionType: "quiz_thin_results",
    kind: "finding" as const,
    severity: (pct >= 50 ? "high" : "normal") as "high" | "normal",
    title: `${pct}% מחיפושי ההתאמה החזירו פחות מ-4 מטפלים`,
    body:
      `מתוך ${rows.length} חיפושים בשבוע האחרון, ${thin} הסתיימו בבחירה דלה. ` +
      `זה לא כשל בשאלון אלא בהיצע: המטופל סיים את כל התהליך וקיבל כמעט כלום. ` +
      `סוכן פערי ההיצע מציע מטפלים לחיתוכים החסרים.`,
    dedupeKey: "quiz:thin_results",
  };
}
