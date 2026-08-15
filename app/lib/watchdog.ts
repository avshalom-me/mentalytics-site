import "server-only";
import { Resend } from "resend";
import { supabaseAdmin } from "./supabaseAdmin";
import { alertRecipients } from "./alert-recipients";
import { startAgentRun, finishAgentRun, createAgentAction } from "./agent-infra";
import { logEmail } from "./email-log";

// שומר הלילה (סוכן 2): בדיקות תקינות ליליות של המסלולים הקריטיים, מול
// האתר החי (HTTP אמיתי - בדיוק מה שמטופל רואה, לא קריאת פונקציות פנימית).
// כישלון נרשם כהצעת התראה בתור (dedupe: התראה פתוחה אחת לכל בדיקה) ומופיע
// בדוח הבוקר; מייל התראה מיידי נשלח רק כשהקרון חמוש ב-send=confirm.
//
// עקרונות בטיחות: קריאה בלבד; הניקוד רץ עם טוקן הצוות (לא שורף מכסה ולא
// נספר); קריאות ההתאמה בתרחישים שלא מפעילים את מנגנון הגיבוי (ולכן לא
// כותבים אירוע); ניסיון שני לפני שמכריזים כישלון - נגד התראות שווא.

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mentalytics.co.il";
const FROM = "טיפול חכם <noreply@mentalytics.co.il>";
const CHECK_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 3_000;

// רשימת האירועים שהקוד כותב ל-analytics_events - חייבת להתאים ל-CHECK
// בבסיס הנתונים. מקור האמת ב-DB: המיגרציה האחרונה שעדכנה את valid_event_type
// (כיום 20260813_quiz_treatments_event.sql). אירוע חדש בקוד = עדכון המיגרציה
// וגם הרשימה הזו; אם ה-DB לא עודכן - שומר הלילה יתפוס את הפער בלילה.
const EXPECTED_EVENT_TYPES = [
  "page_view",
  "profile_impression",
  "filter_used",
  "quiz_step",
  "quiz_complete",
  "quiz_treatments",
  "recommendation_explain_click",
  "match_free_fallback",
  "recruit_page_view",
  "therapist_explain_click",
  "matching_click",
  "match_saved",
];

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

async function runChecks(): Promise<WatchdogCheck[]> {
  const staffToken = process.env.STAFF_BYPASS_TOKEN ?? "";
  const checks: WatchdogCheck[] = [];

  // --- עמודי מפתח ---
  const pageChecks = await Promise.all([
    httpCheck("page_home", "עמוד הבית", `${SITE}/`, {
      validate: expectStatusAndContains("טיפול"),
    }),
    httpCheck("page_adults", "עמוד שאלון מבוגרים", `${SITE}/adults`, {
      validate: expectStatusAndContains("טיפול"),
    }),
    httpCheck("page_kids", "עמוד שאלון ילדים", `${SITE}/kids`, {
      validate: expectStatusAndContains("טיפול"),
    }),
    httpCheck("sitemap", "מפת אתר", `${SITE}/sitemap.xml`, {
      validate: expectStatusAndContains("<urlset"),
    }),
    httpCheck("robots", "robots.txt", `${SITE}/robots.txt`, {
      validate: expectStatusAndContains("User-"),
    }),
  ]);
  checks.push(...pageChecks);

  // --- API השאלונים ---
  const questionsValidate = (status: number, text: string): string | null => {
    if (status !== 200) return `סטטוס ${status}`;
    const json = parseJson(text);
    if (!json) return "התשובה אינה JSON תקין";
    const arrays = Object.values(json).filter((v) => Array.isArray(v) && v.length > 0);
    if (arrays.length < 3) return "מבנה השאלות חסר (פחות מ-3 מערכים מלאים)";
    return null;
  };
  const questionChecks = await Promise.all([
    httpCheck(
      "api_questions_adults",
      "טעינת שאלות מבוגרים",
      `${SITE}/api/questionnaire/adults/questions`,
      { validate: questionsValidate }
    ),
    httpCheck(
      "api_questions_kids",
      "טעינת שאלות ילדים",
      `${SITE}/api/questionnaire/kids/questions`,
      { validate: questionsValidate }
    ),
  ]);
  checks.push(...questionChecks);

  // --- ניקוד (עם טוקן צוות; אם אינו מוגדר - מדלגים בלי להיכשל) ---
  if (staffToken) {
    const scoreValidate = (status: number, text: string): string | null => {
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
    const scoreChecks = await Promise.all([
      httpCheck("api_score_adults", "מנוע ניקוד מבוגרים", `${SITE}/api/questionnaire/adults/score`, {
        method: "POST",
        body: { domains: [], _staffToken: staffToken },
        validate: scoreValidate,
      }),
      httpCheck("api_score_kids", "מנוע ניקוד ילדים", `${SITE}/api/questionnaire/kids/score`, {
        method: "POST",
        body: { _staffToken: staffToken },
        validate: kidsScoreValidate,
      }),
    ]);
    checks.push(...scoreChecks);
  } else {
    checks.push(
      { key: "api_score_adults", label: "מנוע ניקוד מבוגרים", ok: true, skipped: true, detail: "דולג - STAFF_BYPASS_TOKEN לא מוגדר", ms: 0 },
      { key: "api_score_kids", label: "מנוע ניקוד ילדים", ok: true, skipped: true, detail: "דולג - STAFF_BYPASS_TOKEN לא מוגדר", ms: 0 }
    );
  }

  // --- מנוע ההתאמה (תרחישים שלא מפעילים גיבוי חינמי ולא כותבים אירועים) ---
  const matchValidate = (status: number, text: string): string | null => {
    if (status !== 200) return `סטטוס ${status}`;
    const json = parseJson(text);
    if (!json || json.ok !== true) return "התשובה חזרה בלי ok:true";
    const returned = typeof json.returned === "number" ? json.returned : 0;
    if (returned < 1) return "אפס תוצאות התאמה";
    return null;
  };
  const matchChecks = await Promise.all([
    // "גוש דן" - שם האזור הקנוני מ-app/lib/regions.ts (לא "מרכז").
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
  ]);
  checks.push(...matchChecks);

  // --- דריפט של constraint האירועים ---
  {
    const started = Date.now();
    let ok = false;
    let detail = "";
    try {
      const { data, error } = await supabaseAdmin.rpc("admin_event_constraint_def");
      if (error) {
        detail = `שגיאת RPC: ${error.message}`;
      } else {
        const def = String(data ?? "");
        const missing = EXPECTED_EVENT_TYPES.filter((ev) => !def.includes(`'${ev}'`));
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
    checks.push({ key: "db_event_constraint", label: "התאמת סוגי אירועי אנליטיקה", ok, detail, ms: Date.now() - started });
  }

  // --- טריות קרונים (לפי עקבות שהם משאירים) ---
  {
    const started = Date.now();
    const freshness: { key: string; label: string; query: Promise<{ ok: boolean; detail: string }> }[] = [
      {
        key: "cron_daily_digest",
        label: "בקר הבוקר רץ ביממה האחרונה",
        query: (async () => {
          const { data } = await supabaseAdmin
            .from("agent_runs")
            .select("started_at")
            .eq("agent", "daily_digest")
            .order("started_at", { ascending: false })
            .limit(1);
          const last = data?.[0]?.started_at;
          if (!last) return { ok: false, detail: "אין אף ריצה ביומן" };
          const hours = (Date.now() - new Date(last).getTime()) / 3_600_000;
          return hours <= 26
            ? { ok: true, detail: "תקין" }
            : { ok: false, detail: `הריצה האחרונה לפני ${Math.round(hours)} שעות` };
        })(),
      },
      {
        key: "cron_weekly_report",
        label: "דוח שבועי נוצר בשבוע האחרון",
        query: (async () => {
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
        })(),
      },
      {
        key: "cron_monthly_report",
        label: "דוח חודשי נוצר בחודש האחרון",
        query: (async () => {
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
        })(),
      },
    ];
    for (const f of freshness) {
      try {
        const r = await f.query;
        checks.push({ key: f.key, label: f.label, ok: r.ok, detail: r.detail, ms: Date.now() - started });
      } catch (e) {
        checks.push({
          key: f.key,
          label: f.label,
          ok: false,
          detail: e instanceof Error ? e.message : String(e),
          ms: Date.now() - started,
        });
      }
    }
  }

  return checks;
}

export async function runWatchdog(opts: { send: boolean }): Promise<WatchdogResult> {
  const mode = opts.send ? "send" : "preview";
  const runId = await startAgentRun("watchdog", mode);

  try {
    const checks = await runChecks();
    const failures = checks.filter((c) => !c.ok);

    // כל כישלון נכנס לתור ההצעות כהתראה - אחת פתוחה לכל בדיקה (dedupe),
    // כך שדוח הבוקר מציג אותה גם אם מייל ההתראה עוד לא חמוש.
    for (const f of failures) {
      await createAgentAction({
        agent: "watchdog",
        actionType: "alert",
        title: `בדיקה לילית נכשלה: ${f.label}`,
        body: f.detail,
        dedupeKey: `watchdog:${f.key}`,
      });
    }

    let emailStatus: "sent" | "failed" | "skipped" = "skipped";
    let sendError = "";
    if (failures.length > 0 && opts.send && process.env.RESEND_API_KEY) {
      const recipients = alertRecipients();
      const subject = `⚠️ שומר הלילה: ${failures.length} בדיקות נכשלו`;
      const html = `
      <div dir="rtl" style="font-family:'Heebo','Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#131F1E">
        <div style="font-size:18px;font-weight:900;margin-bottom:12px">${subject}</div>
        <ul style="padding-inline-start:18px;color:#3E5250;font-size:14px;line-height:1.8">
          ${failures.map((f) => `<li><b>${f.label}</b>: ${f.detail}</li>`).join("")}
        </ul>
        <div style="font-size:12px;color:#6B807E;margin-top:16px">
          פירוט מלא ביומן הריצות: ${SITE}/admin/agents
        </div>
      </div>`;
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { error } = await resend.emails.send({ from: FROM, to: recipients, subject, html });
        if (error) {
          emailStatus = "failed";
          sendError = error.message;
        } else {
          emailStatus = "sent";
        }
      } catch (e) {
        emailStatus = "failed";
        sendError = e instanceof Error ? e.message : String(e);
      }
      void logEmail({
        recipient: recipients.join(","),
        recipientType: "other",
        subject,
        template: "agent_watchdog_alert",
        sentBy: "cron",
        status: emailStatus === "sent" ? "sent" : "failed",
        error: sendError || undefined,
      });
    }

    const passed = checks.filter((c) => c.ok && !c.skipped).length;
    const skipped = checks.filter((c) => c.skipped).length;
    await finishAgentRun(runId, {
      status: failures.length > 0 ? "error" : "ok",
      summary:
        failures.length > 0
          ? `⚠️ נכשלו ${failures.length} מתוך ${checks.length} בדיקות: ${failures.map((f) => f.label).join(", ")}`
          : `כל ${passed} הבדיקות עברו${skipped > 0 ? ` (${skipped} דולגו)` : ""}`,
      details: {
        mode,
        checks: checks.map((c) => ({ key: c.key, ok: c.ok, skipped: c.skipped ?? false, detail: c.detail, ms: c.ms })),
        email_status: emailStatus,
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
