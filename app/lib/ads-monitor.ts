import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { fetchGoogleAdsCampaigns, googleAdsConfigured, type AdsCampaign } from "./google-ads";
import { startAgentRun, finishAgentRun, syncAgentAlerts } from "./agent-infra";

// סוכן הפרסום (סוכן 4): מצליב כל בוקר את ההוצאה בגוגל מול המשפך הפנימי
// שלנו, ומעלה לתור הצעות ממצאים שדורשים החלטה - קמפיין ששורף כסף בלי
// תוצאה, עלות-ללחיצת-פנייה מעל היעד העסקי, חריגה מקצב התקציב, וקמפיין
// שאי אפשר למדוד בכלל.
//
// קריאה בלבד: הסוכן לא נוגע בקמפיינים ולא משנה תקציבים. הוא מנסח מה כדאי
// לעשות, ואתה מבצע בממשק של גוגל אחרי אישור. אין כאן מייל ואין חימוש -
// הממצאים מופיעים בתור, בדוח הבוקר ובעמוד הסוכנים.
//
// מקורות: fetchGoogleAdsCampaigns (חיבור הקריאה הקיים) + ה-RPC
// admin_campaign_funnel שכבר משרת את דשבורד השיווק. החיבור ביניהם הוא
// utm_campaign - בדיוק כמו בטאב הקמפיינים.

const LOOKBACK_DAYS = 7;
// תקציב חודשי מתוכנן לפרסום (₪). ניתן לעקוף בסביבה בלי דיפלוי.
const MONTHLY_BUDGET = Number(process.env.ADS_MONTHLY_BUDGET ?? 2000);
// מעל כמה הוצאה בשבוע בלי אף לחיצת פנייה מתריעים.
const MIN_SPEND_FOR_ZERO_ALERT = Number(process.env.ADS_MIN_SPEND_ALERT ?? 150);
// חריגה מקצב התקציב שמעליה מתריעים (1.2 = 20% מעל הקצב היחסי).
const PACE_TOLERANCE = 1.2;
// יעד עלות ללחיצת פנייה כשאין יעד בתוכנית העסקית.
const FALLBACK_MAX_CPL = Number(process.env.ADS_MAX_CPL ?? 250);

export type AdsFinding = {
  key: string;
  severity: "high" | "normal";
  title: string;
  detail: string;
};

export type AdsMonitorResult = {
  ok: boolean;
  configured: boolean;
  findings: AdsFinding[];
  campaigns: {
    name: string;
    utm: string | null;
    cost: number;
    clicks: number;
    contacts: number;
    cpl: number | null;
  }[];
  spendMtd: number;
  budgetPace: { expected: number; actual: number } | null;
  error?: string;
};

type FunnelRow = {
  campaign: string | null;
  sessions: number | null;
  contacting_people: number | null;
  contacts: number | null;
};

function ils(n: number): string {
  return `₪${Math.round(n).toLocaleString("he-IL")}`;
}

// יעד עלות-ללחיצה מהתוכנית העסקית (plan_targets.metric='cpl_max'),
// הרשומה הקרובה ביותר לחודש הנוכחי; נפילה לברירת מחדל אם אין.
async function maxCplTarget(): Promise<{ value: number; fromPlan: boolean }> {
  try {
    const { data } = await supabaseAdmin
      .from("plan_targets")
      .select("metric, month, target")
      .eq("metric", "cpl_max")
      .order("month", { ascending: false })
      .limit(1);
    const raw = data?.[0]?.target;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return { value: n, fromPlan: true };
  } catch {
    /* ממשיכים עם ברירת המחדל */
  }
  return { value: FALLBACK_MAX_CPL, fromPlan: false };
}

async function funnelByCampaign(sinceIso: string): Promise<Map<string, FunnelRow>> {
  const { data, error } = await supabaseAdmin.rpc("admin_campaign_funnel", { p_since: sinceIso });
  if (error) throw new Error(`campaign funnel RPC failed: ${error.message}`);
  const map = new Map<string, FunnelRow>();
  for (const r of (data ?? []) as FunnelRow[]) {
    if (r.campaign) map.set(r.campaign, r);
  }
  return map;
}

function monthPace(): { elapsedRatio: number; label: string } {
  // בשעון ישראל - חשבון הפרסום מדווח בו.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = parts.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { elapsedRatio: d / daysInMonth, label: `${d}/${daysInMonth}` };
}

export async function runAdsMonitor(): Promise<AdsMonitorResult> {
  const runId = await startAgentRun("ads", "monitor");
  const base: AdsMonitorResult = {
    ok: true,
    configured: googleAdsConfigured(),
    findings: [],
    campaigns: [],
    spendMtd: 0,
    budgetPace: null,
  };

  try {
    if (!base.configured) {
      await finishAgentRun(runId, { status: "empty", summary: "Google Ads לא מוגדר בסביבה - אין מה לנטר" });
      return base;
    }

    const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
    const [week, month, funnel, cplTarget] = await Promise.all([
      fetchGoogleAdsCampaigns(LOOKBACK_DAYS),
      fetchGoogleAdsCampaigns(31),
      funnelByCampaign(sinceIso),
      maxCplTarget(),
    ]);

    const findings: AdsFinding[] = [];
    const contactsOf = (c: AdsCampaign): number =>
      c.utmCampaign ? Number(funnel.get(c.utmCampaign)?.contacting_people ?? 0) : 0;

    base.campaigns = week.campaigns.map((c) => {
      const contacts = contactsOf(c);
      return {
        name: c.name,
        utm: c.utmCampaign,
        cost: c.cost,
        clicks: c.clicks,
        contacts,
        cpl: contacts > 0 ? Math.round((c.cost / contacts) * 10) / 10 : null,
      };
    });

    for (const c of week.campaigns) {
      if (c.cost <= 0) continue;

      // 1. קמפיין שאי אפשר למדוד: הוצאה בלי utm שמחבר אותה למשפך הפנימי.
      //    זה בדיוק מה שקרה ב-g-kids-center שרץ בלי Final URL suffix.
      if (!c.utmCampaign) {
        findings.push({
          key: `ads:untracked:${c.id}`,
          severity: "high",
          title: `קמפיין "${c.name}" מוציא כסף ואי אפשר למדוד אותו`,
          detail:
            `הוצאה של ${ils(c.cost)} ב-${LOOKBACK_DAYS} הימים האחרונים, אבל לקמפיין אין utm_campaign ` +
            `ב-Final URL suffix - ולכן אי אפשר לחבר את ההוצאה ללחיצות פנייה באתר. ` +
            `לתקן: להוסיף לקמפיין בגוגל Final URL suffix בצורה utm_source=google&utm_medium=cpc&utm_campaign=<שם>.`,
        });
        continue; // בלי utm אין טעם בבדיקות ההמרה שלמטה
      }

      const contacts = contactsOf(c);

      // 2. הוצאה בלי אף לחיצת פנייה.
      if (contacts === 0 && c.cost >= MIN_SPEND_FOR_ZERO_ALERT) {
        findings.push({
          key: `ads:zero:${c.id}`,
          severity: "high",
          title: `קמפיין "${c.name}" הוציא ${ils(c.cost)} בלי אף לחיצת פנייה`,
          detail:
            `${LOOKBACK_DAYS} ימים אחרונים: ${ils(c.cost)}, ${c.clicks} קליקים מחויבים, ` +
            `${Number(funnel.get(c.utmCampaign)?.sessions ?? 0)} כניסות לאתר - ואפס אנשים שלחצו ליצירת קשר. ` +
            `לשקול: השהיית הקמפיין, בדיקת התאמת מילות המפתח לדף הנחיתה, או הוספת מילות שלילה.`,
        });
        continue;
      }

      // 3. עלות ללחיצת פנייה מעל היעד העסקי.
      if (contacts > 0) {
        const cpl = c.cost / contacts;
        if (cpl > cplTarget.value) {
          findings.push({
            key: `ads:cpl:${c.id}`,
            severity: "normal",
            title: `עלות ללחיצת פנייה ב-"${c.name}" היא ${ils(cpl)} - מעל היעד`,
            detail:
              `${LOOKBACK_DAYS} ימים אחרונים: ${ils(c.cost)} ל-${contacts} אנשים שלחצו ליצירת קשר. ` +
              `היעד ${cplTarget.fromPlan ? "מהתוכנית העסקית" : "ברירת המחדל"}: ${ils(cplTarget.value)}. ` +
              `לשקול: צמצום תקציב, חידוד קהל, או הפניה לדף נחיתה ממוקד יותר.`,
          });
        }
      }
    }

    // 4. קצב תקציב חודשי.
    const pace = monthPace();
    const spendMtd = month.byDay
      .filter((d) => d.date.slice(0, 7) === new Date().toISOString().slice(0, 7))
      .reduce((s, d) => s + d.cost, 0);
    const expected = MONTHLY_BUDGET * pace.elapsedRatio;
    base.spendMtd = Math.round(spendMtd);
    base.budgetPace = { expected: Math.round(expected), actual: Math.round(spendMtd) };
    if (expected > 0 && spendMtd > expected * PACE_TOLERANCE) {
      const projected = pace.elapsedRatio > 0 ? spendMtd / pace.elapsedRatio : spendMtd;
      findings.push({
        key: `ads:pace:${new Date().toISOString().slice(0, 7)}`,
        severity: "normal",
        title: `קצב ההוצאה החודשי חורג מהתקציב`,
        detail:
          `עד היום (${pace.label} מהחודש) הוצאו ${ils(spendMtd)}, מול ${ils(expected)} לפי הקצב המתוכנן ` +
          `(${ils(MONTHLY_BUDGET)} לחודש). בקצב הזה החודש ייסגר על כ-${ils(projected)}.`,
      });
    }

    base.findings = findings;

    // התראות לתור עם החלמה אוטומטית: ממצא שנפתר (הקמפיין הושהה, ה-utm
    // נוסף, העלות ירדה) סוגר את עצמו. managedKeys מכיל את כל מה שנבדק
    // בריצה הזו, כדי שלא ייסגרו התראות של קמפיינים שלא נבדקו כלל.
    const managedKeys = [
      ...week.campaigns.flatMap((c) => [`ads:untracked:${c.id}`, `ads:zero:${c.id}`, `ads:cpl:${c.id}`]),
      `ads:pace:${new Date().toISOString().slice(0, 7)}`,
    ];
    const { recovered } = await syncAgentAlerts(
      "ads",
      findings.map((f) => ({
        actionType: "alert",
        title: f.title,
        body: f.detail,
        dedupeKey: f.key,
        payload: { severity: f.severity },
      })),
      { managedKeys, recoveryNote: "הממצא כבר לא מתקיים - נסגר אוטומטית" }
    );

    await finishAgentRun(runId, {
      status: findings.length > 0 ? "ok" : "empty",
      summary:
        findings.length > 0
          ? `${findings.length} ממצאי פרסום: ${findings.map((f) => f.title).join(" · ")}`
          : `אין ממצאים · הוצאה החודש ${ils(spendMtd)} מתוך ${ils(MONTHLY_BUDGET)}`,
      details: {
        findings: findings.map((f) => ({ key: f.key, severity: f.severity, title: f.title })),
        campaigns: base.campaigns,
        spend_mtd: base.spendMtd,
        budget_pace: base.budgetPace,
        recovered_alerts: recovered,
        cpl_target: cplTarget,
      },
    });

    return base;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishAgentRun(runId, { status: "error", error: msg });
    return { ...base, ok: false, error: msg };
  }
}
