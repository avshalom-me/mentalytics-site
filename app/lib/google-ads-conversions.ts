import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { googleAdsConfigured, googleAdsPost } from "./google-ads";
import { startAgentRun, finishAgentRun } from "./agent-infra";

// העלאת המרות אמת ל-Google Ads: תשלומים שהושלמו ונושאים מזהה קליק של גוגל
// (gclid/gbraid/wbraid, שכבר נשמרים בכל תשלום) מדווחים חזרה לגוגל, כדי
// שהאופטימיזציה תרדוף לקוחות משלמים במקום קליקים.
//
// מה עולה לגוגל - וכלום מעבר: מזהה הקליק (שגוגל עצמה הנפיקה), שם פעולת
// ההמרה, זמן התשלום, הסכום בש"ח, ומזהה השורה למניעת כפילות. אין שמות,
// אין מיילים, אין טלפונים, אין תוכן קליני.
//
// בטיחות: אותו דפוס כמו כל הסוכנים - ברירת המחדל תצוגה מקדימה בלבד;
// העלאה אמיתית רק כשהקרון חמוש ב-send=confirm, ורק אחרי שפעולות ההמרה
// הוקמו בחשבון (כפתור ייעודי באדמין). idempotency דרך העמודה
// payments.conversion_uploaded_at שקיימת בדיוק בשביל זה.

// שמות פעולות ההמרה בחשבון גוגל (ASCII כדי שהשוואת GAQL תישאר פשוטה).
export const CONV_ACTION_QUIZ = "server_quiz_payment";
export const CONV_ACTION_SUBSCRIPTION = "server_therapist_subscription";

// גוגל דוחה המרות על קליקים מחוץ לחלון; 88 יום משאיר מרווח מתחת ל-90.
const MAX_AGE_DAYS = 88;
const MAX_BATCH = 200;

type PaymentRow = {
  id: string;
  payment_type: string;
  amount: number | null;
  created_at: string;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
};

export type PendingConversion = {
  payment_id: string;
  payment_type: string;
  action_name: string;
  value_ils: number;
  paid_at: string;
  click_id_kind: "gclid" | "gbraid" | "wbraid";
};

export type ConversionActionsStatus = {
  quiz: string | null; // resource name אם קיימת
  subscription: string | null;
};

export type ConversionsResult = {
  ok: boolean;
  mode: "preview" | "send";
  configured: boolean;
  actions: ConversionActionsStatus;
  actionsReady: boolean;
  pending: PendingConversion[];
  uploaded: number;
  failed: number;
  error?: string;
};

// "2026-08-15 21:04:10+03:00" בשעון ישראל - הפורמט שגוגל דורשת.
function toAdsDateTime(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
  const tzPart = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    timeZoneName: "longOffset",
  })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value;
  const offset = (tzPart ?? "GMT+02:00").replace("GMT", "") || "+02:00";
  return `${date} ${time}${offset}`;
}

function actionNameFor(paymentType: string): string {
  return paymentType === "quiz" ? CONV_ACTION_QUIZ : CONV_ACTION_SUBSCRIPTION;
}

// שליפה אחת שמשרתת גם את התצוגה המקדימה וגם את ההעלאה: מזהי הקליק נשארים
// בשורות הגולמיות (לא נשלחים לדפדפן), והתקדימות gclid→gbraid→wbraid מחושבת
// פעם אחת (ממצא ביקורת: שתי שליפות + תקדימות כפולה = מרווח לסטייה).
async function fetchPendingRows(): Promise<{ preview: PendingConversion[]; rows: PaymentRow[] }> {
  const sinceIso = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("id, payment_type, amount, created_at, gclid, gbraid, wbraid")
    .eq("status", "completed")
    .is("conversion_uploaded_at", null)
    .in("payment_type", ["quiz", "subscription"])
    .gte("created_at", sinceIso)
    .or("gclid.not.is.null,gbraid.not.is.null,wbraid.not.is.null")
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH);
  if (error) throw new Error(`payments query failed: ${error.message}`);

  const rows = (data ?? []) as PaymentRow[];
  const preview = rows.map((p) => ({
    payment_id: p.id,
    payment_type: p.payment_type,
    action_name: actionNameFor(p.payment_type),
    value_ils: Number(p.amount ?? 0),
    paid_at: p.created_at,
    click_id_kind: (p.gclid ? "gclid" : p.gbraid ? "gbraid" : "wbraid") as PendingConversion["click_id_kind"],
  }));
  return { preview, rows };
}

type GaqlConvRow = { conversionAction?: { resourceName?: string; name?: string } };

export async function lookupConversionActions(): Promise<ConversionActionsStatus> {
  const query =
    "SELECT conversion_action.resource_name, conversion_action.name FROM conversion_action " +
    `WHERE conversion_action.name IN ('${CONV_ACTION_QUIZ}', '${CONV_ACTION_SUBSCRIPTION}')`;
  const { status, text } = await googleAdsPost("/googleAds:search", { query });
  if (status !== 200) throw new Error(`conversion_action lookup failed (${status}): ${text.slice(0, 300)}`);
  const rows: GaqlConvRow[] = JSON.parse(text)?.results ?? [];
  const byName = new Map<string, string>();
  for (const r of rows) {
    if (r.conversionAction?.name && r.conversionAction?.resourceName) {
      byName.set(r.conversionAction.name, r.conversionAction.resourceName);
    }
  }
  return {
    quiz: byName.get(CONV_ACTION_QUIZ) ?? null,
    subscription: byName.get(CONV_ACTION_SUBSCRIPTION) ?? null,
  };
}

// הקמה חד-פעמית של שתי פעולות ההמרה בחשבון. נקראת רק מכפתור ייעודי באדמין
// (קליק מפורש = אישור); בטוחה להרצה חוזרת - מדלגת על מה שכבר קיים.
export async function setupConversionActions(): Promise<ConversionActionsStatus> {
  const existing = await lookupConversionActions();
  const ops: unknown[] = [];
  if (!existing.quiz) {
    ops.push({
      create: {
        name: CONV_ACTION_QUIZ,
        type: "UPLOAD_CLICKS",
        category: "PURCHASE",
        status: "ENABLED",
        countingType: "ONE_PER_CLICK",
        clickThroughLookbackWindowDays: 90,
        valueSettings: { alwaysUseDefaultValue: false },
      },
    });
  }
  if (!existing.subscription) {
    ops.push({
      create: {
        name: CONV_ACTION_SUBSCRIPTION,
        type: "UPLOAD_CLICKS",
        category: "SUBSCRIBE_PAID",
        status: "ENABLED",
        countingType: "ONE_PER_CLICK",
        clickThroughLookbackWindowDays: 90,
        valueSettings: { alwaysUseDefaultValue: false },
      },
    });
  }
  if (ops.length > 0) {
    const { status, text } = await googleAdsPost("/conversionActions:mutate", { operations: ops });
    if (status !== 200) throw new Error(`conversionActions mutate failed (${status}): ${text.slice(0, 400)}`);
  }
  return lookupConversionActions();
}

// חילוץ כשלים מתשובת partialFailure של גוגל: אינדקס + קוד שגיאה. שגיאות
// "כבר קיים/כפול" הן הצלחה בפועל (ההמרה כבר אצל גוגל) - נחתום אותן כדי
// שלא יחזרו לתור כל יום לנצח (ממצא ביקורת: לולאת ניסיון אינסופית).
function extractFailures(partialFailureError: unknown): Map<number, string> {
  const failed = new Map<number, string>();
  const details = (partialFailureError as { details?: unknown[] } | null)?.details ?? [];
  for (const d of details) {
    const errors = (d as { errors?: unknown[] }).errors ?? [];
    for (const e of errors) {
      const err = e as {
        errorCode?: Record<string, string>;
        location?: { fieldPathElements?: { fieldName?: string; index?: number }[] };
      };
      const code = Object.values(err.errorCode ?? {}).join(",") || "unknown";
      for (const el of err.location?.fieldPathElements ?? []) {
        if (el.fieldName === "conversions" && typeof el.index === "number") {
          failed.set(el.index, code);
        }
      }
    }
  }
  return failed;
}

function isDuplicateErrorCode(code: string): boolean {
  return code.includes("ALREADY_EXISTS") || code.includes("DUPLICATE");
}

export async function runConversionsSync(opts: { send: boolean }): Promise<ConversionsResult> {
  const mode = opts.send ? "send" : "preview";
  const runId = await startAgentRun("conversions", mode);

  const base: ConversionsResult = {
    ok: true,
    mode,
    configured: googleAdsConfigured(),
    actions: { quiz: null, subscription: null },
    actionsReady: false,
    pending: [],
    uploaded: 0,
    failed: 0,
  };

  try {
    if (!base.configured) {
      await finishAgentRun(runId, { status: "empty", summary: "Google Ads לא מוגדר בסביבה - אין מה להעלות" });
      return base;
    }

    const [{ preview: pending, rows: pendingRows }, actions] = await Promise.all([
      fetchPendingRows(),
      lookupConversionActions(),
    ]);
    base.pending = pending;
    base.actions = actions;
    base.actionsReady = Boolean(actions.quiz && actions.subscription);

    if (pending.length === 0) {
      await finishAgentRun(runId, {
        status: "empty",
        summary: "אין תשלומים חדשים עם מזהה קליק - אין מה להעלות",
        details: { mode, actions_ready: base.actionsReady },
      });
      return base;
    }

    if (!opts.send) {
      await finishAgentRun(runId, {
        status: "ok",
        summary: `תצוגה מקדימה: ${pending.length} המרות ממתינות להעלאה (₪${pending.reduce((s, p) => s + p.value_ils, 0)})`,
        details: { mode, pending: pending.length, actions_ready: base.actionsReady },
      });
      return base;
    }

    if (!base.actionsReady) {
      const msg = "פעולות ההמרה טרם הוקמו בחשבון גוגל - יש להקים מעמוד הסוכנים לפני חימוש";
      await finishAgentRun(runId, { status: "error", error: msg });
      return { ...base, ok: false, error: msg };
    }

    // העלאה בפועל. שולחים רק: מזהה קליק, פעולה, זמן, סכום, מזהה-שורה לדדופ.
    const conversions = pendingRows.map((p) => {
      const resource = p.payment_type === "quiz" ? base.actions.quiz : base.actions.subscription;
      return {
        ...(p.gclid ? { gclid: p.gclid } : p.gbraid ? { gbraid: p.gbraid } : { wbraid: p.wbraid }),
        conversionAction: resource,
        conversionDateTime: toAdsDateTime(p.created_at),
        conversionValue: Number(p.amount ?? 0),
        currencyCode: "ILS",
        orderId: p.id,
      };
    });

    const { status, text } = await googleAdsPost(":uploadClickConversions", {
      conversions,
      partialFailure: true,
    });
    if (status !== 200) throw new Error(`uploadClickConversions failed (${status}): ${text.slice(0, 400)}`);

    const body = JSON.parse(text) as { partialFailureError?: unknown };
    const failures = extractFailures(body.partialFailureError ?? null);
    // "כפול/כבר קיים" = ההמרה כבר רשומה בגוגל - נחשבת שהועלתה ונחתמת,
    // כדי שלא תנסה שוב מחר לנצח. כשלים אחרים נשארים לא חתומים לניסיון חוזר.
    const stampIds = pendingRows
      .filter((_, i) => !failures.has(i) || isDuplicateErrorCode(failures.get(i) ?? ""))
      .map((p) => p.id);
    const realFailures = [...failures.entries()].filter(([, code]) => !isDuplicateErrorCode(code));

    if (stampIds.length > 0) {
      const { error: stampErr } = await supabaseAdmin
        .from("payments")
        .update({ conversion_uploaded_at: new Date().toISOString() })
        .in("id", stampIds);
      if (stampErr) {
        // חתימה שנכשלה = הסכנה של העלאה כפולה מחר; חייבת להיראות כשגיאה.
        throw new Error(`ההעלאה הצליחה אך רישום ההחתמה נכשל: ${stampErr.message}`);
      }
    }

    base.uploaded = stampIds.length;
    base.failed = realFailures.length;
    await finishAgentRun(runId, {
      status: realFailures.length > 0 ? "error" : "ok",
      summary: `הועלו ${base.uploaded} המרות לגוגל${realFailures.length > 0 ? `, ${realFailures.length} נכשלו` : ""}`,
      details: {
        mode,
        uploaded: base.uploaded,
        failed: base.failed,
        failure_codes: realFailures.map(([i, code]) => ({ index: i, code })),
      },
      error:
        realFailures.length > 0
          ? `כשלי העלאה: ${realFailures.map(([i, code]) => `#${i}:${code}`).join(", ")}`
          : undefined,
    });
    return base;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishAgentRun(runId, { status: "error", error: msg });
    return { ...base, ok: false, error: msg };
  }
}
