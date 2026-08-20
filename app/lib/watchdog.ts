import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { startAgentRun, finishAgentRun, syncAgentAlerts, agentEnabled } from "./agent-infra";
import { sendOpsEmail, escapeHtml } from "./ops-email";
import { ANALYTICS_EVENT_TYPES } from "./analytics-event-types";

// שומר הלילה (סוכן 2): בדיקות תקינות ליליות של המסלולים הקריטיים, מול
// האתר החי (HTTP אמיתי - בדיוק מה שמטופל רואה, לא קריאת פונקציות פנימית).
// כישלון נרשם כהצעת התראה בתור (dedupe: התראה פתוחה אחת לכל בדיקה) ומופיע
// בדוח הבוקר; מייל התראה מיידי נשלח רק כשהקרון חמוש ב-send=confirm.
//
// עקרונות בטיחות: קריאה בלבד; הניקוד רץ עם טוקן הצוות (לא שורף מכסה ולא
// נספר); קריאות ההתאמה בתרחישים שלא מפעילים את מנגנון הגיבוי (ולכן לא
// כותבים אירוע); ניסיון שני לפני שמכריזים כישלון - נגד התראות שווא.
//
// כל הבדיקות עצמאיות ולכן רצות במקביל אחד: זמן הריצה חסום בבדיקה האיטית
// ביותר (~33 שניות במקרה הגרוע), לא בסכום - כך גם הרצה ידנית מהאדמין
// נשארת הרחק מתקרת הזמן של הפונקציה (ממצא ביקורת 16/8).

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mentalytics.co.il";
const CHECK_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 3_000;

export type WatchdogCheck = {
  key: string;
  label: string;
  ok: boolean;
  skipped?: boolean;
  detail: string;
  ms: number;
};

export type WatchdogResult = {
  ok: boolean;
  mode: "preview" | "send";
  checks: WatchdogCheck[];
  failures: WatchdogCheck[];
  emailStatus?: "sent" | "failed" | "skipped";
  error?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit
): Promise<{ status: number; text: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    const text = await res.text();
    return { status: res.status, text };
  } finally {
    clearTimeout(timer);
  }
}

// בדיקת HTTP עם ניסיון חוזר: כישלון רשת רגעי או 5xx חולף לא מעיר אף אחד.
async function httpCheck(
  key: string,
  label: string,
  url: string,
  opts: {
    method?: "GET" | "POST";
    body?: unknown;
    // מחזיר null אם תקין, אחרת תיאור הבעיה.
    validate: (status: number, text: string) => string | null;
  }
): Promise<WatchdogCheck> {
  const started = Date.now();
  const attempt = async (): Promise<string | null> => {
    try {
      const init: RequestInit =
        opts.method === "POST"
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(opts.body ?? {}),
            }
          : {};
      const { status, text } = await fetchWithTimeout(url, init);
      return opts.validate(status, text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // AbortError של ה-timeout מתורגם להודעה שאומרת מה באמת קרה.
      return msg.includes("abort") ? `לא נענה תוך ${CHECK_TIMEOUT_MS / 1000} שניות` : msg;
    }
  };

  let problem = await attempt();
  if (problem !== null) {
    await sleep(RETRY_DELAY_MS);
    problem = await attempt();
  }
  return {
    key,
    label,
    ok: problem === null,
    detail: problem === null ? "תקין" : problem,
    ms: Date.now() - started,
  };
}

function skippedCheck(key: string, label: string, reason: string): WatchdogCheck {
  return { key, label, ok: true, skipped: true, detail: reason, ms: 0 };
}

function expectStatusAndContains(needle: string) {
  return (status: number, text: string): string | null => {
    if (status !== 200) return `סטטוס ${status}`;
    if (!text.includes(needle)) return `התוכן הצפוי ("${needle}") לא נמצא בתשובה`;
    return null;
  };
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// --- בדיקות בסיס נתונים וטריות (עצמאיות, נבנות כהבטחות) ---

async function eventConstraintCheck(): Promise<WatchdogCheck> {
  const started = Date.now();
  let ok = false;
  let detail = "";
  try {
    const { data, error } = await supabaseAdmin.rpc("admin_event_constraint_def");
    if (error) {
      detail = `שגיאת RPC: ${error.message}`;
    } else {
      const def = String(data ?? "");
      const missing = ANALYTICS_EVENT_TYPES.filter((ev) => !def.includes(`'${ev}'`));
      if (def.length === 0) {
        detail = "ה-constraint לא נמצא בבסיס הנתונים";
      } else if (missing.length > 0) {
        detail = `אירועים שהקוד שולח וה-DB ידחה בשקט: ${missing.join(", ")}`;
      } else {
        ok = true;
        detail = "תקין";
      }
    }
  } catch (e) {
    detail = e instanceof Error ? e.message : String(e);
  }
  return { key: "db_event_constraint", label: "התאמת סוגי אירועי אנליטיקה", ok, detail, ms: Date.now() - started };
}

async function freshnessCheck(
  key: string,
  label: string,
  probe: () => Promise<{ ok: boolean; detail: string }>
): Promise<WatchdogCheck> {
  const started = Date.now();
  try {
    const r = await probe();
    return { key, label, ok: r.ok, detail: r.detail, ms: Date.now() - started };
  } catch (e) {
    return {
      key,
      label,
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
      ms: Date.now() - started,
    };
  }
}

// טריות של סוכן: מתי רץ לאחרונה. בלי זה, קרון שהפסיק לרוץ (תקלה בוורסל,
// מתג שנכבה בטעות, מסלול שנמחק) הוא כשל שקט - הפס באדמין פשוט מציג תאריך
// ישן, ואף אחד לא מתריע. סוכן שכובה במתג מדלג ולא נכשל, כדי ששני מנגנוני
// הבטיחות לא יתנגשו.
function agentFreshnessCheck(agent: string, label: string, maxHours: number): Promise<WatchdogCheck> {
  const key = `cron_${agent}`;
  if (!agentEnabled(agent)) {
    return Promise.resolve(skippedCheck(key, label, "דולג - הסוכן כבוי במתג"));
  }
  return freshnessCheck(key, label, async () => {
    const { data } = await supabaseAdmin
      .from("agent_runs")
      .select("started_at")
      .eq("agent", agent)
      .order("started_at", { ascending: false })
      .limit(1);
    const last = data?.[0]?.started_at;
    if (!last) return { ok: false, detail: "אין אף ריצה ביומן" };
    const hours = (Date.now() - new Date(last).getTime()) / 3_600_000;
    return hours <= maxHours
      ? { ok: true, detail: "תקין" }
      : { ok: false, detail: `הריצה האחרונה לפני ${Math.round(hours)} שעות` };
  });
}

async function runChecks(): Promise<WatchdogCheck[]> {
  const staffToken = process.env.STAFF_BYPASS_TOKEN ?? "";

  const questionsValidate = (status: number, text: string): string | null => {
    if (status !== 200) return `סטטוס ${status}`;
    const json = parseJson(text);
    if (!json) return "התשובה אינה JSON תקין";
    const arrays = Object.values(json).filter((v) => Array.isArray(v) && v.length > 0);
    if (arrays.length < 3) return "מבנה השאלות חסר (פחות מ-3 מערכים מלאים)";
    return null;
  };

  const adultsScoreValidate = (status: number, text: string): string | null => {
    if (status !== 200) return `סטטוס ${status}`;
    const json = parseJson(text);
    if (!json || json.ok !== true) return "התשובה חזרה בלי ok:true";
    if (!Array.isArray(json.recommendations)) return "חסר מערך recommendations";
    return null;
  };

  // מבנה תשובת הילדים שונה מהמבוגרים: מערכי תחומים במקום recommendations.
  const kidsScoreValidate = (status: number, text: string): string | null => {
    if (status !== 200) return `סטטוס ${status}`;
    const json = parseJson(text);
    if (!json || json.ok !== true) return "התשובה חזרה בלי ok:true";
    const domains = ["emotional", "academic", "developmental", "behavioral", "social"];
    const present = domains.filter((d) => Array.isArray(json[d]));
    if (present.length < 3) return "מבנה תשובת הניקוד השתנה (חסרים מערכי תחומים)";
    return null;
  };

  const matchValidate = (status: number, text: string): string | null => {
    if (status !== 200) return `סטטוס ${status}`;
    const json = parseJson(text);
    if (!json || json.ok !== true) return "התשובה חזרה בלי ok:true";
    const returned = typeof json.returned === "number" ? json.returned : 0;
    if (returned < 1) return "אפס תוצאות התאמה";
    return null;
  };

  // כל ההבטחות נבנות כאן, במקביל מלא; הסדר במערך קובע את סדר התצוגה.
  const promises: Promise<WatchdogCheck>[] = [
    // עמודי מפתח
    httpCheck("page_home", "עמוד הבית", `${SITE}/`, { validate: expectStatusAndContains("טיפול") }),
    httpCheck("page_adults", "עמוד שאלון מבוגרים", `${SITE}/adults`, { validate: expectStatusAndContains("טיפול") }),
    httpCheck("page_kids", "עמוד שאלון ילדים", `${SITE}/kids`, { validate: expectStatusAndContains("טיפול") }),
    httpCheck("sitemap", "מפת אתר", `${SITE}/sitemap.xml`, { validate: expectStatusAndContains("<urlset") }),
    httpCheck("robots", "robots.txt", `${SITE}/robots.txt`, { validate: expectStatusAndContains("User-") }),
    // API השאלונים
    httpCheck("api_questions_adults", "טעינת שאלות מבוגרים", `${SITE}/api/questionnaire/adults/questions`, {
      validate: questionsValidate,
    }),
    httpCheck("api_questions_kids", "טעינת שאלות ילדים", `${SITE}/api/questionnaire/kids/questions`, {
      validate: questionsValidate,
    }),
    // ניקוד (עם טוקן צוות; אם אינו מוגדר - מדלגים בלי להיכשל)
    staffToken
      ? httpCheck("api_score_adults", "מנוע ניקוד מבוגרים", `${SITE}/api/questionnaire/adults/score`, {
          method: "POST",
          body: { domains: [], _staffToken: staffToken },
          validate: adultsScoreValidate,
        })
      : Promise.resolve(skippedCheck("api_score_adults", "מנוע ניקוד מבוגרים", "דולג - STAFF_BYPASS_TOKEN לא מוגדר")),
    staffToken
      ? httpCheck("api_score_kids", "מנוע ניקוד ילדים", `${SITE}/api/questionnaire/kids/score`, {
          method: "POST",
          body: { _staffToken: staffToken },
          validate: kidsScoreValidate,
        })
      : Promise.resolve(skippedCheck("api_score_kids", "מנוע ניקוד ילדים", "דולג - STAFF_BYPASS_TOKEN לא מוגדר")),
    // מנוע ההתאמה - "גוש דן" הוא שם האזור הקנוני מ-app/lib/regions.ts;
    // התרחישים לא מפעילים גיבוי חינמי ולא כותבים אירועים.
    httpCheck("api_match_region", "התאמה לפי אזור (גוש דן)", `${SITE}/api/match`, {
      method: "POST",
      body: { region: "גוש דן", limit: 3 },
      validate: matchValidate,
    }),
    httpCheck("api_match_online", "התאמה אונליין", `${SITE}/api/match`, {
      method: "POST",
      body: { online: true, limit: 3 },
      validate: matchValidate,
    }),
    // דריפט constraint האירועים
    eventConstraintCheck(),
    // טריות קרונים. בקר הבוקר: אם כובה במתג - הבדיקה מדלגת במקום להתריע
    // על כיבוי מכוון (ממצא ביקורת: שני מנגנוני הבטיחות התנגשו).
    // הסוכנים שומרים זה על זה: כל סוכן יומי נבדק ל-26 שעות, ופערי ההיצע
    // (שרץ שבועית) ל-8 ימים. השומר עצמו לא מופיע כאן - סוכן לא יכול
    // להתריע על היעדרות של עצמו, וזה פער מודע.
    agentFreshnessCheck("daily_digest", "בקר הבוקר רץ ביממה האחרונה", 26),
    agentFreshnessCheck("ads", "סוכן הפרסום רץ ביממה האחרונה", 26),
    agentFreshnessCheck("conversions", "סוכן ההמרות רץ ביממה האחרונה", 26),
    agentFreshnessCheck("finance", "סוכן הכספים רץ ביממה האחרונה", 26),
    agentFreshnessCheck("retention", "סוכן השימור רץ ביממה האחרונה", 26),
    agentFreshnessCheck("supply_gaps", "סוכן פערי ההיצע רץ בשבוע האחרון", 8 * 24),
    freshnessCheck("cron_weekly_report", "דוח שבועי נוצר בשבוע האחרון", async () => {
      const { data } = await supabaseAdmin
        .from("weekly_reports")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      const last = data?.[0]?.created_at;
      if (!last) return { ok: false, detail: "אין אף דוח שבועי" };
      const days = (Date.now() - new Date(last).getTime()) / 86_400_000;
      return days <= 8
        ? { ok: true, detail: "תקין" }
        : { ok: false, detail: `הדוח האחרון לפני ${Math.round(days)} ימים` };
    }),
    freshnessCheck("cron_monthly_report", "דוח חודשי נוצר בחודש האחרון", async () => {
      const { data } = await supabaseAdmin
        .from("monthly_admin_reports")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      const last = data?.[0]?.created_at;
      if (!last) return { ok: false, detail: "אין אף דוח חודשי" };
      const days = (Date.now() - new Date(last).getTime()) / 86_400_000;
      return days <= 33
        ? { ok: true, detail: "תקין" }
        : { ok: false, detail: `הדוח האחרון לפני ${Math.round(days)} ימים` };
    }),
  ];

  return Promise.all(promises);
}

export async function runWatchdog(opts: { send: boolean }): Promise<WatchdogResult> {
  const mode = opts.send ? "send" : "preview";
  const runId = await startAgentRun("watchdog", mode);

  try {
    const checks = await runChecks();
    const failures = checks.filter((c) => !c.ok);

    // כישלונות לתור + החלמה אוטומטית, דרך המנגנון המשותף: בדיקה שחזרה
    // לעבור סוגרת את ההתראה שלה. בדיקות שדולגו אינן במפתחות המנוהלים,
    // כדי שדילוג לא ייראה כהחלמה.
    const managedKeys = checks.filter((c) => !c.skipped).map((c) => `watchdog:${c.key}`);
    const { recovered } = await syncAgentAlerts(
      "watchdog",
      failures.map((f) => ({
        actionType: "alert",
        // ממצא: נכון כל עוד הבדיקה נכשלת, ונסגר מעצמו כשהיא חוזרת לעבור.
        kind: "finding" as const,
        title: `בדיקה לילית נכשלה: ${f.label}`,
        body: f.detail,
        dedupeKey: `watchdog:${f.key}`,
      })),
      { managedKeys, recoveryNote: "הבדיקה חזרה לעבור - נסגר אוטומטית" }
    );

    let emailStatus: "sent" | "failed" | "skipped" = "skipped";
    let sendError = "";
    if (failures.length > 0 && opts.send) {
      const subject = `⚠️ שומר הלילה: ${failures.length} בדיקות נכשלו`;
      const html = `
      <div dir="rtl" style="font-family:'Heebo','Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#131F1E">
        <div style="font-size:18px;font-weight:900;margin-bottom:12px">${escapeHtml(subject)}</div>
        <ul style="padding-inline-start:18px;color:#3E5250;font-size:14px;line-height:1.8">
          ${failures.map((f) => `<li><b>${escapeHtml(f.label)}</b>: ${escapeHtml(f.detail)}</li>`).join("")}
        </ul>
        <div style="font-size:12px;color:#6B807E;margin-top:16px">
          פירוט מלא ביומן הריצות: ${SITE}/admin/agents
        </div>
      </div>`;
      const sent = await sendOpsEmail({ subject, html, template: "agent_watchdog_alert" });
      emailStatus = sent.status;
      sendError = sent.error ?? "";
    }

    const passed = checks.filter((c) => c.ok && !c.skipped).length;
    const skipped = checks.filter((c) => c.skipped).length;
    await finishAgentRun(runId, {
      status: failures.length > 0 ? "error" : "ok",
      summary:
        (failures.length > 0
          ? `⚠️ נכשלו ${failures.length} מתוך ${checks.length} בדיקות: ${failures.map((f) => f.label).join(", ")}`
          : `כל ${passed} הבדיקות עברו${skipped > 0 ? ` (${skipped} דולגו)` : ""}`) +
        (recovered > 0 ? ` · ${recovered} התראות נסגרו אוטומטית (החלימו)` : ""),
      details: {
        mode,
        checks: checks.map((c) => ({ key: c.key, ok: c.ok, skipped: c.skipped ?? false, detail: c.detail, ms: c.ms })),
        email_status: emailStatus,
        recovered_alerts: recovered,
      },
      error: failures.length > 0 ? failures.map((f) => `${f.key}: ${f.detail}`).join(" | ") : undefined,
    });

    return { ok: true, mode, checks, failures, emailStatus, error: sendError || undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishAgentRun(runId, { status: "error", error: msg });
    return { ok: false, mode, checks: [], failures: [], error: msg };
  }
}
