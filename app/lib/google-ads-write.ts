import "server-only";
import { googleAdsConfigured, googleAdsCustomerId, googleAdsPost } from "./google-ads";
import { supabaseAdmin } from "./supabaseAdmin";
import { israelToday, loadBudgetReport } from "./budget-data";
import { daysInMonth } from "./budget-agent";
import { MAX_DAILY_ILS, MIN_DAILY_ILS, SHARED_NEGATIVE_LIST, type CampaignSpec } from "./ads-campaign-spec";

// כתיבה לגוגל אדס (החלטת הבעלים 11/10/26, סעיף ו.2 בתוכנית סוכן השימור):
// שינוי תקציב יומי, הפעלה/השהיה, והקמת קמפיין חיפוש **מושהה** מתוך מפרט.
// שלושה כללים:
//   1. כל קריאה כאן היא תוצאה של לחיצה מפורשת של אדמין (עם אישור בדפדפן).
//      אין קרון ואין סוכן שקורא לזה לבד.
//   2. תקציב לא עובר את התקרה החודשית של סוכן התקציב (plan_targets
//      ads_budget_month, פחות חשבוניות הפלטפורמות האחרות) בלי override מפורש.
//   3. כל שינוי נרשם בתור הסוכנים (agent 'ads', בוצע) עם לפני/אחרי, ומעודכן
//      מיד ב-ads_campaign_config וב-ads_campaign_registry, כדי שהעמודים לא
//      יחכו לסנכרון הלילי.
// מתג כיבוי: GOOGLE_ADS_WRITE_ENABLED=0.

export function adsWriteEnabled(): boolean {
  return googleAdsConfigured() && process.env.GOOGLE_ADS_WRITE_ENABLED !== "0";
}

export type LiveCampaign = {
  id: string;
  resourceName: string;
  name: string;
  status: string;
  channel: string;
  finalUrlSuffix: string | null;
  budgetResource: string | null;
  dailyBudgetIls: number | null;
  budgetShared: boolean;
};

type GaqlCampaignRow = {
  campaign?: { resourceName?: string; id?: string | number; name?: string; status?: string; advertisingChannelType?: string; finalUrlSuffix?: string | null };
  campaignBudget?: { resourceName?: string; amountMicros?: string | number; explicitlyShared?: boolean };
};

const ILS = (micros: string | number | undefined | null): number | null => (micros == null ? null : Math.round((Number(micros) / 1_000_000) * 100) / 100);
const micros = (ils: number): string => String(Math.round(ils * 1_000_000));

async function gaql<T>(query: string): Promise<T[]> {
  const { status, text } = await googleAdsPost("/googleAds:search", { query });
  if (status !== 200) throw new Error(`Google Ads search failed (${status}): ${readableError(text)}`);
  return (JSON.parse(text)?.results ?? []) as T[];
}

/** הודעת השגיאה של גוגל, קריאה: קוד + message של כל פריט ב-GoogleAdsFailure. */
export function readableError(text: string): string {
  try {
    const j = JSON.parse(text) as { error?: { message?: string; details?: { errors?: { errorCode?: Record<string, string>; message?: string; trigger?: { stringValue?: string } }[] }[] } };
    const items = (j.error?.details ?? []).flatMap((d) => d.errors ?? []);
    if (items.length > 0) {
      return items
        .map((e) => `${Object.values(e.errorCode ?? {}).join("/")}: ${e.message ?? ""}${e.trigger?.stringValue ? ` (${e.trigger.stringValue})` : ""}`)
        .join("; ")
        .slice(0, 600);
    }
    return (j.error?.message ?? text).slice(0, 400);
  } catch {
    return text.slice(0, 400);
  }
}

function toLive(r: GaqlCampaignRow): LiveCampaign | null {
  const id = r.campaign?.id != null ? String(r.campaign.id) : "";
  if (!id) return null;
  return {
    id,
    resourceName: r.campaign?.resourceName ?? `customers/${googleAdsCustomerId()}/campaigns/${id}`,
    name: r.campaign?.name ?? id,
    status: r.campaign?.status ?? "",
    channel: r.campaign?.advertisingChannelType ?? "",
    finalUrlSuffix: r.campaign?.finalUrlSuffix ?? null,
    budgetResource: r.campaignBudget?.resourceName ?? null,
    dailyBudgetIls: ILS(r.campaignBudget?.amountMicros),
    budgetShared: Boolean(r.campaignBudget?.explicitlyShared),
  };
}

const CAMPAIGN_FIELDS =
  "campaign.resource_name, campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.final_url_suffix, " +
  "campaign_budget.resource_name, campaign_budget.amount_micros, campaign_budget.explicitly_shared";

/** כל הקמפיינים שלא הוסרו, עם התקציב היומי שלהם - ישירות מגוגל. */
export async function listLiveCampaigns(): Promise<LiveCampaign[]> {
  const rows = await gaql<GaqlCampaignRow>(`SELECT ${CAMPAIGN_FIELDS} FROM campaign WHERE campaign.status != 'REMOVED'`);
  return rows.map(toLive).filter((c): c is LiveCampaign => c !== null);
}

export async function findLiveCampaign(campaignId: string): Promise<LiveCampaign | null> {
  const id = campaignId.replace(/\D/g, "");
  if (!id) return null;
  const rows = await gaql<GaqlCampaignRow>(`SELECT ${CAMPAIGN_FIELDS} FROM campaign WHERE campaign.id = ${id}`);
  return rows.map(toLive).find((c): c is LiveCampaign => c !== null) ?? null;
}

/** שם פנוי לקמפיין חדש: הבסיס, ואם תפוס - עם ספרה (g-south, g-south1, g-south2...). */
export async function freeCampaignName(base: string): Promise<string> {
  const taken = new Set((await listLiveCampaigns()).map((c) => c.name));
  if (!taken.has(base)) return base;
  for (let i = 1; i < 50; i++) if (!taken.has(`${base}${i}`)) return `${base}${i}`;
  throw new Error(`לא נמצא שם פנוי לקמפיין ${base}`);
}

export type CeilingCheck = { ok: boolean; ceiling: number | null; projectedMonthly: number; dailyTotal: number; month: string };

/**
 * התקרה: סכום התקציבים היומיים של הקמפיינים הפעילים (מהסנכרון, עם השינוי
 * המבוקש) כפול ימי החודש, מול מה שהתקרה משאירה לגוגל אחרי הפלטפורמות האחרות.
 */
export async function checkCeiling(change: { campaignId: string; dailyIls: number; enabled: boolean }): Promise<CeilingCheck> {
  const month = israelToday().slice(0, 7);
  const [report, cfg] = await Promise.all([
    loadBudgetReport({ month }),
    supabaseAdmin.from("ads_campaign_config").select("campaign_id, status, daily_budget"),
  ]);
  if (cfg.error) throw new Error(`ads_campaign_config: ${cfg.error.message}`);
  let dailyTotal = 0;
  for (const c of cfg.data ?? []) {
    if (String(c.campaign_id) === change.campaignId) continue;
    if (c.status === "ENABLED") dailyTotal += Number(c.daily_budget) || 0;
  }
  if (change.enabled) dailyTotal += change.dailyIls;
  dailyTotal = Math.round(dailyTotal * 100) / 100;
  const ceiling = report.projection.googleCeiling ?? report.ceiling?.value ?? null;
  const projectedMonthly = Math.round(dailyTotal * daysInMonth(month));
  return { ok: ceiling == null || projectedMonthly <= ceiling, ceiling, projectedMonthly, dailyTotal, month };
}

async function logAdsWrite(kind: string, title: string, payload: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from("agent_actions").insert({
    agent: "ads",
    action_type: `ads_${kind}`,
    kind: "action",
    severity: "normal",
    title,
    body: null,
    entity_type: "campaign",
    entity_id: null,
    entity_label: String(payload.name ?? ""),
    payload,
    dedupe_key: null,
    status: "executed",
    status_changed_at: new Date().toISOString(),
    resolved_by: "admin",
    resolution_note: title,
  });
  if (error) console.error("ads write log failed:", error.message);
}

export type BudgetResult =
  | { ok: true; name: string; campaignId: string; from: number | null; to: number; ceiling: CeilingCheck }
  | { ok: false; error: string; overCeiling?: CeilingCheck };

/** שינוי התקציב היומי של קמפיין קיים. */
export async function setCampaignDailyBudget(opts: { campaignId: string; amountIls: number; reason: string; override?: boolean }): Promise<BudgetResult> {
  if (!adsWriteEnabled()) return { ok: false, error: "הכתיבה לגוגל אדס לא מוגדרת או כבויה בסביבה הזו" };
  const amount = Math.round(opts.amountIls);
  if (!Number.isFinite(amount) || amount < MIN_DAILY_ILS || amount > MAX_DAILY_ILS) return { ok: false, error: `תקציב יומי בין ₪${MIN_DAILY_ILS} ל-₪${MAX_DAILY_ILS}` };
  const c = await findLiveCampaign(opts.campaignId);
  if (!c) return { ok: false, error: "הקמפיין לא נמצא בגוגל" };
  if (!c.budgetResource) return { ok: false, error: "לקמפיין אין תקציב משלו" };
  if (c.budgetShared) return { ok: false, error: `התקציב של ${c.name} משותף לכמה קמפיינים - לשנות בגוגל עצמו` };
  if (c.dailyBudgetIls === amount) return { ok: false, error: `התקציב של ${c.name} כבר ₪${amount} ליום` };

  const ceiling = await checkCeiling({ campaignId: c.id, dailyIls: amount, enabled: c.status === "ENABLED" });
  if (!ceiling.ok && !opts.override) {
    return { ok: false, error: `₪${amount} ליום מביא את החודש ל-₪${ceiling.projectedMonthly}, מעל התקרה (₪${ceiling.ceiling}).`, overCeiling: ceiling };
  }

  const { status, text } = await googleAdsPost("/campaignBudgets:mutate", {
    operations: [{ updateMask: "amount_micros", update: { resourceName: c.budgetResource, amountMicros: micros(amount) } }],
  });
  if (status !== 200) return { ok: false, error: `גוגל סירב (${status}): ${readableError(text)}` };

  await Promise.all([
    supabaseAdmin.from("ads_campaign_config").update({ daily_budget: amount }).eq("campaign_id", Number(c.id)),
    supabaseAdmin.from("ads_campaign_registry").update({ budget_amount: amount, updated_at: new Date().toISOString() }).eq("google_name", c.name).eq("budget_type", "daily"),
    logAdsWrite("budget", `${c.name}: תקציב יומי ₪${c.dailyBudgetIls ?? "?"} → ₪${amount}`, { name: c.name, campaign_id: c.id, from: c.dailyBudgetIls, to: amount, reason: opts.reason, override: Boolean(opts.override && !ceiling.ok), ceiling }),
  ]);
  return { ok: true, name: c.name, campaignId: c.id, from: c.dailyBudgetIls, to: amount, ceiling };
}

export type StatusResult = { ok: true; name: string; campaignId: string; status: "ENABLED" | "PAUSED"; ceiling: CeilingCheck | null } | { ok: false; error: string; overCeiling?: CeilingCheck };

/** הפעלה או השהיה של קמפיין. הפעלה נבדקת מול התקרה כמו העלאת תקציב. */
export async function setCampaignStatus(opts: { campaignId: string; status: "ENABLED" | "PAUSED"; reason: string; override?: boolean }): Promise<StatusResult> {
  if (!adsWriteEnabled()) return { ok: false, error: "הכתיבה לגוגל אדס לא מוגדרת או כבויה בסביבה הזו" };
  const c = await findLiveCampaign(opts.campaignId);
  if (!c) return { ok: false, error: "הקמפיין לא נמצא בגוגל" };
  if (c.status === opts.status) return { ok: false, error: `${c.name} כבר ${opts.status === "ENABLED" ? "פעיל" : "מושהה"}` };
  let ceiling: CeilingCheck | null = null;
  if (opts.status === "ENABLED") {
    ceiling = await checkCeiling({ campaignId: c.id, dailyIls: c.dailyBudgetIls ?? 0, enabled: true });
    if (!ceiling.ok && !opts.override) {
      return { ok: false, error: `הפעלת ${c.name} (₪${c.dailyBudgetIls ?? "?"} ליום) מביאה את החודש ל-₪${ceiling.projectedMonthly}, מעל התקרה (₪${ceiling.ceiling}).`, overCeiling: ceiling };
    }
  }
  const { status, text } = await googleAdsPost("/campaigns:mutate", {
    operations: [{ updateMask: "status", update: { resourceName: c.resourceName, status: opts.status } }],
  });
  if (status !== 200) return { ok: false, error: `גוגל סירב (${status}): ${readableError(text)}` };
  await Promise.all([
    supabaseAdmin.from("ads_campaign_config").update({ status: opts.status }).eq("campaign_id", Number(c.id)),
    supabaseAdmin.from("ads_campaign_registry").update({ active: opts.status === "ENABLED", updated_at: new Date().toISOString() }).eq("google_name", c.name),
    logAdsWrite("status", `${c.name}: ${opts.status === "ENABLED" ? "הופעל" : "הושהה"}`, { name: c.name, campaign_id: c.id, from: c.status, to: opts.status, daily: c.dailyBudgetIls, reason: opts.reason, override: Boolean(opts.override && ceiling && !ceiling.ok), ceiling }),
  ]);
  return { ok: true, name: c.name, campaignId: c.id, status: opts.status, ceiling };
}

async function findSharedNegativeList(): Promise<string | null> {
  const rows = await gaql<{ sharedSet?: { resourceName?: string; name?: string } }>(
    "SELECT shared_set.resource_name, shared_set.name FROM shared_set WHERE shared_set.type = 'NEGATIVE_KEYWORDS' AND shared_set.status = 'ENABLED'",
  );
  return rows.find((r) => r.sharedSet?.name === SHARED_NEGATIVE_LIST)?.sharedSet?.resourceName ?? null;
}

export type CreateResult = { ok: true; campaignId: string; name: string; sharedNegatives: boolean } | { ok: false; error: string };

/**
 * קמפיין חיפוש חדש, מושהה, בקריאת mutate אחת (תקציב, קמפיין, מיקום ישראל,
 * שליליות, קבוצת מודעות, מילים, מודעה). ההפעלה היא לחיצה שנייה
 * (setCampaignStatus), אחרי שהאדמין ראה אותו בגוגל.
 */
export async function createPausedCampaign(spec: CampaignSpec, reason: string): Promise<CreateResult> {
  if (!adsWriteEnabled()) return { ok: false, error: "הכתיבה לגוגל אדס לא מוגדרת או כבויה בסביבה הזו" };
  if (spec.headlinesPinned1.length + 1 + spec.headlines.length < 3 || spec.descriptions.length < 2) return { ok: false, error: "המפרט קצר מדי למודעה" };
  const cid = googleAdsCustomerId();
  const budgetRn = `customers/${cid}/campaignBudgets/-1`;
  const campaignRn = `customers/${cid}/campaigns/-2`;
  const adGroupRn = `customers/${cid}/adGroups/-3`;
  const sharedSet = await findSharedNegativeList();

  const mutateOperations: unknown[] = [
    { campaignBudgetOperation: { create: { resourceName: budgetRn, name: `${spec.name} budget`, amountMicros: micros(spec.dailyBudgetIls), deliveryMethod: "STANDARD", explicitlyShared: false } } },
    {
      campaignOperation: {
        create: {
          resourceName: campaignRn,
          name: spec.name,
          status: "PAUSED",
          advertisingChannelType: "SEARCH",
          campaignBudget: budgetRn,
          targetSpend: { cpcBidCeilingMicros: micros(spec.cpcCapIls) },
          networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false, targetPartnerSearchNetwork: false },
          geoTargetTypeSetting: { positiveGeoTargetType: "PRESENCE", negativeGeoTargetType: "PRESENCE" },
          finalUrlSuffix: spec.finalUrlSuffix,
          containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
        },
      },
    },
    // ישראל (geo target constant 2376), נוכחות בלבד; המילים נושאות את העיר.
    { campaignCriterionOperation: { create: { campaign: campaignRn, location: { geoTargetConstant: "geoTargetConstants/2376" } } } },
    ...spec.negatives.map((text) => ({ campaignCriterionOperation: { create: { campaign: campaignRn, negative: true, keyword: { text, matchType: "PHRASE" } } } })),
    ...(sharedSet ? [{ campaignSharedSetOperation: { create: { campaign: campaignRn, sharedSet } } }] : []),
    { adGroupOperation: { create: { resourceName: adGroupRn, name: spec.adGroupName, campaign: campaignRn, status: "ENABLED", type: "SEARCH_STANDARD" } } },
    ...spec.keywords.map((text) => ({ adGroupCriterionOperation: { create: { adGroup: adGroupRn, status: "ENABLED", keyword: { text, matchType: "PHRASE" } } } })),
    {
      adGroupAdOperation: {
        create: {
          adGroup: adGroupRn,
          status: "ENABLED",
          ad: {
            finalUrls: [spec.finalUrl],
            responsiveSearchAd: {
              headlines: [
                ...spec.headlinesPinned1.map((text) => ({ text, pinnedField: "HEADLINE_1" })),
                { text: spec.headlineKeywordInsertion, pinnedField: "HEADLINE_2" },
                ...spec.headlines.map((text) => ({ text })),
              ],
              descriptions: spec.descriptions.map((text, i) => (i === 0 ? { text, pinnedField: "DESCRIPTION_1" } : { text })),
              ...(spec.path1 ? { path1: spec.path1 } : {}),
              ...(spec.path1 && spec.path2 ? { path2: spec.path2 } : {}),
            },
          },
        },
      },
    },
  ];

  const { status, text } = await googleAdsPost("/googleAds:mutate", { mutateOperations, partialFailure: false });
  if (status !== 200) return { ok: false, error: `גוגל סירב (${status}): ${readableError(text)}` };
  const responses = (JSON.parse(text)?.mutateOperationResponses ?? []) as { campaignResult?: { resourceName?: string } }[];
  const campaignResource = responses.find((r) => r.campaignResult?.resourceName)?.campaignResult?.resourceName ?? "";
  const campaignId = campaignResource.split("/").pop() ?? "";
  if (!campaignId) return { ok: false, error: "הקמפיין נוצר אבל גוגל לא החזיר מזהה - לבדוק בחשבון" };

  const now = new Date().toISOString();
  await Promise.all([
    supabaseAdmin.from("ads_campaign_registry").upsert(
      { google_name: spec.name, utm_campaign: spec.utm, budget_type: "daily", budget_amount: spec.dailyBudgetIls, cpc_cap: spec.cpcCapIls, active: false, notes: `נוצר מסקירת השימור (${spec.region}), מושהה`, updated_at: now },
      { onConflict: "google_name" },
    ),
    supabaseAdmin.from("ads_campaign_config").upsert(
      { campaign_id: Number(campaignId), campaign_name: spec.name, status: "PAUSED", end_date: null, daily_budget: spec.dailyBudgetIls, total_budget: null, bidding_strategy: "TARGET_SPEND", cpc_ceiling: spec.cpcCapIls, net_search: true, net_partners: false, net_display: false, synced_at: now },
      { onConflict: "campaign_id" },
    ),
    logAdsWrite("create", `${spec.name}: קמפיין חדש ב${spec.region}, מושהה, ₪${spec.dailyBudgetIls} ליום`, { name: spec.name, campaign_id: campaignId, region: spec.region, utm: spec.utm, daily: spec.dailyBudgetIls, keywords: spec.keywords.length, shared_negatives: Boolean(sharedSet), reason }),
  ]);
  return { ok: true, campaignId, name: spec.name, sharedNegatives: Boolean(sharedSet) };
}

/** הסרת קמפיין (לניקוי אחרי בדיקה בלבד; אין לזה כפתור). */
export async function removeCampaign(campaignId: string): Promise<{ ok: boolean; error?: string }> {
  if (!adsWriteEnabled()) return { ok: false, error: "disabled" };
  const c = await findLiveCampaign(campaignId);
  if (!c) return { ok: false, error: "not found" };
  const { status, text } = await googleAdsPost("/campaigns:mutate", { operations: [{ remove: c.resourceName }] });
  if (status !== 200) return { ok: false, error: readableError(text) };
  await Promise.all([
    supabaseAdmin.from("ads_campaign_config").delete().eq("campaign_id", Number(c.id)),
    supabaseAdmin.from("ads_campaign_registry").delete().eq("google_name", c.name),
    logAdsWrite("remove", `${c.name}: הוסר`, { name: c.name, campaign_id: c.id }),
  ]);
  return { ok: true };
}
