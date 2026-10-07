import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { fetchAllRows } from "./fetch-all-rows";
import type {
  CampaignProfile,
  FunnelDay,
  PendingGiftOffer,
  SupplyChange,
  SupplyTherapist,
} from "./ads-diagnosis";

// Everything the diagnosis reads from the database. The reasoning is in
// ads-diagnosis.ts and takes plain values, so this file is the only part of
// it that cannot be tested without a database - and it only fetches and
// reshapes.

/** Far enough back for a 45-day dry spell and a month of baseline before it. */
export const FUNNEL_DAYS = 75;
/** Who the campaign's visitors are now, not who they were in the summer. */
export const PROFILE_DAYS = 30;
const CHANGE_DAYS = 60;

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : []);
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const israelDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date(iso));

/**
 * The site funnel of every paid campaign, by day, keyed by utm_campaign
 * (untagged paid sessions come under "(ללא תיוג)"). Stages count sessions.
 */
export async function loadCampaignFunnels(): Promise<Map<string, FunnelDay[]>> {
  const { data, error } = await supabaseAdmin.rpc("ads_campaign_funnel_daily", { p_days: FUNNEL_DAYS });
  if (error) throw new Error(`ads_campaign_funnel_daily failed: ${error.message}`);
  const out = new Map<string, FunnelDay[]>();
  for (const row of (data ?? []) as { utm_campaign: string; days: unknown }[]) {
    const days = (Array.isArray(row.days) ? row.days : []) as Record<string, unknown>[];
    out.set(
      row.utm_campaign,
      days
        .map((x) => ({
          d: String(x.d ?? ""),
          s: num(x.s), c: num(x.c), qs: num(x.qs), qd: num(x.qd), r: num(x.r), pv: num(x.pv), k: num(x.k), cl: num(x.cl),
        }))
        .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.d))
        .sort((a, b) => a.d.localeCompare(b.d))
    );
  }
  return out;
}

export type DiagnosisContext = {
  profiles: Map<string, CampaignProfile>;
  supply: SupplyTherapist[];
  supplyChanges: SupplyChange[];
  pendingGiftOffers: PendingGiftOffer[];
};

/**
 * Loaded only when some campaign needs a diagnosis: the visitors' profile per
 * campaign, the listed therapists, who was promoted or demoted lately, and the
 * gift offers already waiting in the queue.
 */
export async function loadDiagnosisContext(): Promise<DiagnosisContext> {
  const since = new Date(Date.now() - CHANGE_DAYS * 86_400_000).toISOString();
  const [profileQ, therapists, audit, offersQ] = await Promise.all([
    supabaseAdmin.rpc("ads_campaign_profile", { p_days: PROFILE_DAYS }),
    fetchAllRows<Record<string, unknown>>(() =>
      supabaseAdmin
        .from("therapists")
        .select("id, full_name, status, gender, therapist_types, age_groups, training_areas, couples_modalities, regions, online, entity_type, accepting_new_patients, promoted_until")
        .in("status", ["paying", "approved"])
        .eq("admin_approved", true)
        .order("id")
    ),
    fetchAllRows<{ therapist_id: string; action: string; created_at: string }>(() =>
      supabaseAdmin
        .from("therapist_audit_log")
        .select("therapist_id, action, created_at")
        .like("action", "status_change:%")
        .gte("created_at", since)
        .order("created_at")
    ),
    supabaseAdmin
      .from("agent_actions")
      .select("payload")
      .eq("action_type", "gift_offer")
      .eq("status", "pending"),
  ]);
  if (profileQ.error) throw new Error(`ads_campaign_profile failed: ${profileQ.error.message}`);
  if (offersQ.error) throw new Error(`pending gift offers failed: ${offersQ.error.message}`);

  const profiles = new Map<string, CampaignProfile>();
  for (const row of (profileQ.data ?? []) as Record<string, unknown>[]) {
    const landing = (Array.isArray(row.landing) ? row.landing : []) as Record<string, unknown>[];
    const regions = (Array.isArray(row.regions) ? row.regions : []) as Record<string, unknown>[];
    const treatments = (Array.isArray(row.treatments) ? row.treatments : []) as Record<string, unknown>[];
    const searches = row.searches && typeof row.searches === "object" ? (row.searches as Record<string, unknown>) : null;
    const quiz = row.quiz_types && typeof row.quiz_types === "object" ? (row.quiz_types as Record<string, unknown>) : {};
    profiles.set(String(row.utm_campaign), {
      landing: landing.map((l) => ({ page: String(l.page ?? ""), n: num(l.n) })).filter((l) => l.page),
      regions: regions.map((r) => ({ region: String(r.region ?? ""), n: num(r.n) })).filter((r) => r.region),
      searches: searches ? { n: num(searches.n), noPlace: num(searches.no_place) } : null,
      quizTypes: Object.fromEntries(Object.entries(quiz).map(([k, v]) => [k, num(v)])),
      treatmentSessions: num(row.treatment_sessions),
      treatments: treatments.map((t) => ({ t: String(t.t ?? ""), n: num(t.n) })).filter((t) => t.t),
    });
  }

  // A centre's own row stands for a whole team and has no profession of its
  // own, and a therapist who is not taking new patients is not supply.
  const supply: SupplyTherapist[] = therapists
    .filter((t) => t.entity_type !== "center" && t.accepting_new_patients !== false)
    .map((t) => {
      const ages = strings(t.age_groups);
      const areas = strings(t.training_areas);
      if (strings(t.couples_modalities).length > 0 && !areas.includes("טיפול זוגי")) areas.push("טיפול זוגי");
      return {
        id: String(t.id),
        name: String(t.full_name ?? "").trim(),
        promoted: t.status === "paying",
        psychologist: strings(t.therapist_types).some((x) => x.includes("פסיכולוג")),
        female: t.gender === "נקבה",
        adults: ages.includes("מבוגרים"),
        kids: ages.some((a) => a === "ילדים" || a === "נוער" || a === "גיל הרך"),
        online: t.online === true,
        regions: strings(t.regions),
        areas,
        promotedUntil: t.status === "paying" && typeof t.promoted_until === "string" ? israelDay(t.promoted_until) : null,
      };
    });

  const supplyChanges: SupplyChange[] = [];
  for (const a of audit) {
    const m = /^status_change:(\w+)->(\w+)$/.exec(a.action);
    if (!m || m[1] === m[2]) continue;
    if (m[1] === "paying") supplyChanges.push({ date: israelDay(a.created_at), therapistId: a.therapist_id, kind: "demoted" });
    else if (m[2] === "paying") supplyChanges.push({ date: israelDay(a.created_at), therapistId: a.therapist_id, kind: "promoted" });
  }

  const pendingGiftOffers: PendingGiftOffer[] = [];
  for (const row of (offersQ.data ?? []) as { payload: Record<string, unknown> | null }[]) {
    const p = row.payload ?? {};
    const candidates = (Array.isArray(p.candidates) ? p.candidates : []) as Record<string, unknown>[];
    if (typeof p.region !== "string" || typeof p.treatment !== "string") continue;
    pendingGiftOffers.push({
      regionLabel: p.region,
      treatment: p.treatment,
      candidates: candidates
        .map((c) => ({ id: String(c.therapist_id ?? ""), name: String(c.full_name ?? "").trim() }))
        .filter((c) => c.id && c.name),
    });
  }

  return { profiles, supply, supplyChanges, pendingGiftOffers };
}
