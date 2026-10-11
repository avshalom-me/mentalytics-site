import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { fetchAllRows } from "./fetch-all-rows";
import { agentEnabled, finishAgentRun, startAgentRun, syncAgentAlerts, type AgentSeverity, type NewAgentAction } from "./agent-infra";
import { computeGuarantee } from "./guarantee";
import { holidaysBetween } from "./israel-holidays";
import { enrichReviewWithModel } from "./retention-model";
import { computeOutcomes, summarizeOutcomes, type ActionOutcome, type ContactEvent, type ExecutedAction, type TherapistState } from "./retention-outcomes";
import { REGION_CAMPAIGNS } from "./ads-campaign-spec";
import {
  benchmarkFrom,
  buildRetentionReview,
  regionsOf,
  reviewWeekStart,
  sortReviewRows,
  EMPTY_FUNNEL,
  REGION_BENCHMARK_MIN_PEERS,
  type Benchmark,
  type FunnelRow,
  type RegionCampaign,
  type RegionDemand,
  type ReviewContext,
  type ReviewRow,
  type ReviewSummary,
  type TherapistInput,
} from "./retention-review";

// הטעינה והכתיבה של סקירת השימור השבועית. המנוע עצמו ב-retention-review.ts
// (טהור); כאן: שליפת המקודמים, המשפך (RPC), הביקוש (RPC), הערבות, המנויים,
// הצינון, הבנצ'מרקים - ואז שמירת הצילום ב-retention_reviews/_rows וסנכרון
// הפעולות לתור הסוכנים (agent_actions), שממנו הכפתורים עובדים.
//
// הצילום נשמר לשבוע (ראשון בשעון ישראל). ריצה חוזרת באותו שבוע מחליפה את
// השורות ומשאירה את "ראיתי" של האדמין כמו שהוא, כדי שריצה ידנית לא תקפיץ
// שוב את המודאל.

const WINDOW_DAYS = 30;
const PEER_TENURE_DAYS = 30;
/** מייל יזום אחד למטפל/ת ב-21 יום, מכל הסוכנים יחד (החלטת הבעלים 11/10/26). */
export const OUTREACH_COOLDOWN_DAYS = 21;
/** ממצא שנדחה ידנית לא חוזר שבועיים, אלא אם החמיר (כמו בסוכן האדס). */
const SNOOZE_DAYS = 14;
const ACTION_TYPES_IN_QUEUE = ["fix", "freeze", "email", "task"] as const;

type TRow = {
  id: string;
  full_name: string | null;
  status: string | null;
  promotion_source: string | null;
  entity_type: string | null;
  center_account_id: string | null;
  promoted_since: string | null;
  promoted_until: string | null;
  created_at: string;
  admin_approved: boolean | null;
  accepting_new_patients: boolean | null;
  online: boolean | null;
  regions: string[] | null;
  training_areas: string[] | null;
  age_groups: string[] | null;
  bio: string | null;
  profile_photo_path: string | null;
  education: string | null;
  experience: string | null;
  phone: string | null;
  email: string | null;
  match_paused_until: string | null;
  gender: string | null;
  therapist_types: string[] | null;
};

/** הקלט למודל: הקלט של המנוע ועוד מה שרק הניסוח צריך (מין לדקדוק, סוג המטפל/ת לכרטיס). */
export type ModelInput = TherapistInput & { gender: string | null; therapist_types: string[] };

type FunnelRpcRow = { therapist_id: string } & FunnelRow;
type DemandRpcRow = { region: string | null; searches: number; online_searches: number; treatment_sessions: number; treatments: { t: string; n: number }[] | null };

export type RetentionReviewResult = {
  ok: boolean;
  disabled?: boolean;
  reviewId?: string;
  weekStart?: string;
  summary?: ReviewSummary;
  rows?: ReviewRow[];
  error?: string;
};

/** הצינון: המייל היזום האחרון לכל כתובת, מכל הסוכנים (crm_email_log). */
async function lastOutreachByEmail(emails: string[], sinceIso: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (emails.length === 0) return out;
  const { data, error } = await supabaseAdmin
    .from("crm_email_log")
    .select("recipient, template, created_at")
    .in("recipient", emails)
    .gte("created_at", sinceIso)
    .eq("status", "sent")
    .order("created_at", { ascending: false });
  if (error) {
    // בלי הצינון עדיף טיוטה שמסומנת "לשלוח" מדי מאשר ריצה שנופלת; נרשם ללוג.
    console.error("retention: crm_email_log read failed:", error.message);
    return out;
  }
  for (const r of data ?? []) {
    const template = String(r.template ?? "");
    // תבניות תפעוליות (חיוב, סוף ניסיון, ברוך הבא) אינן "פנייה יזומה".
    const outreach = template === "bulk" || /retention|offer|nudge|message|feedback/i.test(template);
    if (!outreach) continue;
    const key = String(r.recipient ?? "").trim().toLowerCase();
    if (key && !out.has(key)) out.set(key, r.created_at as string);
  }
  return out;
}

/**
 * הקמפיין של כל אזור: הרישום (google_name → utm) מצליב את הסנכרון הלילי
 * (ads_campaign_config: סטטוס ותקציב יומי) עם מפת האזורים של ads-campaign-spec.
 * כשיש כמה קמפיינים לאותו utm (ישן וחדש) - הפעיל קודם. כשל כאן לא מפיל את
 * הסקירה: בלי המפה, פעולת הקמפיין היא "להקים" במקום "להעלות".
 */
async function loadRegionCampaigns(): Promise<Record<string, RegionCampaign>> {
  const [cfg, reg] = await Promise.all([
    supabaseAdmin.from("ads_campaign_config").select("campaign_id, campaign_name, status, daily_budget"),
    supabaseAdmin.from("ads_campaign_registry").select("google_name, utm_campaign"),
  ]);
  if (cfg.error || reg.error) {
    console.error("retention: campaigns read failed:", cfg.error?.message ?? reg.error?.message);
    return {};
  }
  const utmByName = new Map<string, string>();
  for (const r of reg.data ?? []) if (r.utm_campaign) utmByName.set(String(r.google_name), String(r.utm_campaign));
  const byUtm = new Map<string, RegionCampaign[]>();
  for (const c of cfg.data ?? []) {
    const utm = utmByName.get(String(c.campaign_name));
    if (!utm) continue;
    const item: RegionCampaign = {
      utm,
      name: String(c.campaign_name),
      campaignId: c.campaign_id != null ? String(c.campaign_id) : null,
      status: c.status === "ENABLED" ? "ENABLED" : "PAUSED",
      dailyBudget: c.daily_budget != null && Number(c.daily_budget) > 0 ? Number(c.daily_budget) : null,
    };
    byUtm.set(utm, [...(byUtm.get(utm) ?? []), item]);
  }
  const out: Record<string, RegionCampaign> = {};
  for (const [region, m] of Object.entries(REGION_CAMPAIGNS)) {
    const list = byUtm.get(m.utm) ?? [];
    const pick = list.find((c) => c.status === "ENABLED") ?? list[0];
    if (pick) out[region] = pick;
  }
  return out;
}

export async function loadRetentionInputs(now = new Date()): Promise<{ inputs: TherapistInput[]; modelInputs: Map<string, ModelInput>; ctx: ReviewContext }> {
  const [therapistsRes, funnelRes, demandRes, guaranteeRows, campaigns] = await Promise.all([
    fetchAllRows<TRow>(() =>
      supabaseAdmin
        .from("therapists")
        .select(
          "id, full_name, status, promotion_source, entity_type, center_account_id, promoted_since, promoted_until, created_at, admin_approved, accepting_new_patients, online, regions, training_areas, age_groups, bio, profile_photo_path, education, experience, phone, email, match_paused_until, gender, therapist_types",
        )
        .or("status.eq.paying,entity_type.eq.center")
        .order("id"),
    ),
    supabaseAdmin.rpc("retention_therapist_funnel", { p_days: WINDOW_DAYS }),
    supabaseAdmin.rpc("retention_region_demand", { p_days: WINDOW_DAYS }),
    computeGuarantee(),
    loadRegionCampaigns(),
  ]);
  if (funnelRes.error) throw new Error(`retention_therapist_funnel: ${funnelRes.error.message}`);
  if (demandRes.error) throw new Error(`retention_region_demand: ${demandRes.error.message}`);

  const funnelBy = new Map<string, FunnelRow>();
  for (const r of (funnelRes.data ?? []) as FunnelRpcRow[]) {
    const { therapist_id, ...rest } = r;
    funnelBy.set(therapist_id, {
      ...EMPTY_FUNNEL,
      ...rest,
      avg_score_cur: rest.avg_score_cur == null ? null : Number(rest.avg_score_cur),
    });
  }

  const demand: Record<string, RegionDemand> = {};
  let demandTotal = 0;
  let demandOnline = 0;
  for (const d of (demandRes.data ?? []) as DemandRpcRow[]) {
    const searches = Number(d.searches) || 0;
    const online = Number(d.online_searches) || 0;
    demandTotal += searches;
    demandOnline += online;
    if (d.region) {
      demand[d.region] = {
        searches,
        online,
        treatmentSessions: Number(d.treatment_sessions) || 0,
        treatments: Array.isArray(d.treatments) ? d.treatments.map((t) => ({ t: String(t.t), n: Number(t.n) || 0 })) : [],
      };
    }
  }

  const guaranteeBy = new Map<string, { daysLeft: number; contacts: number }>();
  for (const g of guaranteeRows) guaranteeBy.set(g.therapist_id, { daysLeft: g.days_left, contacts: g.contacts_in_window });

  const therapists = therapistsRes;
  const ids = therapists.map((t) => t.id);
  const [subsRes, outreach] = await Promise.all([
    ids.length > 0
      ? supabaseAdmin
          .from("subscriptions")
          .select("therapist_id, status, first_charge_on, promo_reverts_at, created_at")
          .in("therapist_id", ids)
          .eq("status", "active")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    lastOutreachByEmail(
      therapists.map((t) => (t.email ?? "").trim().toLowerCase()).filter(Boolean),
      new Date(now.getTime() - OUTREACH_COOLDOWN_DAYS * 86_400_000).toISOString(),
    ),
  ]);
  if (subsRes.error) throw new Error(`subscriptions: ${subsRes.error.message}`);
  const subBy = new Map<string, { first_charge_on: string | null; promo_reverts_at: string | null }>();
  for (const s of subsRes.data ?? []) {
    if (!subBy.has(s.therapist_id as string)) {
      subBy.set(s.therapist_id as string, { first_charge_on: (s.first_charge_on as string | null) ?? null, promo_reverts_at: (s.promo_reverts_at as string | null) ?? null });
    }
  }

  const inputs: TherapistInput[] = therapists.map((t) => ({
    id: t.id,
    name: (t.full_name ?? "").trim() || "מטפל/ת ללא שם",
    status: t.status,
    promotion_source: t.promotion_source,
    entity_type: t.entity_type,
    center_account_id: t.center_account_id,
    promoted_since: t.promoted_since,
    promoted_until: t.promoted_until,
    created_at: t.created_at,
    admin_approved: t.admin_approved,
    accepting_new_patients: t.accepting_new_patients,
    online: t.online,
    cities: Array.isArray(t.regions) ? t.regions : [],
    training_areas: Array.isArray(t.training_areas) ? t.training_areas : [],
    age_groups: Array.isArray(t.age_groups) ? t.age_groups : [],
    bio: t.bio,
    profile_photo_path: t.profile_photo_path,
    education: t.education,
    experience: t.experience,
    phone: t.phone,
    email: t.email,
    match_paused_until: t.match_paused_until,
    subscription: subBy.get(t.id) ?? null,
    guarantee: guaranteeBy.get(t.id) ?? null,
    funnel: funnelBy.get(t.id) ?? null,
    lastOutreachAt: outreach.get((t.email ?? "").trim().toLowerCase()) ?? null,
  }));
  const modelInputs = new Map<string, ModelInput>();
  for (let i = 0; i < inputs.length; i++) {
    const t = therapists[i];
    modelInputs.set(t.id, { ...inputs[i], gender: t.gender, therapist_types: Array.isArray(t.therapist_types) ? t.therapist_types : [] });
  }

  // בנצ'מרק: משלם פרטי, ותק 30 יום, מאושר, לא מוקפא - כמו ב-center-health.
  const peerCutoff = now.getTime() - PEER_TENURE_DAYS * 86_400_000;
  const peers = therapists.filter(
    (t) =>
      t.status === "paying" &&
      t.promotion_source === "paid" &&
      t.admin_approved === true &&
      t.entity_type !== "center" &&
      t.promoted_since != null &&
      new Date(t.promoted_since).getTime() <= peerCutoff &&
      !(t.match_paused_until && new Date(t.match_paused_until).getTime() > now.getTime()),
  );
  const peerFunnel = (t: TRow) => funnelBy.get(t.id) ?? EMPTY_FUNNEL;
  const benchmark = benchmarkFrom(peers.map(peerFunnel));
  const regionBenchmarks: Record<string, Benchmark> = {};
  const peersByRegion = new Map<string, TRow[]>();
  for (const p of peers) for (const r of regionsOf(Array.isArray(p.regions) ? p.regions : [])) peersByRegion.set(r, [...(peersByRegion.get(r) ?? []), p]);
  for (const [region, ps] of peersByRegion) {
    if (ps.length < REGION_BENCHMARK_MIN_PEERS) continue;
    const b = benchmarkFrom(ps.map(peerFunnel));
    if (b) regionBenchmarks[region] = b;
  }

  const weekStart = reviewWeekStart(now);
  const weekEnd = new Date(new Date(weekStart).getTime() + 6 * 86_400_000).toISOString().slice(0, 10);
  const holidays = holidaysBetween(weekStart, weekEnd);

  return {
    inputs,
    modelInputs,
    ctx: {
      now,
      windowDays: WINDOW_DAYS,
      benchmark,
      regionBenchmarks,
      demand,
      demandTotal,
      onlineShare: demandTotal > 0 ? demandOnline / demandTotal : 0,
      holidayWeek: holidays[0]?.name ?? null,
      emailCooldownDays: OUTREACH_COOLDOWN_DAYS,
      campaigns,
    },
  };
}

function severityOf(risk: ReviewRow["risk"]): AgentSeverity {
  if (risk === "critical") return "critical";
  if (risk === "high") return "high";
  if (risk === "medium" || risk === "new") return "normal";
  return "low";
}

const ACTION_TITLES: Record<string, (r: ReviewRow) => string> = {
  fix: (r) => `${r.name}: לתקן באדמין`,
  freeze: (r) => `${r.name}: הקפאה שקטה מוצעת`,
  email: (r) => `${r.name}: טיוטת מייל שיפור`,
  task: (r) => `${r.name}: שיחת שימור`,
};

export async function runRetentionReview(opts?: { mode?: string; now?: Date; noModel?: boolean }): Promise<RetentionReviewResult> {
  if (!agentEnabled("retention")) return { ok: true, disabled: true };
  const now = opts?.now ?? new Date();
  const runId = await startAgentRun("retention", opts?.mode ?? "weekly");
  try {
    const { inputs, modelInputs, ctx } = await loadRetentionInputs(now);
    const { rows, summary } = buildRetentionReview(inputs, ctx);
    const weekStart = reviewWeekStart(now);

    // שלב 2: המודל מוסיף סקירת כרטיס וטיוטות - מעל המנוע, ורק אחריו.
    // כישלון שם משאיר את הסקירה של שלב 1 שלמה.
    const enrichment = opts?.noModel ? null : await enrichReviewWithModel(rows, modelInputs);

    // הצילום: שורת סקירה לשבוע, ושורה לכל מקודם. ריצה חוזרת מחליפה את השורות.
    const { data: review, error: reviewErr } = await supabaseAdmin
      .from("retention_reviews")
      .upsert(
        {
          week_start: weekStart,
          created_at: now.toISOString(),
          run_id: runId,
          narrative: null,
          summary: {
            ...summary,
            benchmark: ctx.benchmark,
            onlineShare: ctx.onlineShare,
            demandTotal: ctx.demandTotal,
            model: enrichment ? { cardReviews: enrichment.cardReviews, drafts: enrichment.drafts } : null,
          },
        },
        { onConflict: "week_start" },
      )
      .select("id")
      .single();
    if (reviewErr || !review) throw new Error(`retention_reviews upsert: ${reviewErr?.message ?? "no row"}`);
    const reviewId = review.id as string;

    const { error: delErr } = await supabaseAdmin.from("retention_review_rows").delete().eq("review_id", reviewId);
    if (delErr) throw new Error(`retention_review_rows delete: ${delErr.message}`);
    const toInsert = rows.map((r) => ({
      review_id: reviewId,
      therapist_id: r.therapist_id,
      name: r.name,
      tier: r.tier,
      risk: r.risk,
      promotion_source: r.promotion_source,
      metrics: r.metrics,
      flags: r.flags,
      actions: r.actions,
      primary_action: r.primary_action,
      risk_reason: r.risk_reason,
      todo: r.todo,
    }));
    for (let i = 0; i < toInsert.length; i += 100) {
      const { error } = await supabaseAdmin.from("retention_review_rows").insert(toInsert.slice(i, i + 100));
      if (error) throw new Error(`retention_review_rows insert: ${error.message}`);
    }

    // התור: פעולה אחת לכל (סוג, מטפל) ברמת הסיכון של השורה; ממצא לכל קריטי,
    // כדי שיגיע לדוח הבוקר. המפתחות יציבים, ולכן פעולה שהמצב שלה חלף נסגרת לבד.
    const active: Omit<NewAgentAction, "agent">[] = [];
    for (const r of rows) {
      for (const a of r.actions) {
        if (!(ACTION_TYPES_IN_QUEUE as readonly string[]).includes(a.type)) continue;
        active.push({
          actionType: `retention_${a.type}`,
          kind: "action",
          severity: severityOf(r.risk),
          title: ACTION_TITLES[a.type]?.(r) ?? `${r.name}: ${a.title}`,
          body: `${r.risk_reason}\n${a.detail}`,
          entityType: "therapist",
          entityId: r.therapist_id,
          entityLabel: r.name,
          dedupeKey: `retention:${a.type}:${r.therapist_id}`,
          payload: {
            action: a.type,
            risk: r.risk,
            tier: r.tier,
            week_start: weekStart,
            flags: r.flags.map((f) => f.label),
            subject: a.subject ?? null,
            body: a.body ?? null,
            days: a.days ?? null,
            link: a.link ?? null,
          },
        });
      }
      if (r.risk === "critical") {
        active.push({
          actionType: "alert",
          kind: "finding",
          severity: "critical",
          title: `${r.name}: ${r.flags[0]?.label ?? "קריטי"}`,
          body: r.risk_reason,
          entityType: "therapist",
          entityId: r.therapist_id,
          entityLabel: r.name,
          dedupeKey: `retention:critical:${r.therapist_id}`,
          payload: { severity: "high", week_start: weekStart },
        });
      }
    }
    // כולל המפתחות של הסוכן היומי הישן (gift_risk / zero30 / drop / center_silent),
    // כדי שהממצאים שהוא השאיר בתור ייסגרו בריצה הראשונה ולא יישארו לנצח.
    const centerIds = [...new Set(inputs.map((t) => t.center_account_id).filter((c): c is string => Boolean(c)))];
    const managedKeys = [
      ...rows.flatMap((r) => [
        ...ACTION_TYPES_IN_QUEUE.map((t) => `retention:${t}:${r.therapist_id}`),
        `retention:critical:${r.therapist_id}`,
        `retention:gift_risk:${r.therapist_id}`,
        `retention:zero30:${r.therapist_id}`,
        `retention:drop:${r.therapist_id}`,
      ]),
      ...centerIds.map((c) => `retention:center_silent:${c}`),
    ];
    const synced = await syncAgentAlerts("retention", active, {
      managedKeys,
      recoveryNote: "המצב השתנה בסקירה השבועית - נסגר אוטומטית",
      snoozeDays: SNOOZE_DAYS,
    });

    const atRisk = rows.filter((r) => r.risk === "critical" || r.risk === "high" || r.risk === "medium");
    await finishAgentRun(runId, {
      status: atRisk.length > 0 ? "ok" : "empty",
      summary:
        atRisk.length > 0
          ? `${summary.byRisk.critical} קריטי, ${summary.byRisk.high} בסיכון גבוה, ${summary.byRisk.medium} בינוני מתוך ${summary.checked} מקודמים; ${summary.actions} פעולות מוכנות`
          : `כל ${summary.checked} המקודמים תקינים`,
      details: {
        review_id: reviewId,
        week_start: weekStart,
        summary,
        findings: atRisk.map((r) => ({ key: `retention:${r.therapist_id}`, severity: r.risk === "medium" ? "medium" : "high", title: `${r.name}: ${r.risk_reason}` })),
        checked: summary.checked,
        queue: synced,
      },
    });
    return { ok: true, reviewId, weekStart, summary, rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishAgentRun(runId, { status: "error", error: msg });
    return { ok: false, error: msg };
  }
}

export type StoredReview = {
  id: string;
  week_start: string;
  created_at: string;
  summary: Record<string, unknown>;
  narrative: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
};

export type StoredReviewRow = {
  id: string;
  therapist_id: string;
  name: string | null;
  tier: ReviewRow["tier"];
  risk: ReviewRow["risk"];
  promotion_source: string | null;
  metrics: ReviewRow["metrics"];
  flags: ReviewRow["flags"];
  actions: ReviewRow["actions"];
  primary_action: string | null;
  risk_reason: string | null;
  todo: string | null;
};

/** תוצאות הפעולות שבוצעו ב-90 הימים האחרונים: פניות לפני ואחרי, עריכת פרופיל, עזיבה. */
export async function retentionOutcomes(now = new Date()): Promise<{ rows: ActionOutcome[]; summary: ReturnType<typeof summarizeOutcomes> }> {
  const since = new Date(now.getTime() - 90 * 86_400_000).toISOString();
  const { data: actions, error } = await supabaseAdmin
    .from("agent_actions")
    .select("id, action_type, entity_id, entity_label, status_changed_at, resolution_note")
    .eq("agent", "retention")
    .eq("status", "executed")
    .in("action_type", ["retention_email", "retention_freeze", "retention_task"])
    .gte("status_changed_at", since)
    .order("status_changed_at", { ascending: false });
  if (error) throw new Error(error.message);
  const executed: ExecutedAction[] = (actions ?? [])
    .filter((a) => a.entity_id && a.status_changed_at)
    .map((a) => ({
      id: a.id as string,
      action_type: a.action_type as string,
      therapist_id: a.entity_id as string,
      entity_label: (a.entity_label as string | null) ?? null,
      executed_at: a.status_changed_at as string,
      resolution_note: (a.resolution_note as string | null) ?? null,
    }));
  if (executed.length === 0) return { rows: [], summary: [] };

  const ids = [...new Set(executed.map((a) => a.therapist_id))];
  const earliest = executed.reduce((m, a) => (a.executed_at < m ? a.executed_at : m), executed[0].executed_at);
  const fromIso = new Date(new Date(earliest).getTime() - 14 * 86_400_000).toISOString();
  const [clicks, statesRes] = await Promise.all([
    fetchAllRows<{ therapist_id: string; session_id: string | null; id: string; clicked_at: string }>(() =>
      supabaseAdmin
        .from("therapist_contact_clicks")
        .select("therapist_id, session_id, id, clicked_at")
        .in("therapist_id", ids)
        .gte("clicked_at", fromIso)
        .or("automated.is.null,automated.eq.false")
        .order("clicked_at"),
    ),
    supabaseAdmin.from("therapists").select("id, status, promotion_source, profile_updated_at").in("id", ids),
  ]);
  if (statesRes.error) throw new Error(statesRes.error.message);
  const contacts: ContactEvent[] = clicks.map((c) => ({ therapist_id: c.therapist_id, sid: c.session_id ?? c.id, at: c.clicked_at }));
  const states = new Map<string, TherapistState>();
  for (const t of statesRes.data ?? []) {
    states.set(t.id as string, { status: (t.status as string | null) ?? null, promotion_source: (t.promotion_source as string | null) ?? null, profile_updated_at: (t.profile_updated_at as string | null) ?? null });
  }
  const rows = computeOutcomes(executed, contacts, states, now);
  return { rows, summary: summarizeOutcomes(rows) };
}

/** הסקירה האחרונה עם השורות שלה, או null כשעוד לא רצה אף פעם. */
export async function latestRetentionReview(): Promise<{ review: StoredReview; rows: StoredReviewRow[] } | null> {
  const { data: review, error } = await supabaseAdmin
    .from("retention_reviews")
    .select("id, week_start, created_at, summary, narrative, acknowledged_at, acknowledged_by")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!review) return null;
  const rows = await fetchAllRows<StoredReviewRow>(() =>
    supabaseAdmin
      .from("retention_review_rows")
      .select("id, therapist_id, name, tier, risk, promotion_source, metrics, flags, actions, primary_action, risk_reason, todo")
      .eq("review_id", review.id)
      .order("created_at"),
  );
  // השורות נכתבות באצווה עם אותה חותמת זמן, ולכן הסדר מהמסד שרירותי.
  return { review: review as StoredReview, rows: sortReviewRows(rows) };
}
