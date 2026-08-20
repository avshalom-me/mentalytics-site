import { supabaseAdmin } from "./supabaseAdmin";
import { startAgentRun, finishAgentRun, syncAgentAlerts, agentEnabled } from "./agent-infra";
import { fetchAllRows } from "./fetch-all-rows";

// סוכן שימור המטפלים: מזהה לקוח משלם שנמצא במסלול לביטול - לפני שהוא מבטל.
//
// ההיגיון העסקי: ביטול כמעט אף פעם לא מגיע בהפתעה. מטפל שמשלם ולא מקבל
// אף לחיצה ליצירת קשר, או מטפל בחלון המתנה שמתקרב ליום החיוב בלי שום
// תוצאה - יבטל ברגע ההחלטה הבא שלו. הסוכן מציף את אלה בזמן שעוד אפשר
// לעשות משהו: לשפר את הפרופיל, לבדוק את הביקוש בחיתוך, או להאריך מתנה.
//
// שום מייל לא נשלח למטפל, בשום מצב. ההחלטה של המשתמש (17/8/26): מיילי
// ביצועים למטפלים רק מזיקים - מזכירים לחלשים לבטל. הממצאים כאן פנימיים
// בלבד, מוצגים בעמוד המטפלים באדמין, וכל פעולה נעשית בידיים.
//
// מטפל שהוקפא מההתאמות במכוון (match_paused_until עתידי) מדולג: אפס
// לחיצות אצלו הוא תוצאה של החלטה, לא סימן סיכון.

export type RetentionFinding = {
  key: string;
  severity: "high" | "medium";
  title: string;
  detail: string;
};

export type RetentionRun = {
  ok: boolean;
  findings: RetentionFinding[];
  checked: number;
  error?: string;
};

// כמה ימי ותק לפני שמתריעים. מטפל שהצטרף אתמול עם אפס לחיצות הוא רעש.
const MIN_TENURE_DAYS = 14;
// צניחה: פחות משליש מהלחיצות של התקופה הקודמת, ורק אם היה ממה לצנוח.
const DROP_RATIO = 1 / 3;
const DROP_MIN_PREVIOUS = 5;

type TRow = {
  id: string;
  full_name: string | null;
  status: string | null;
  promotion_source: string | null;
  promoted_since: string | null;
  match_paused_until: string | null;
};

function nameOf(t: TRow): string {
  return t.full_name?.trim() || "מטפל/ת ללא שם";
}

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isNaN(ms) ? null : Math.floor(ms / 86_400_000);
}

export async function runRetention(): Promise<RetentionRun> {
  const empty: RetentionRun = { ok: true, findings: [], checked: 0 };
  if (!agentEnabled("retention")) return empty;

  const runId = await startAgentRun("retention", "monitor");
  try {
    const since60 = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const now = Date.now();
    const stamp = new Date().toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });

    const [therapists, subs, views, clicks] = await Promise.all([
      fetchAllRows<TRow>(() =>
        supabaseAdmin
          .from("therapists")
          .select("id, full_name, status, promotion_source, promoted_since, match_paused_until")
          .eq("status", "paying")
          .order("id")
      ),
      fetchAllRows<{ therapist_id: string; first_charge_on: string | null }>(() =>
        supabaseAdmin
          .from("subscriptions")
          .select("therapist_id, first_charge_on")
          .eq("status", "active")
          .order("id")
      ),
      // צפיות ולחיצות ל-60 יום, בשני דליים של 30: האחרון מול הקודם.
      fetchAllRows<{ therapist_id: string; viewed_at: string }>(() =>
        supabaseAdmin
          .from("therapist_profile_views")
          .select("therapist_id, viewed_at")
          .gte("viewed_at", since60)
          .order("viewed_at")
      ),
      fetchAllRows<{ therapist_id: string; clicked_at: string }>(() =>
        supabaseAdmin
          .from("therapist_contact_clicks")
          .select("therapist_id, clicked_at")
          .gte("clicked_at", since60)
          .order("clicked_at")
      ),
    ]);

    const firstChargeByTherapist = new Map<string, string | null>();
    for (const s of subs) firstChargeByTherapist.set(s.therapist_id, s.first_charge_on);

    type Buckets = { cur: number; prev: number };
    const bucket = (rows: { therapist_id: string; at: string }[]): Map<string, Buckets> => {
      const m = new Map<string, Buckets>();
      const cutoff = now - 30 * 86_400_000;
      for (const r of rows) {
        const b = m.get(r.therapist_id) ?? { cur: 0, prev: 0 };
        if (new Date(r.at).getTime() >= cutoff) b.cur++;
        else b.prev++;
        m.set(r.therapist_id, b);
      }
      return m;
    };
    const viewsBy = bucket(views.map((v) => ({ therapist_id: v.therapist_id, at: v.viewed_at })));
    const clicksBy = bucket(clicks.map((c) => ({ therapist_id: c.therapist_id, at: c.clicked_at })));

    const findings: RetentionFinding[] = [];

    for (const t of therapists) {
      // הקפאה מכוונת מההתאמות - לא סיכון אלא החלטה.
      if (t.match_paused_until && new Date(t.match_paused_until).getTime() > now) continue;

      const tenure = daysAgo(t.promoted_since);
      if (tenure == null || tenure < MIN_TENURE_DAYS) continue;

      const v = viewsBy.get(t.id) ?? { cur: 0, prev: 0 };
      const c = clicksBy.get(t.id) ?? { cur: 0, prev: 0 };
      const firstCharge = firstChargeByTherapist.get(t.id) ?? null;
      const inGiftWindow =
        t.promotion_source === "gift_trial" && firstCharge != null && new Date(firstCharge).getTime() > now;

      // 1. חלון המתנה בלי אף לחיצה: נקודת הביטול הידועה מראש. ביום החיוב
      //    המטפל שואל "מה קיבלתי" - ואם התשובה אפס, ההחלטה שלו ידועה.
      if (inGiftWindow && c.cur + c.prev === 0) {
        findings.push({
          key: `retention:gift_risk:${t.id}`,
          severity: "high",
          title: `${nameOf(t)} בחלון המתנה בלי אף לחיצה ליצירת קשר`,
          detail:
            `החיוב הראשון ב-${String(firstCharge).slice(0, 10)}. עד כה ${v.cur + v.prev} צפיות פרופיל ` +
            `ואפס לחיצות (נכון ל-${stamp}). מי שמגיע ליום החיוב בלי תוצאות - מבטל. ` +
            `כדאי לבדוק את הפרופיל ואת הביקוש בחיתוך, או להאריך את חלון המתנה.`,
        });
        continue; // בדיקה 2 הייתה מכפילה את אותו ממצא
      }

      // 2. משלם בלי אף לחיצה ב-30 יום. ההבחנה בגוף: יש חשיפה בלי המרה
      //    (בעיית פרופיל) מול אין חשיפה בכלל (בעיית ביקוש בחיתוך).
      if (c.cur === 0) {
        const exposed = v.cur >= 20;
        findings.push({
          key: `retention:zero30:${t.id}`,
          severity: exposed ? "high" : "medium",
          title: `${nameOf(t)} משלם/ת ובלי אף לחיצה ליצירת קשר ב-30 יום`,
          detail:
            `${v.cur} צפיות פרופיל ב-30 הימים האחרונים, אפס לחיצות (נכון ל-${stamp}). ` +
            (exposed
              ? "יש חשיפה ואין המרה - כנראה משהו בפרופיל עצמו (תמונה, ביו, מחיר)."
              : "גם החשיפה נמוכה - כנראה הביקוש בחיתוך שלו/ה דל. שווה הצלבה מול עמוד היצע/ביקוש."),
        });
        continue;
      }

      // 3. צניחה חדה מול התקופה הקודמת - מוקדם יותר מאפס מוחלט.
      if (c.prev >= DROP_MIN_PREVIOUS && c.cur <= c.prev * DROP_RATIO) {
        findings.push({
          key: `retention:drop:${t.id}`,
          severity: "medium",
          title: `הלחיצות אצל ${nameOf(t)} צנחו`,
          detail:
            `${c.prev} לחיצות ליצירת קשר ב-30 הימים הקודמים, ${c.cur} ב-30 האחרונים ` +
            `(נכון ל-${stamp}). שווה לבדוק אם משהו השתנה: פרופיל, תחרות בחיתוך, או עונתיות.`,
        });
      }
    }

    // כל המפתחות שנבדקו - כדי שממצא ייסגר מעצמו כשהמצב משתפר.
    const managedKeys = therapists.flatMap((t) => [
      `retention:gift_risk:${t.id}`,
      `retention:zero30:${t.id}`,
      `retention:drop:${t.id}`,
    ]);

    const { recovered } = await syncAgentAlerts(
      "retention",
      findings.map((f) => ({
        actionType: "alert",
        kind: "finding" as const,
        title: f.title,
        body: f.detail,
        dedupeKey: f.key,
        payload: { severity: f.severity },
      })),
      { managedKeys, recoveryNote: "המצב השתפר - הממצא נסגר אוטומטית" }
    );

    await finishAgentRun(runId, {
      status: findings.length > 0 ? "ok" : "empty",
      summary:
        findings.length > 0
          ? `${findings.length} מטפלים בסיכון שימור: ${findings
              .slice(0, 2)
              .map((f) => f.title)
              .join(" · ")}${findings.length > 2 ? " ..." : ""}`
          : `כל ${therapists.length} המשלמים עם פעילות תקינה`,
      details: {
        findings: findings.map((f) => ({ key: f.key, severity: f.severity, title: f.title })),
        checked: therapists.length,
        recovered_alerts: recovered,
      },
    });

    return { ok: true, findings, checked: therapists.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishAgentRun(runId, { status: "error", error: msg });
    return { ...empty, ok: false, error: msg };
  }
}
