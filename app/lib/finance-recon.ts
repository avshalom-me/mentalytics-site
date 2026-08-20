import { supabaseAdmin } from "./supabaseAdmin";
import { startAgentRun, finishAgentRun, syncAgentAlerts, agentEnabled } from "./agent-infra";
import { fetchAllRows } from "./fetch-all-rows";
import { computeGuarantee } from "./guarantee";

// סוכן הכספים: משווה בין מי שמקבל שירות בפועל לבין מי שמשלם עליו.
//
// כל ההכנסה של החברה היא שני מקורות - מנוי מטפל ומנוי מרכז - ובשניהם
// הקידום באתר והחיוב בפועל נשמרים בשתי מערכות שונות (אצלנו ואצל Sumit).
// כל פער ביניהם הוא כסף שדולף בשקט: מטפל שמקודם ולא מחויב, מטפל שמחויב
// ולא מקודם, מרכז שפעיל בלי הוראת חיוב, או חידוש שלא נגבה.
//
// הסוכן קורא בלבד. הוא לא מבטל מנוי, לא מחייב, לא שולח מייל ולא נוגע
// ב-Sumit - הוא רק מציף פערים לעמוד הכספים. כל תיקון נעשה בידיים.
//
// שלושה דפוסים הם תקינים ולא מדווחים, כי הם המצב הרגיל של המערכת:
//   1. מטפל בתקופת ניסיון (promotion_source='trial') - מקודם בלי מנוי.
//   2. מטפל משלם (promotion_source='paid') עם מנוי פעיל.
//   3. מטפל של מרכז (promotion_source='center') - המרכז מחויב, לא הוא.

export type FinanceFinding = {
  key: string;
  severity: "high" | "medium";
  title: string;
  detail: string;
};

export type FinanceRun = {
  ok: boolean;
  findings: FinanceFinding[];
  checked: { therapists: number; subscriptions: number; centers: number };
  error?: string;
};

// כמה ימים אחרי סוף תקופת החיוב עדיין לא מדובר בפער. Sumit גובה ביום
// המחזור עצמו, ויום-יומיים של פיגור בסנכרון הם רעש ולא תקלה.
const RENEWAL_GRACE_DAYS = 4;
// מרכז מחויב חודשית. 40 יום = מחזור שלם ועוד מרווח, כלומר חיוב שנפל.
const CENTER_BILLING_MAX_DAYS = 40;

type TherapistRow = {
  id: string;
  full_name: string | null;
  status: string | null;
  manually_promoted: boolean | null;
  promotion_source: string | null;
  promoted_until: string | null;
};

type SubscriptionRow = {
  id: string;
  therapist_id: string;
  status: string | null;
  amount: number | null;
  current_period_end: string | null;
  sync_miss_count: number | null;
  first_charge_on: string | null;
};

type CenterRow = {
  id: string;
  name: string | null;
  status: string | null;
  sumit_recurring_id: string | null;
  agreed_monthly_price: number | null;
  price_per_therapist: number | null;
  fixed_monthly_price: number | null;
  billing_track: string | null;
  billing_starts_at: string | null;
  last_billed_on: string | null;
  sumit_miss_count: number | null;
  gift_months: number | null;
  paid_at: string | null;
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

function name(t: { full_name: string | null }): string {
  return t.full_name?.trim() || "מטפל/ת ללא שם";
}

export async function runFinanceRecon(): Promise<FinanceRun> {
  const empty: FinanceRun = {
    ok: true,
    findings: [],
    checked: { therapists: 0, subscriptions: 0, centers: 0 },
  };
  if (!agentEnabled("finance")) return empty;

  const runId = await startAgentRun("finance", "recon");
  try {
    // fetchAllRows ולא select רגיל: PostgREST מחזיר עד 1000 שורות בשקט.
    // היום יש ~300 מטפלים, אבל ביום שבו יעברו את האלף הסוכן היה בודק רק
    // את הראשונים ומדווח "אין פערים" - כלומר שקט שקרי בדיוק כשיש הכי הרבה
    // כסף על הכף.
    const [therapists, subs, centers] = await Promise.all([
      fetchAllRows<TherapistRow>(() =>
        supabaseAdmin
          .from("therapists")
          .select("id, full_name, status, manually_promoted, promotion_source, promoted_until")
          .order("id")
      ),
      fetchAllRows<SubscriptionRow>(() =>
        supabaseAdmin
          .from("subscriptions")
          .select("id, therapist_id, status, amount, current_period_end, sync_miss_count, first_charge_on")
          .order("id")
      ),
      fetchAllRows<CenterRow>(() =>
        supabaseAdmin
          .from("therapy_center_accounts")
          .select(
            "id, name, status, sumit_recurring_id, agreed_monthly_price, price_per_therapist, fixed_monthly_price, billing_track, billing_starts_at, last_billed_on, sumit_miss_count, gift_months, paid_at"
          )
          .order("id")
      ),
    ]);

    const activeSubByTherapist = new Map<string, SubscriptionRow>();
    for (const s of subs) {
      if (s.status === "active") activeSubByTherapist.set(s.therapist_id, s);
    }

    const findings: FinanceFinding[] = [];

    // --- צד המטפלים ---
    for (const t of therapists) {
      const sub = activeSubByTherapist.get(t.id);
      const src = t.promotion_source ?? null;
      const onPayingTrack = t.status === "paying";

      // 1. במסלול משלם, מקור "paid", ואין מנוי פעיל: מקודם באתר בלי שאף
      //    אחד גובה ממנו. זו הדליפה הישירה ביותר.
      if (onPayingTrack && (src === "paid" || src === "gift_trial") && !sub) {
        findings.push({
          key: `fin:promoted_unbilled:${t.id}`,
          severity: "high",
          title: `${name(t)} מקודם/ת כמשלם/ת בלי מנוי פעיל`,
          detail:
            "המטפל/ת מופיע/ה במסלול המשלם ומקודם/ת באתר, אבל אין מנוי פעיל שגובה ממנו/ה. או שהמנוי בוטל ב-Sumit והקידום לא ירד, או שהחיוב הראשון נכשל.",
        });
      }

      // 2. תקופת ניסיון שפגה והקידום נשאר. השירות ממשיך בלי חיוב.
      const trialOver =
        src === "trial" && t.promoted_until != null && new Date(t.promoted_until).getTime() < Date.now();
      if (t.manually_promoted && trialOver && !sub) {
        const over = daysSince(t.promoted_until);
        findings.push({
          key: `fin:trial_expired:${t.id}`,
          severity: "medium",
          title: `תקופת הניסיון של ${name(t)} הסתיימה והקידום נשאר`,
          detail: `הקידום היה בתוקף עד ${t.promoted_until?.slice(0, 10)}${
            over != null ? ` (לפני ${over} ימים)` : ""
          }, ואין מנוי פעיל. או להסיר את הקידום או להמיר למנוי.`,
        });
      }

      // 3. יש מנוי פעיל אבל המטפל/ת לא במסלול המשלם: משלם/ת ולא מקבל/ת.
      //    החמור מכולם - לקוח שמשלם ולא מופיע.
      if (sub && !onPayingTrack) {
        findings.push({
          key: `fin:paying_not_promoted:${t.id}`,
          severity: "high",
          title: `${name(t)} משלם/ת ולא מופיע/ה במסלול המשלם`,
          detail: `קיים מנוי פעיל (${sub.amount ?? "?"} ₪) אבל הסטטוס הוא "${
            t.status ?? "לא ידוע"
          }". כלומר גובים כסף בלי לתת את השירות.`,
        });
      }
    }

    // 4. מנוי פעיל שתקופתו נגמרה ולא התחדשה ברישום שלנו.
    const therapistById = new Map(therapists.map((t) => [t.id, t]));
    for (const s of subs) {
      if (s.status !== "active") continue;
      const over = daysSince(s.current_period_end);
      if (over != null && over > RENEWAL_GRACE_DAYS) {
        const t = therapistById.get(s.therapist_id);
        findings.push({
          key: `fin:renewal_stale:${s.id}`,
          severity: "high",
          title: `המנוי של ${t ? name(t) : "מטפל/ת לא מזוהה"} לא התחדש`,
          detail: `תקופת החיוב הסתיימה ב-${s.current_period_end?.slice(0, 10)} (לפני ${over} ימים) והמנוי עדיין מסומן פעיל. או שהחידוש נכשל ב-Sumit, או שנגבה ולא נרשם אצלנו.`,
        });
      }

      // 5. סנכרון מול Sumit שנכשל שוב ושוב - הרישום אצלנו מפסיק לשקף מציאות.
      if ((s.sync_miss_count ?? 0) >= 2) {
        const t = therapistById.get(s.therapist_id);
        findings.push({
          key: `fin:sync_miss:${s.id}`,
          severity: "medium",
          title: `סנכרון Sumit נכשל ${s.sync_miss_count} פעמים אצל ${t ? name(t) : "מטפל/ת"}`,
          detail:
            "המנוי לא נמצא בסנכרונים האחרונים מול Sumit. אם הוא באמת בוטל שם, הקידום אצלנו ממשיך בחינם.",
        });
      }
    }

    // --- צד המרכזים ---
    for (const c of centers) {
      if (c.status !== "active") continue;
      const label = c.name?.trim() || "מרכז ללא שם";
      // "עוד לא התחיל להיות מחויב" נקבע לפי תאריך תחילת החיוב ולא לפי
      // paid_at: מרכז בחודשי מתנה כן משלים את הקמת אמצעי התשלום, ולכן
      // paid_at מסומן אצלו למרות שאין עדיין מה לגבות. בדיקה לפי paid_at
      // הייתה שותקת מהסיבה הלא נכונה, ומתחילה לצעוק ברגע שמישהו ישנה
      // את סדר הפעולות.
      const billingStarted =
        c.billing_starts_at == null || new Date(c.billing_starts_at).getTime() <= Date.now();
      const inGift = !billingStarted;

      // 6. מרכז פעיל בלי הוראת חיוב ב-Sumit (ולא בתקופת מתנה).
      if (!c.sumit_recurring_id && !inGift) {
        findings.push({
          key: `fin:center_no_recurring:${c.id}`,
          severity: "high",
          title: `${label} פעיל בלי הוראת חיוב`,
          detail:
            "המרכז פעיל והמטפלים שלו מקודמים, אבל אין מזהה חיוב חוזר ב-Sumit. כלומר אף אחד לא גובה ממנו חודשית.",
        });
      }

      // 7. מרכז שלא חויב יותר ממחזור שלם.
      const sinceBilled = daysSince(c.last_billed_on);
      if (c.sumit_recurring_id && sinceBilled != null && sinceBilled > CENTER_BILLING_MAX_DAYS) {
        findings.push({
          key: `fin:center_billing_stale:${c.id}`,
          severity: "high",
          title: `${label} לא חויב ${sinceBilled} ימים`,
          detail: `החיוב האחרון נרשם ב-${c.last_billed_on?.slice(0, 10)}. מרכז מחויב חודשית, ולכן פער כזה אומר שהחיוב נפל או שלא נרשם.`,
        });
      }

      // 8. מרכז שהתחיל להיות מחויב ומעולם לא נרשם לו חיוב.
      const sinceStart = daysSince(c.billing_starts_at);
      if (!c.last_billed_on && !inGift && sinceStart != null && sinceStart > CENTER_BILLING_MAX_DAYS) {
        findings.push({
          key: `fin:center_never_billed:${c.id}`,
          severity: "high",
          title: `${label} מעולם לא חויב`,
          detail: `החיוב היה אמור להתחיל ב-${c.billing_starts_at?.slice(0, 10)} (לפני ${sinceStart} ימים) ואין אף חיוב רשום.`,
        });
      }

      // 9. סנכרון Sumit שנכשל אצל מרכז.
      if ((c.sumit_miss_count ?? 0) >= 2) {
        findings.push({
          key: `fin:center_sync_miss:${c.id}`,
          severity: "medium",
          title: `סנכרון Sumit נכשל ${c.sumit_miss_count} פעמים ב${label}`,
          detail: "הוראת החיוב לא נמצאה בסנכרונים האחרונים. ייתכן שבוטלה ב-Sumit והמרכז ממשיך לקבל שירות.",
        });
      }

      // 10. מרכז פעיל בלי מחיר: אין ממה לגזור חיוב.
      const price =
        c.billing_track === "fixed"
          ? c.fixed_monthly_price ?? c.agreed_monthly_price
          : c.agreed_monthly_price ?? c.price_per_therapist;
      if (!inGift && (price == null || price <= 0)) {
        findings.push({
          key: `fin:center_no_price:${c.id}`,
          severity: "medium",
          title: `${label} פעיל בלי מחיר מוגדר`,
          detail: "אין מחיר חודשי מוסכם ולא מחיר למטפל, ולכן אי אפשר לדעת מה אמור להיגבות.",
        });
      }
    }

    // 4ב. רשת ביטחון לגלגול המסלול: מטפל בחלון מתנה שהחיוב הראשון שלו
    // כבר יצא אמור להתגלגל ל-paid בסנכרון היומי. אם הוא עדיין gift_trial
    // ימים אחרי התאריך - הגלגול נכשל, והוא סופר כמתנה בזמן שהוא משלם.
    for (const s of subs) {
      if (s.status !== "active") continue;
      const t = therapistById.get(s.therapist_id);
      if (t?.promotion_source !== "gift_trial") continue;
      const sinceCharge = daysSince(s.first_charge_on);
      if (sinceCharge != null && sinceCharge > 3) {
        findings.push({
          key: `fin:gift_rollover_stuck:${s.id}`,
          severity: "high",
          title: `${t ? name(t) : "מטפל/ת"} משלם/ת כבר ${sinceCharge} ימים ועדיין רשום/ה כחלון מתנה`,
          detail: `החיוב הראשון היה ב-${String(s.first_charge_on).slice(0, 10)} והגלגול ל-paid לא קרה. המשמעות: מדורג/ת מתחת למשלמים בהתאמות ולא נספר/ת באף מדד הכנסה.`,
        });
      }
    }

    // --- ערבות ההחזר ---
    // חלון שנסגר בלי אף פנייה הוא התחייבות כספית שלנו, ולכן כל מקרה כזה
    // מדווח בנפרד. השאר מרוכז לשורה אחת: 17 שורות "בסכנה" הן רעש, מספר
    // אחד עם קישור הוא מידע.
    const guarantee = await computeGuarantee();
    const owed = guarantee.filter((g) => g.risk === "expired_no_contact");
    const atRisk = guarantee.filter((g) => g.risk === "at_risk");
    // "קיבל פניות" שנשען על לחיצות בלבד: לחיצת וואטסאפ או טלפון אינה
    // הוכחה שנוצר קשר, ובשיחת החזר היא לא תחזיק. בדיוק הפער שנמצא
    // בביקורת - רוב מי שנחשב מרוצה מעולם לא קיבל הודעה שמורה.
    const clicksOnly = guarantee.filter((g) => g.contacts_in_window > 0 && g.contacts_certain === 0);

    for (const g of owed) {
      findings.push({
        key: `fin:guarantee_owed:${g.therapist_id}`,
        severity: "high",
        title: `ערבות ההחזר של ${g.full_name} לא קוימה`,
        detail: `חלון הערבות נסגר ב-${g.window_end.slice(0, 10)} בלי אף פנייה. זו התחייבות להחזר, ועדיף ליזום מול המטפל/ת לפני שהוא/היא יוזם/ת.`,
      });
    }
    if (atRisk.length > 0) {
      findings.push({
        key: "fin:guarantee_at_risk",
        severity: "medium",
        title: `${atRisk.length} מטפלים מתקרבים לסוף חלון הערבות בלי אף פנייה`,
        detail: `הרשימה המלאה בעמוד תקופת הביטחון. כל אחד מהם הופך להתחייבות להחזר אם החלון ייסגר ריק.`,
      });
    }
    if (clicksOnly.length > 0) {
      findings.push({
        key: "fin:guarantee_clicks_only",
        severity: "medium",
        title: `${clicksOnly.length} מטפלים נחשבים כמי שקיבלו פניות על סמך לחיצות בלבד`,
        detail:
          "אצלם נספרו לחיצות ליצירת קשר אבל אף הודעה דרך האתר. לחיצה אינה הוכחה שנוצר קשר, ולכן הערבות שלהם עלולה להיחשב לא מקוימת בשיחת החזר.",
      });
    }

    // מפתחות שהריצה הזו באמת בדקה - כדי שממצא ייסגר רק כשהמצב נפתר, ולא
    // כשהשורה פשוט לא נטענה.
    const managedKeys = [
      ...therapists.flatMap((t) => [
        `fin:promoted_unbilled:${t.id}`,
        `fin:trial_expired:${t.id}`,
        `fin:paying_not_promoted:${t.id}`,
      ]),
      ...subs.flatMap((s) => [`fin:renewal_stale:${s.id}`, `fin:sync_miss:${s.id}`, `fin:gift_rollover_stuck:${s.id}`]),
      ...centers.flatMap((c) => [
        `fin:center_no_recurring:${c.id}`,
        `fin:center_billing_stale:${c.id}`,
        `fin:center_never_billed:${c.id}`,
        `fin:center_sync_miss:${c.id}`,
        `fin:center_no_price:${c.id}`,
      ]),
      ...guarantee.map((g) => `fin:guarantee_owed:${g.therapist_id}`),
      "fin:guarantee_at_risk",
      "fin:guarantee_clicks_only",
    ];

    const { recovered } = await syncAgentAlerts(
      "finance",
      findings.map((f) => ({
        actionType: "alert",
        // ממצא ולא פעולה: התיקון הוא בידיים שלך ב-Sumit או באדמין, ואין
        // כאן שום דבר לאשר לסוכן.
        kind: "finding" as const,
        title: f.title,
        body: f.detail,
        dedupeKey: f.key,
        payload: { severity: f.severity },
      })),
      { managedKeys, recoveryNote: "הפער נסגר - הממצא נסגר אוטומטית" }
    );

    const checked = {
      therapists: therapists.length,
      subscriptions: subs.length,
      centers: centers.length,
    };

    await finishAgentRun(runId, {
      status: findings.length > 0 ? "ok" : "empty",
      summary:
        findings.length > 0
          ? `${findings.length} פערי גבייה: ${findings
              .slice(0, 3)
              .map((f) => f.title)
              .join(" · ")}${findings.length > 3 ? " ..." : ""}`
          : `אין פערי גבייה · ${checked.subscriptions} מנויים, ${checked.centers} מרכזים`,
      details: {
        findings: findings.map((f) => ({ key: f.key, severity: f.severity, title: f.title })),
        checked,
        recovered_alerts: recovered,
      },
    });

    return { ok: true, findings, checked };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishAgentRun(runId, { status: "error", error: msg });
    return { ...empty, ok: false, error: msg };
  }
}
