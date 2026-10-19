// ענף בתי הספר: הספרייה בשרת. כל נתיבי ה-API של הענף (של הבעלים תחת
// /api/admin-schools, של השותפה תחת /api/partner-schools בשלב ב') קוראים לכאן
// עם אובייקט "צופה", והספרייה אוכפת מה מותר למי. אין כאן ייבוא של Next.
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import {
  DEFAULT_BRANCH_SETTINGS,
  generateAccessCode,
  grossToNet,
  licenseUsable,
  normalizeAccessCode,
  paymentSchedule,
  planLicense,
  schoolYearOf,
  type BranchSettings,
  type SchoolEntityType,
} from "./schools-crm";

export type Viewer = { role: "owner" | "partner"; name: string };

export class SchoolsCrmError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function assertOwner(v: Viewer, what: string) {
  if (v.role !== "owner") throw new SchoolsCrmError(`${what}: רק הבעלים`, 403);
}

function todayIL(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
}

// ── הגדרות ─────────────────────────────────────────────────────────────────────
export async function getBranchSettings(): Promise<BranchSettings & { version: number }> {
  const { data, error } = await supabaseAdmin
    .from("school_branch_settings")
    .select("version, data")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new SchoolsCrmError(error.message, 500);
  if (!data) return { ...DEFAULT_BRANCH_SETTINGS, version: 0 };
  return { ...DEFAULT_BRANCH_SETTINGS, ...(data.data as Partial<BranchSettings>), version: data.version as number };
}

export async function saveBranchSettings(v: Viewer, next: BranchSettings, note?: string): Promise<number> {
  assertOwner(v, "שינוי הגדרות הענף");
  const current = await getBranchSettings();
  const version = current.version + 1;
  const { error } = await supabaseAdmin.from("school_branch_settings").insert({
    version,
    effective_from: todayIL(),
    data: next,
    note: note ?? null,
    created_by: v.name,
  });
  if (error) throw new SchoolsCrmError(error.message, 500);
  return version;
}

// ── יומן פעילות ─────────────────────────────────────────────────────────────────
export async function logActivity(
  v: Viewer,
  entityType: SchoolEntityType,
  entityId: string,
  kind: string,
  summary: string,
  happenedAt?: string,
): Promise<void> {
  const { error } = await supabaseAdmin.from("school_activities").insert({
    entity_type: entityType,
    entity_id: entityId,
    kind,
    summary: summary.slice(0, 2000),
    actor: v.name,
    happened_at: happenedAt ?? new Date().toISOString(),
  });
  if (error) throw new SchoolsCrmError(error.message, 500);
}

// ── בעלויות, בתי ספר, אנשי קשר ──────────────────────────────────────────────────
type Row = Record<string, unknown>;

async function upsert(table: string, v: Viewer, patch: Row, id?: string): Promise<Row> {
  const now = new Date().toISOString();
  if (id) {
    const { data, error } = await supabaseAdmin.from(table).update({ ...patch, updated_at: now }).eq("id", id).select().single();
    if (error) throw new SchoolsCrmError(error.message, 500);
    return data as Row;
  }
  const { data, error } = await supabaseAdmin.from(table).insert({ ...patch, created_by: v.name }).select().single();
  if (error) throw new SchoolsCrmError(error.message, 500);
  return data as Row;
}

export const saveOwner = (v: Viewer, patch: Row, id?: string) => upsert("school_owners", v, patch, id);
export const saveSchool = (v: Viewer, patch: Row, id?: string) => upsert("schools", v, patch, id);
export const saveContact = (v: Viewer, patch: Row, id?: string) => upsert("school_contacts", v, patch, id);
export const saveTraining = (v: Viewer, patch: Row, id?: string) => upsert("school_trainings", v, patch, id);

export type SchoolListFilter = { status?: string; region?: string; ownerId?: string; q?: string; includeDemo?: boolean };

export async function listSchools(f: SchoolListFilter = {}) {
  let q = supabaseAdmin.from("schools").select("*, school_owners(name, kind)").order("updated_at", { ascending: false }).limit(500);
  if (f.status) q = q.eq("status", f.status);
  if (f.region) q = q.eq("region_key", f.region);
  if (f.ownerId) q = q.eq("owner_id", f.ownerId);
  if (!f.includeDemo) q = q.eq("is_demo", false);
  if (f.q) q = q.or(`name.ilike.%${f.q}%,city.ilike.%${f.q}%,symbol.ilike.%${f.q}%`);
  const { data, error } = await q;
  if (error) throw new SchoolsCrmError(error.message, 500);
  return data ?? [];
}

export async function getSchoolDetail(id: string) {
  const [school, contacts, deals, licenses, trainings, activities] = await Promise.all([
    supabaseAdmin.from("schools").select("*, school_owners(*)").eq("id", id).single(),
    supabaseAdmin.from("school_contacts").select("*").eq("school_id", id).order("is_primary", { ascending: false }),
    supabaseAdmin.from("school_deals").select("*").eq("school_id", id).order("created_at", { ascending: false }),
    supabaseAdmin.from("school_licenses").select("*, school_payments(*)").eq("school_id", id).order("start_date", { ascending: false }),
    supabaseAdmin.from("school_trainings").select("*").eq("school_id", id).order("held_on", { ascending: false }),
    supabaseAdmin.from("school_activities").select("*").eq("entity_type", "school").eq("entity_id", id).order("happened_at", { ascending: false }).limit(200),
  ]);
  for (const r of [school, contacts, deals, licenses, trainings, activities]) {
    if (r.error) throw new SchoolsCrmError(r.error.message, r.error.code === "PGRST116" ? 404 : 500);
  }
  return { school: school.data, contacts: contacts.data ?? [], deals: deals.data ?? [], licenses: licenses.data ?? [], trainings: trainings.data ?? [], activities: activities.data ?? [] };
}

// ── עסקאות ──────────────────────────────────────────────────────────────────────
export async function saveDeal(v: Viewer, patch: Row, id?: string): Promise<Row> {
  const now = new Date().toISOString();
  if (!id) {
    const deal = await upsert("school_deals", v, { ...patch, stage_changed_at: now });
    await logActivity(v, "school_deal", deal.id as string, "status", `עסקה נפתחה: ${String(deal.stage)}`);
    return deal;
  }
  const { data: before } = await supabaseAdmin.from("school_deals").select("stage").eq("id", id).single();
  const stageChanged = typeof patch.stage === "string" && before && patch.stage !== before.stage;
  const extra: Row = {};
  if (stageChanged) {
    extra.stage_changed_at = now;
    extra.closed_at = patch.stage === "active" || patch.stage === "lost" ? now : null;
  }
  const deal = await upsert("school_deals", v, { ...patch, ...extra }, id);
  if (stageChanged) await logActivity(v, "school_deal", id, "status", `סטטוס: ${String(before?.stage)} → ${String(patch.stage)}`);
  return deal;
}

// ── רישיונות ותשלומים ───────────────────────────────────────────────────────────
export type NewLicense = {
  school_id: string;
  deal_id?: string | null;
  kind: string; // annual / partial / pilot / demo / trial / training_only
  activation_date?: string; // ברירת מחדל: היום
  price_gross: number; // 0 לפיילוט, הדגמה וניסיון
  schedule_kind?: string; // full / split_40_60
  notes?: string;
};

export async function createLicense(v: Viewer, input: NewLicense) {
  const settings = await getBranchSettings();
  const activation = input.activation_date ?? todayIL();
  const plan = planLicense(input.kind, activation, settings);
  const free = input.price_gross <= 0;
  const scheduleKind = input.schedule_kind ?? "full";
  const sy = schoolYearOf(plan.next_year_purchase ? plan.end_date : activation);

  // קוד ייחודי: נסיון חוזר אם במקרה כבר קיים.
  let code = generateAccessCode();
  for (let i = 0; i < 5; i++) {
    const { data } = await supabaseAdmin.from("school_licenses").select("id").eq("access_code", code).maybeSingle();
    if (!data) break;
    code = generateAccessCode();
  }

  const row = {
    school_id: input.school_id,
    deal_id: input.deal_id ?? null,
    school_year: plan.school_year,
    start_date: plan.start_date,
    end_date: plan.end_date,
    kind: plan.kind,
    price_gross: input.price_gross,
    price_net: grossToNet(input.price_gross),
    months: plan.months,
    // רישיון בלי תשלום (פיילוט, הדגמה, ניסיון) פעיל מיד.
    status: free ? "active" : "pending_payment",
    paid_at: free ? new Date().toISOString() : null,
    access_code: code,
    schedule_kind: scheduleKind,
    notes: input.notes ?? null,
    created_by: v.name,
  };
  const { data: license, error } = await supabaseAdmin.from("school_licenses").insert(row).select().single();
  if (error) throw new SchoolsCrmError(error.message, 500);

  if (!free) {
    const payments = paymentSchedule(input.price_gross, scheduleKind, activation, sy).map((p) => ({ ...p, license_id: license.id }));
    const { error: pErr } = await supabaseAdmin.from("school_payments").insert(payments);
    if (pErr) throw new SchoolsCrmError(pErr.message, 500);
  }
  await logActivity(v, "school_license", license.id, "system", free ? `רישיון ${plan.kind} הופעל` : `רישיון ${plan.kind} נוצר, ממתין לתשלום`);
  await logActivity(v, "school", input.school_id, "system", `רישיון ${plan.kind} לשנת ${plan.school_year}`);
  return license;
}

export async function markPaymentReceived(
  v: Viewer,
  paymentId: string,
  details: { method: string; received_at?: string; sumit_document_number?: string; proforma_number?: string; statement_line_id?: string; note?: string },
) {
  const receivedAt = details.received_at ?? new Date().toISOString();
  const { data: payment, error } = await supabaseAdmin
    .from("school_payments")
    .update({
      status: "received",
      method: details.method,
      received_at: receivedAt,
      sumit_document_number: details.sumit_document_number ?? null,
      proforma_number: details.proforma_number ?? null,
      statement_line_id: details.statement_line_id ?? null,
      note: details.note ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .select("id, seq, license_id, amount_gross")
    .single();
  if (error) throw new SchoolsCrmError(error.message, 500);

  // התשלום הראשון מפעיל את הרישיון.
  if (payment.seq === 1) {
    const { data: lic, error: lErr } = await supabaseAdmin
      .from("school_licenses")
      .update({ status: "active", paid_at: receivedAt, updated_at: new Date().toISOString() })
      .eq("id", payment.license_id)
      .eq("status", "pending_payment")
      .select("id, school_id")
      .maybeSingle();
    if (lErr) throw new SchoolsCrmError(lErr.message, 500);
    if (lic) {
      await supabaseAdmin.from("schools").update({ status: "customer", updated_at: new Date().toISOString() }).eq("id", lic.school_id).in("status", ["prospect", "pilot", "past"]);
      await logActivity(v, "school_license", lic.id, "system", `התקבל תשלום ${payment.amount_gross} ש"ח (${details.method}); הרישיון הופעל`);
    }
  } else {
    await logActivity(v, "school_license", payment.license_id, "system", `התקבל תשלום ${payment.seq}: ${payment.amount_gross} ש"ח (${details.method})`);
  }
  return payment;
}

export async function setLicenseCode(v: Viewer, licenseId: string, disabled: boolean) {
  const { error } = await supabaseAdmin.from("school_licenses").update({ code_disabled: disabled, updated_at: new Date().toISOString() }).eq("id", licenseId);
  if (error) throw new SchoolsCrmError(error.message, 500);
  await logActivity(v, "school_license", licenseId, "system", disabled ? "קוד הגישה הושבת" : "קוד הגישה הופעל מחדש");
}

export async function cancelLicense(v: Viewer, licenseId: string, reason: string) {
  assertOwner(v, "ביטול רישיון");
  const { error } = await supabaseAdmin
    .from("school_licenses")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", licenseId);
  if (error) throw new SchoolsCrmError(error.message, 500);
  await logActivity(v, "school_license", licenseId, "system", `הרישיון בוטל: ${reason}`);
}

// ── קוד גישה בשאלון ───────────────────────────────────────────────────────────────
export type AccessGrant = { school_id: string; license_id: string; end_date: string; is_demo: boolean };

/** מאמת קוד שיועצת הקלידה. מחזיר null בלי להסביר למה (לא לחשוף קודים). */
export async function verifyAccessCode(input: string): Promise<AccessGrant | null> {
  const code = normalizeAccessCode(input);
  if (!code) return null;
  const { data, error } = await supabaseAdmin
    .from("school_licenses")
    .select("id, school_id, kind, status, start_date, end_date, price_net, months, paid_at, refunded_at, code_disabled, schools!inner(is_demo)")
    .eq("access_code", code)
    .maybeSingle();
  if (error || !data) return null;
  if (!licenseUsable(data, todayIL())) return null;
  const school = data.schools as unknown as { is_demo: boolean } | { is_demo: boolean }[];
  const isDemo = Array.isArray(school) ? !!school[0]?.is_demo : !!school?.is_demo;
  return { school_id: data.school_id, license_id: data.id, end_date: data.end_date, is_demo: isDemo };
}

/** רישיון עדיין פותח את השאלון (נבדק בכל חישוב, לא רק בכניסה). */
export async function licenseStillUsable(licenseId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("school_licenses")
    .select("kind, status, start_date, end_date, price_net, months, paid_at, refunded_at, code_disabled")
    .eq("id", licenseId)
    .maybeSingle();
  return !!data && licenseUsable(data, todayIL());
}

export async function bumpSchoolUsage(schoolId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc("bump_school_usage", { p_school_id: schoolId });
  if (error) console.error("bump_school_usage failed:", error.message);
}
