// ענף בתי הספר: הספרייה בשרת. כל נתיבי ה-API של הענף (של הבעלים תחת
// /api/admin-schools, של השותפה תחת /api/partner-schools בשלב ב') קוראים לכאן
// עם אובייקט "צופה", והספרייה אוכפת מה מותר למי. אין כאן ייבוא של Next.
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import {
  CLOSED_DEAL_STAGES,
  DEAL_STAGES,
  DEFAULT_BRANCH_SETTINGS,
  LICENSE_KINDS,
  PAYMENT_METHODS,
  SCHOOL_STATUSES,
  generateAccessCode,
  grossToNet,
  labelOf,
  licenseUsable,
  nextExpectedPayment,
  normalizeAccessCode,
  payPageOpen,
  paymentSchedule,
  planLicense,
  schoolYearOf,
  vatOf,
  autoMatchable,
  matchTransferCandidates,
  type BankCredit,
  type BranchSettings,
  type ExpectedPayment,
  type SchoolEntityType,
  type TransferCandidate,
} from "./schools-crm";

/** מי פועל: הבעלים מהאדמין, או שותפה מהפורטל (/partner) עם המשתמש שלה. */
export type Viewer = { role: "owner" | "partner"; name: string; user_id?: string };

/** הבעלים מהאדמין (Basic Auth, בלי משתמשים): שם קבוע ביומן הפעילות. */
export const OWNER_VIEWER: Viewer = { role: "owner", name: "בעלים" };
/** דף התשלום הציבורי: פעולות מערכת שבית הספר גרם להן. */
export const PAY_PAGE_VIEWER: Viewer = { role: "owner", name: "דף התשלום" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID_RE.test(s);

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
  const stored = data.data as Partial<BranchSettings>;
  return {
    ...DEFAULT_BRANCH_SETTINGS,
    ...stored,
    payment_details: { ...DEFAULT_BRANCH_SETTINGS.payment_details, ...(stored.payment_details ?? {}) },
    version: data.version as number,
  };
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

// לא לכל טבלה יש created_by ו-updated_at (school_contacts בלי הראשון,
// school_trainings בלי השני): עמודה שאין בטבלה היא שגיאת כתיבה, אז מוסיפים
// כל אחת רק איפה שהיא קיימת במיגרציה.
const HAS_CREATED_BY = new Set(["school_owners", "schools", "school_deals", "school_trainings", "school_licenses"]);
const HAS_UPDATED_AT = new Set(["school_owners", "schools", "school_contacts", "school_deals", "school_licenses"]);

async function upsert(table: string, v: Viewer, patch: Row, id?: string): Promise<Row> {
  if (id) {
    const row = HAS_UPDATED_AT.has(table) ? { ...patch, updated_at: new Date().toISOString() } : patch;
    const { data, error } = await supabaseAdmin.from(table).update(row).eq("id", id).select().single();
    if (error) throw new SchoolsCrmError(error.message, 500);
    return data as Row;
  }
  const row = HAS_CREATED_BY.has(table) ? { ...patch, created_by: v.name } : patch;
  const { data, error } = await supabaseAdmin.from(table).insert(row).select().single();
  if (error) throw new SchoolsCrmError(error.message, 500);
  return data as Row;
}

export const saveOwner = (v: Viewer, patch: Row, id?: string) => upsert("school_owners", v, patch, id);
/** בית ספר חדש או עדכון. הוספה ושינוי סטטוס נרשמים בציר הזמן של בית הספר. */
export async function saveSchool(v: Viewer, patch: Row, id?: string): Promise<Row> {
  if (!id) {
    const school = await upsert("schools", v, patch);
    await logActivity(v, "school", school.id as string, "system", "בית הספר נוסף לרשימה");
    return school;
  }
  const { data: before } = await supabaseAdmin.from("schools").select("status").eq("id", id).maybeSingle();
  const school = await upsert("schools", v, patch, id);
  if (typeof patch.status === "string" && before && patch.status !== before.status) {
    await logActivity(v, "school", id, "status", `סטטוס בית הספר השתנה מ"${labelOf(SCHOOL_STATUSES, before.status as string)}" ל"${labelOf(SCHOOL_STATUSES, patch.status)}"`);
  }
  return school;
}
export const saveContact = (v: Viewer, patch: Row, id?: string) => upsert("school_contacts", v, patch, id);
export const saveTraining = (v: Viewer, patch: Row, id?: string) => upsert("school_trainings", v, patch, id);

export type SchoolListFilter = { status?: string; region?: string; ownerId?: string; q?: string; includeDemo?: boolean; limit?: number };

/** טקסט חופשי בלי התווים ששוברים את מחרוזת הסינון של PostgREST (פסיק, סוגריים, אחוז, כוכבית). */
function searchTerm(q: string | undefined): string {
  return (q ?? "").replace(/[,()%*\\"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export async function listSchools(f: SchoolListFilter = {}) {
  let q = supabaseAdmin
    .from("schools")
    .select("*, school_owners(name, kind)")
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(f.limit ?? 500, 1), 500));
  if (f.status) q = q.eq("status", f.status);
  if (f.region) q = q.eq("region_key", f.region);
  if (f.ownerId) q = q.eq("owner_id", f.ownerId);
  if (!f.includeDemo) q = q.eq("is_demo", false);
  const term = searchTerm(f.q);
  if (term) q = q.or(`name.ilike.%${term}%,city.ilike.%${term}%,symbol.ilike.%${term}%`);
  const { data, error } = await q;
  if (error) throw new SchoolsCrmError(error.message, 500);
  return data ?? [];
}

/** כמה בתי ספר בכל סטטוס, באותם סינונים (חוץ מהסטטוס עצמו), לשורת הסיכום. */
export async function countSchoolsByStatus(f: SchoolListFilter = {}): Promise<Record<string, number>> {
  const term = searchTerm(f.q);
  const entries = await Promise.all(
    SCHOOL_STATUSES.map(async (st) => {
      let q = supabaseAdmin.from("schools").select("id", { count: "exact", head: true }).eq("status", st.value);
      if (f.region) q = q.eq("region_key", f.region);
      if (f.ownerId) q = q.eq("owner_id", f.ownerId);
      if (!f.includeDemo) q = q.eq("is_demo", false);
      if (term) q = q.or(`name.ilike.%${term}%,city.ilike.%${term}%,symbol.ilike.%${term}%`);
      const { count, error } = await q;
      if (error) throw new SchoolsCrmError(error.message, 500);
      return [st.value, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export type SchoolOverview = { open_deal_stage: string | null; has_active_license: boolean; last_activity_at: string | null };

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * לשורת הרשימה: שלב העסקה הפתוחה, האם יש רישיון שפותח את השאלון היום, ומועד
 * הפעילות האחרונה (של בית הספר, של עסקאותיו ושל רישיונותיו). בחבילות של 60
 * מזהים, כדי שכתובת הבקשה לא תתנפח כשהרשימה ארוכה.
 */
export async function schoolsOverview(schoolIds: string[]): Promise<Map<string, SchoolOverview>> {
  const out = new Map<string, SchoolOverview>();
  for (const id of schoolIds) out.set(id, { open_deal_stage: null, has_active_license: false, last_activity_at: null });
  if (schoolIds.length === 0) return out;
  const today = todayIL();
  const parts = chunk(schoolIds, 60);

  const [dealResults, licenseResults] = await Promise.all([
    Promise.all(parts.map((ids) => supabaseAdmin.from("school_deals").select("id, school_id, stage, stage_changed_at").in("school_id", ids))),
    Promise.all(
      parts.map((ids) =>
        supabaseAdmin
          .from("school_licenses")
          .select("id, school_id, kind, status, start_date, end_date, price_net, months, paid_at, refunded_at, code_disabled")
          .in("school_id", ids),
      ),
    ),
  ]);
  for (const r of [...dealResults, ...licenseResults]) if (r.error) throw new SchoolsCrmError(r.error.message, 500);

  // מזהה ישות (בית ספר, עסקה, רישיון) ← בית הספר שלו.
  const ownerOf = new Map<string, string>(schoolIds.map((id) => [id, id]));
  const openSince = new Map<string, string>();
  for (const d of dealResults.flatMap((r) => r.data ?? [])) {
    ownerOf.set(d.id, d.school_id);
    if ((CLOSED_DEAL_STAGES as readonly string[]).includes(d.stage)) continue;
    const row = out.get(d.school_id);
    if (!row) continue;
    if (!openSince.has(d.school_id) || String(d.stage_changed_at) > (openSince.get(d.school_id) as string)) {
      openSince.set(d.school_id, String(d.stage_changed_at));
      row.open_deal_stage = d.stage;
    }
  }
  for (const l of licenseResults.flatMap((r) => r.data ?? [])) {
    ownerOf.set(l.id, l.school_id);
    const row = out.get(l.school_id);
    if (row && licenseUsable(l, today)) row.has_active_license = true;
  }

  const activityResults = await Promise.all(
    chunk([...ownerOf.keys()], 60).map((ids) =>
      supabaseAdmin.from("school_activities").select("entity_id, happened_at").in("entity_id", ids).order("happened_at", { ascending: false }).limit(1000),
    ),
  );
  for (const r of activityResults) if (r.error) throw new SchoolsCrmError(r.error.message, 500);
  for (const a of activityResults.flatMap((r) => r.data ?? [])) {
    const row = out.get(ownerOf.get(a.entity_id) ?? "");
    if (row && (!row.last_activity_at || a.happened_at > row.last_activity_at)) row.last_activity_at = a.happened_at;
  }
  return out;
}

/** בעלויות עם מספר בתי הספר של כל אחת. */
export async function listOwners(): Promise<(Row & { id: string; name: string; schools_count: number })[]> {
  const { data, error } = await supabaseAdmin.from("school_owners").select("*, schools(count)").order("name", { ascending: true }).limit(1000);
  if (error) throw new SchoolsCrmError(error.message, 500);
  return (data ?? []).map((o: Row & { id: string; name: string; schools?: { count: number }[] }) => {
    const { schools, ...rest } = o;
    return { ...rest, schools_count: Number(schools?.[0]?.count ?? 0) };
  });
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
    if (r.error) throw r.error.code === "PGRST116" ? new SchoolsCrmError("בית הספר לא נמצא", 404) : new SchoolsCrmError(r.error.message, 500);
  }
  return { school: school.data, contacts: contacts.data ?? [], deals: deals.data ?? [], licenses: licenses.data ?? [], trainings: trainings.data ?? [], activities: activities.data ?? [] };
}

/** ציר הזמן של בית ספר: הפעילות שלו, של עסקאותיו ושל רישיונותיו, מהחדש לישן. */
export async function schoolTimeline(schoolId: string, dealIds: string[], licenseIds: string[]) {
  const { data, error } = await supabaseAdmin
    .from("school_activities")
    .select("*")
    .in("entity_id", [schoolId, ...dealIds, ...licenseIds])
    .order("happened_at", { ascending: false })
    .limit(300);
  if (error) throw new SchoolsCrmError(error.message, 500);
  return data ?? [];
}

/** איש קשר שסומן ראשי הופך לראשי היחיד בבית הספר. */
export async function clearOtherPrimaryContacts(schoolId: string, keepId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("school_contacts")
    .update({ is_primary: false, updated_at: new Date().toISOString() })
    .eq("school_id", schoolId)
    .eq("is_primary", true)
    .neq("id", keepId);
  if (error) throw new SchoolsCrmError(error.message, 500);
}

// ── עסקאות ──────────────────────────────────────────────────────────────────────
export async function saveDeal(v: Viewer, patch: Row, id?: string): Promise<Row> {
  const now = new Date().toISOString();
  if (!id) {
    const closed = patch.stage === "active" || patch.stage === "lost";
    const deal = await upsert("school_deals", v, { ...patch, stage_changed_at: now, ...(closed ? { closed_at: now } : {}) });
    await logActivity(v, "school_deal", deal.id as string, "status", `עסקה נפתחה בשלב "${labelOf(DEAL_STAGES, String(deal.stage))}"`);
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
  if (stageChanged) await logActivity(v, "school_deal", id, "status", `שלב העסקה השתנה מ"${labelOf(DEAL_STAGES, String(before?.stage))}" ל"${labelOf(DEAL_STAGES, String(patch.stage))}"`);
  return deal;
}

/** כל העסקאות עם בית הספר (או הבעלות) שלהן, ללוח הצינור. */
export async function listDeals() {
  const { data, error } = await supabaseAdmin
    .from("school_deals")
    .select("*, schools(name, city, symbol, is_demo), school_owners(name)")
    .order("stage_changed_at", { ascending: false })
    .limit(1000);
  if (error) throw new SchoolsCrmError(error.message, 500);
  return data ?? [];
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
  const kindLabel = labelOf(LICENSE_KINDS, plan.kind);
  await logActivity(v, "school_license", license.id, "system", free ? `רישיון ${kindLabel} הופעל` : `רישיון ${kindLabel} נוצר, ממתין לתשלום`);
  await logActivity(v, "school", input.school_id, "system", `רישיון ${kindLabel} לשנת ${plan.school_year}`);
  return license;
}

export async function markPaymentReceived(
  v: Viewer,
  paymentId: string,
  details: {
    method: string;
    received_at?: string;
    sumit_document_id?: string;
    sumit_document_number?: string;
    proforma_number?: string;
    statement_line_id?: string;
    note?: string;
  },
  opts: { fromCardCharge?: boolean } = {},
) {
  const receivedAt = details.received_at ?? new Date().toISOString();
  // חיוב בכרטיס שנמצא באמצע (דף התשלום תפס את התשלום ל-method 'card') נרשם
  // רק על ידי דף התשלום עצמו. סימון ידני באותו רגע היה רושם את הכסף פעמיים.
  if (!opts.fromCardCharge) {
    const { data: cur } = await supabaseAdmin.from("school_payments").select("method, status, updated_at").eq("id", paymentId).maybeSingle();
    if (cur && cur.status === "expected" && cur.method === "card" && Date.now() - Date.parse(cur.updated_at as string) < CARD_CLAIM_MS) {
      throw new SchoolsCrmError("חיוב בכרטיס על התשלום הזה נמצא בתהליך. אפשר לנסות שוב בעוד כמה דקות.", 409);
    }
  }
  const { data: payment, error } = await supabaseAdmin
    .from("school_payments")
    .update({
      status: "received",
      method: details.method,
      received_at: receivedAt,
      sumit_document_id: details.sumit_document_id ?? null,
      sumit_document_number: details.sumit_document_number ?? null,
      proforma_number: details.proforma_number ?? null,
      statement_line_id: details.statement_line_id ?? null,
      note: details.note ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    // רק תשלום שעוד צפוי: תשלום שכבר נרשם (עם שורת הבנק או מסמך ה-Sumit שלו),
    // בוטל או הוחזר לא נדרס.
    .eq("status", "expected")
    .select("id, seq, license_id, amount_gross")
    .maybeSingle();
  if (error) throw new SchoolsCrmError(error.message, 500);
  if (!payment) throw new SchoolsCrmError("התשלום הזה כבר נרשם, בוטל או הוחזר, ולכן לא סומן שוב.", 409);

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
      await logActivity(v, "school_license", lic.id, "system", `התקבל תשלום ${payment.amount_gross} ש"ח (${labelOf(PAYMENT_METHODS, details.method)}); הרישיון הופעל`);
    }
  } else {
    await logActivity(v, "school_license", payment.license_id, "system", `התקבל תשלום ${payment.seq}: ${payment.amount_gross} ש"ח (${labelOf(PAYMENT_METHODS, details.method)})`);
  }
  return payment;
}

export async function setLicenseCode(v: Viewer, licenseId: string, disabled: boolean) {
  const { error } = await supabaseAdmin.from("school_licenses").update({ code_disabled: disabled, updated_at: new Date().toISOString() }).eq("id", licenseId);
  if (error) throw new SchoolsCrmError(error.message, 500);
  await logActivity(v, "school_license", licenseId, "system", disabled ? "קוד הגישה הושבת" : "קוד הגישה הופעל מחדש");
}

// ביטול רישיון פתוח גם לשותפה (החלטת הבעלים, 21/10/2026).
export async function cancelLicense(v: Viewer, licenseId: string, reason: string) {
  const { error } = await supabaseAdmin
    .from("school_licenses")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", licenseId);
  if (error) throw new SchoolsCrmError(error.message, 500);
  await logActivity(v, "school_license", licenseId, "system", `הרישיון בוטל: ${reason}`);
}

/** כל הרישיונות עם בית הספר והתשלומים שלהם, לאדמין. */
export async function listLicenses() {
  const { data, error } = await supabaseAdmin
    .from("school_licenses")
    .select("*, schools(name, symbol, city, is_demo), school_payments(*)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new SchoolsCrmError(error.message, 500);
  return (data ?? []).map((l) => ({ ...l, school_payments: [...(l.school_payments ?? [])].sort((a, b) => a.seq - b.seq) }));
}

// ── דף התשלום ───────────────────────────────────────────────────────────────────
export type PayPagePayment = {
  id: string;
  seq: number;
  amount_gross: number;
  amount_net: number;
  due_date: string | null;
  status: string;
  received_at: string | null;
  method: string | null;
};

/**
 * מה שדף התשלום הציבורי מציג. בלי קוד הגישה: הוא נמסר רק אחרי שהתשלום
 * הראשון התקבל (בדף, אחרי חיוב בכרטיס; באדמין, אחרי העברה).
 */
export async function getPayPage(licenseId: string) {
  if (!isUuid(licenseId)) return null;
  const { data: l, error } = await supabaseAdmin
    .from("school_licenses")
    .select("id, school_id, kind, status, school_year, start_date, end_date, price_gross, price_net, schedule_kind, schools!inner(name, symbol), school_payments(id, seq, amount_gross, amount_net, due_date, status, received_at, method)")
    .eq("id", licenseId)
    .maybeSingle();
  if (error || !l) return null;
  const school = (Array.isArray(l.schools) ? l.schools[0] : l.schools) as { name: string; symbol: string | null };
  const payments = ([...(l.school_payments ?? [])] as PayPagePayment[]).sort((a, b) => a.seq - b.seq);
  const settings = await getBranchSettings();
  return {
    license: {
      id: l.id,
      school_id: l.school_id,
      kind: l.kind,
      status: l.status,
      school_year: l.school_year,
      start_date: l.start_date,
      end_date: l.end_date,
      price_gross: Number(l.price_gross),
      price_net: Number(l.price_net),
      vat: vatOf(Number(l.price_gross)),
      schedule_kind: l.schedule_kind,
    },
    school: { name: school.name, symbol: school.symbol },
    payments: payments.map((p) => ({ ...p, amount_gross: Number(p.amount_gross), amount_net: Number(p.amount_net) })),
    next: nextExpectedPayment(payments),
    open: payPageOpen(l, todayIL()),
    details: settings.payment_details,
  };
}

/**
 * תופס תשלום לחיוב בכרטיס, כדי ששתי לחיצות לא יחייבו פעמיים: method עובר
 * ל-'card' בעוד הסטטוס נשאר 'expected'. תפיסה שנשארה תלויה (קריסה באמצע)
 * משתחררת אחרי שתי דקות.
 */
/** כמה זמן תפיסה של חיוב בכרטיס נחשבת "בתהליך". */
const CARD_CLAIM_MS = 10 * 60 * 1000;

export async function claimPaymentForCard(paymentId: string): Promise<boolean> {
  const stale = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("school_payments")
    .update({ method: "card", note: "חיוב בכרטיס בתהליך", updated_at: new Date().toISOString() })
    .eq("id", paymentId)
    .eq("status", "expected")
    .or(`method.is.null,and(method.eq.card,updated_at.lt.${stale})`)
    .select("id");
  if (error) throw new SchoolsCrmError(error.message, 500);
  return (data?.length ?? 0) > 0;
}

export async function releasePaymentClaim(paymentId: string): Promise<void> {
  await supabaseAdmin
    .from("school_payments")
    .update({ method: null, note: null, updated_at: new Date().toISOString() })
    .eq("id", paymentId)
    .eq("status", "expected");
}

export async function licenseAccessCode(licenseId: string): Promise<{ status: string; access_code: string } | null> {
  const { data } = await supabaseAdmin.from("school_licenses").select("status, access_code").eq("id", licenseId).maybeSingle();
  return data ?? null;
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

// ── התאמת העברות בנקאיות ───────────────────────────────────────────────────────
// זיכויים מדף הבנק (statement_lines, נטען מהקובץ החודשי) מול תשלומים צפויים של
// רישיונות. ההצעה מוצגת במסך הרישיונות; "ודאי" (סכום + סמל/דרישה) מיושם גם
// בקרון היומי. שורת הבנק עצמה אינה משתנה: הסיווג שלה שייך לסוכן התקציב.

const CREDIT_FLOWS = ["income", "unknown"];

/** זיכויים בבנק שעדיין לא שויכו לתשלום של רישיון, מהתקופה האחרונה. */
export async function listUnmatchedBankCredits(days = 180): Promise<BankCredit[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [lines, linked] = await Promise.all([
    supabaseAdmin
      .from("statement_lines")
      .select("id, line_date, amount, description, reference")
      .eq("source", "bank")
      .gt("amount", 0)
      .in("flow", CREDIT_FLOWS)
      .neq("status", "ignored")
      .gte("line_date", since)
      .order("line_date", { ascending: false })
      .limit(500),
    supabaseAdmin.from("school_payments").select("statement_line_id").not("statement_line_id", "is", null),
  ]);
  if (lines.error) throw new SchoolsCrmError(lines.error.message, 500);
  if (linked.error) throw new SchoolsCrmError(linked.error.message, 500);
  const taken = new Set((linked.data ?? []).map((r) => r.statement_line_id as string));
  return (lines.data ?? [])
    .filter((l) => !taken.has(l.id))
    .map((l) => ({ id: l.id, line_date: l.line_date, amount: Number(l.amount), description: l.description ?? "", reference: l.reference ?? null }));
}

/** התשלומים הצפויים של רישיונות שממתינים לתשלום או פעילים, עם בית הספר. */
export async function listExpectedPayments(): Promise<ExpectedPayment[]> {
  const { data, error } = await supabaseAdmin
    .from("school_payments")
    .select("id, seq, amount_gross, due_date, proforma_number, license_id, school_licenses!inner(status, school_id, schools!inner(name, symbol))")
    .eq("status", "expected")
    .in("school_licenses.status", ["pending_payment", "active"]);
  if (error) throw new SchoolsCrmError(error.message, 500);
  type Lic = { school_id: string; schools: { name: string; symbol: string | null } | { name: string; symbol: string | null }[] };
  return (data ?? []).map((p) => {
    const lic = (Array.isArray(p.school_licenses) ? p.school_licenses[0] : p.school_licenses) as Lic;
    const school = Array.isArray(lic.schools) ? lic.schools[0] : lic.schools;
    return {
      id: p.id,
      seq: p.seq,
      amount_gross: Number(p.amount_gross),
      due_date: p.due_date,
      proforma_number: p.proforma_number,
      license_id: p.license_id,
      school_id: lic.school_id,
      school_name: school?.name ?? "",
      school_symbol: school?.symbol ?? null,
    };
  });
}

export type TransferProposal = BankCredit & { candidates: TransferCandidate[] };

/** זיכויים עם לפחות הצעה אחת, וכמה זיכויים נשארו בלי שום הצעה. */
export async function proposeTransferMatches(): Promise<{ proposals: TransferProposal[]; other_credits: number; expected: number }> {
  const [credits, expected] = await Promise.all([listUnmatchedBankCredits(), listExpectedPayments()]);
  const proposals: TransferProposal[] = [];
  let other = 0;
  for (const c of credits) {
    const candidates = matchTransferCandidates(c, expected);
    if (candidates.length) proposals.push({ ...c, candidates });
    else other++;
  }
  return { proposals, other_credits: other, expected: expected.length };
}

/** שיוך זיכוי מהבנק לתשלום צפוי: התשלום נרשם כהתקבל בהעברה, בתאריך של שורת הבנק. */
export async function matchTransfer(v: Viewer, paymentId: string, lineId: string, note?: string) {
  const [{ data: line, error: lErr }, { data: taken }, { data: payment }] = await Promise.all([
    supabaseAdmin.from("statement_lines").select("id, source, amount, line_date, description").eq("id", lineId).maybeSingle(),
    supabaseAdmin.from("school_payments").select("id").eq("statement_line_id", lineId).limit(1),
    supabaseAdmin.from("school_payments").select("id, status, amount_gross").eq("id", paymentId).maybeSingle(),
  ]);
  if (lErr) throw new SchoolsCrmError(lErr.message, 500);
  if (!line || line.source !== "bank" || Number(line.amount) <= 0) throw new SchoolsCrmError("שורת הבנק לא נמצאה, או שאינה זיכוי", 404);
  if ((taken?.length ?? 0) > 0) throw new SchoolsCrmError("שורת הבנק הזו כבר שויכה לתשלום", 409);
  if (!payment) throw new SchoolsCrmError("התשלום לא נמצא", 404);
  if (payment.status !== "expected") throw new SchoolsCrmError("התשלום הזה כבר נרשם", 409);
  const diff = Math.abs(Number(line.amount) - Number(payment.amount_gross));
  const base = note ?? `שויך לזיכוי בבנק מ-${line.line_date}: ${String(line.description).slice(0, 80)}`;
  return markPaymentReceived(v, paymentId, {
    method: "transfer",
    received_at: `${line.line_date}T12:00:00+03:00`,
    statement_line_id: lineId,
    note: diff > 1 ? `${base} (הועבר ${Number(line.amount)} ש"ח מול ${Number(payment.amount_gross)} צפוי)` : base,
  });
}

/**
 * מיישם את ההתאמות הוודאיות בלבד: זיכוי עם מועמד ודאי יחיד, שגם התשלום שלו
 * אינו מועמד ודאי של זיכוי אחר. רץ מהקרון היומי ומכפתור במסך.
 */
export async function autoMatchTransfers(v: Viewer): Promise<{ matched: number; skipped: number }> {
  const { proposals } = await proposeTransferMatches();
  const pairs: { lineId: string; paymentId: string }[] = [];
  for (const p of proposals) {
    const sure = p.candidates.filter(autoMatchable);
    if (sure.length === 1) pairs.push({ lineId: p.id, paymentId: sure[0].payment.id });
  }
  const perPayment = new Map<string, number>();
  for (const pr of pairs) perPayment.set(pr.paymentId, (perPayment.get(pr.paymentId) ?? 0) + 1);
  let matched = 0;
  let skipped = 0;
  for (const pr of pairs) {
    if ((perPayment.get(pr.paymentId) ?? 0) !== 1) {
      skipped++;
      continue;
    }
    try {
      await matchTransfer(v, pr.paymentId, pr.lineId);
      matched++;
    } catch (e) {
      skipped++;
      console.error("autoMatchTransfers:", e instanceof Error ? e.message : e);
    }
  }
  return { matched, skipped };
}

// ── מחיקות ────────────────────────────────────────────────────────────────────
// פתוחות לבעלים ולשותפה (החלטת הבעלים, 21/10/2026), עם גבול אחד לשניהם: מה
// שכבר נכנס בו כסף לא נמחק, כי הוא חלק מהתקבולים שהדוח הרבעוני וחלקה של
// השותפה מחושבים מהם. רישיון ששולם מבטלים (והחזר נרשם), לא מוחקים. כל מחיקה
// נרשמת ביומן של בית הספר; ליומן אין מפתח זר, ולכן הרישום נשאר גם אחרי
// שבית הספר עצמו נמחק.

/**
 * האם בתשלומי הרישיונות האלה נגע כסף: התקבל או הוחזר, יש לו מסמך ב-Sumit, או
 * שחיוב בכרטיס עליו נמצא עכשיו בתהליך (דף התשלום תפס אותו). כל אחד מאלה חוסם
 * מחיקה. הבדיקה והמחיקה הן שתי קריאות; החלון ביניהן קצר, ושתיהן פעולות ידניות.
 */
async function moneyTouched(licenseIds: string[]): Promise<boolean> {
  if (licenseIds.length === 0) return false;
  const { data, error } = await supabaseAdmin
    .from("school_payments")
    .select("status, method, sumit_document_id, updated_at")
    .in("license_id", licenseIds);
  if (error) throw new SchoolsCrmError(error.message, 500);
  return (data ?? []).some(
    (p) =>
      p.status === "received" ||
      p.status === "refunded" ||
      !!p.sumit_document_id ||
      (p.status === "expected" && p.method === "card" && Date.now() - Date.parse(p.updated_at as string) < CARD_CLAIM_MS),
  );
}

/**
 * גיבוי לפני מחיקה (REVIEW.md, סעיף 5): השורות שנמחקות נשמרות כ-JSON ב-crm_notes
 * עם entity_type 'school_backup'. אף מסך לא מציג אותן, והן לא נמחקות עם הישות;
 * שחזור הוא ידני, מהמסד. כישלון בגיבוי עוצר את המחיקה.
 */
async function backupBeforeDelete(v: Viewer, kind: string, id: string, payload: unknown): Promise<void> {
  const { error } = await supabaseAdmin.from("crm_notes").insert({
    entity_type: "school_backup",
    entity_id: id,
    body: JSON.stringify({ kind, deleted_by: v.name, deleted_at: new Date().toISOString(), payload }),
    author: v.name.slice(0, 60),
  });
  if (error) throw new SchoolsCrmError(`הגיבוי לפני המחיקה נכשל, ולכן לא נמחק דבר: ${error.message}`, 500);
}

/** משימות והערות של ישויות שנמחקו. אחרי שהמחיקה עצמה הצליחה, כישלון כאן רק נרשם. */
async function dropTasksAndNotes(entityIds: string[]): Promise<void> {
  if (entityIds.length === 0) return;
  const [t, n] = await Promise.all([
    supabaseAdmin.from("crm_tasks").delete().in("entity_type", [...SCHOOL_ENTITY_TYPES_LIST]).in("entity_id", entityIds),
    supabaseAdmin.from("crm_notes").delete().in("entity_type", [...SCHOOL_ENTITY_TYPES_LIST]).in("entity_id", entityIds),
  ]);
  if (t.error || n.error) console.error("schools delete: tasks/notes cleanup failed:", t.error?.message, n.error?.message);
}

const SCHOOL_ENTITY_TYPES_LIST = ["school", "school_owner", "school_deal", "school_license"];

async function rowOrThrow<T>(table: string, id: string, cols = "*"): Promise<T> {
  const { data, error } = await supabaseAdmin.from(table).select(cols).eq("id", id).maybeSingle();
  if (error) throw new SchoolsCrmError(error.message, 500);
  if (!data) throw new SchoolsCrmError("לא נמצא", 404);
  return data as T;
}

export async function deleteContact(v: Viewer, id: string) {
  const c = await rowOrThrow<{ school_id: string | null; name: string }>("school_contacts", id);
  await backupBeforeDelete(v, "school_contact", id, c);
  const { error } = await supabaseAdmin.from("school_contacts").delete().eq("id", id);
  if (error) throw new SchoolsCrmError(error.message, 500);
  if (c.school_id) await logActivity(v, "school", c.school_id, "system", `איש הקשר ${c.name} נמחק`);
}

export async function deleteTraining(v: Viewer, id: string) {
  const t = await rowOrThrow<{ school_id: string; held_on: string; topic: string | null }>("school_trainings", id);
  await backupBeforeDelete(v, "school_training", id, t);
  const { error } = await supabaseAdmin.from("school_trainings").delete().eq("id", id);
  if (error) throw new SchoolsCrmError(error.message, 500);
  await logActivity(v, "school", t.school_id, "system", `הדרכה מ-${t.held_on}${t.topic ? ` (${t.topic})` : ""} נמחקה`);
}

export async function deleteDeal(v: Viewer, id: string) {
  const d = await rowOrThrow<{ school_id: string | null; title: string | null; stage: string }>("school_deals", id);
  await backupBeforeDelete(v, "school_deal", id, d);
  const { error } = await supabaseAdmin.from("school_deals").delete().eq("id", id);
  if (error) throw new SchoolsCrmError(error.message, 500);
  await dropTasksAndNotes([id]);
  if (d.school_id) {
    await logActivity(v, "school", d.school_id, "system", `העסקה "${d.title ?? labelOf(DEAL_STAGES, d.stage)}" נמחקה`);
  }
}

export async function deleteLicense(v: Viewer, id: string) {
  const l = await rowOrThrow<{ school_id: string; kind: string; school_year: string }>("school_licenses", id);
  if (await moneyTouched([id])) {
    throw new SchoolsCrmError("ברישיון הזה כבר נגע כסף (תשלום שהתקבל או הוחזר, מסמך ב-Sumit, או חיוב בכרטיס בתהליך), ולכן הוא לא נמחק. מבטלים אותו במקום.", 409);
  }
  const { data: payments } = await supabaseAdmin.from("school_payments").select("*").eq("license_id", id);
  await backupBeforeDelete(v, "school_license", id, { license: l, payments: payments ?? [] });
  const { error } = await supabaseAdmin.from("school_licenses").delete().eq("id", id);
  if (error) throw new SchoolsCrmError(error.message, 500);
  await dropTasksAndNotes([id]);
  await logActivity(v, "school", l.school_id, "system", `רישיון ${labelOf(LICENSE_KINDS, l.kind)} לשנת ${l.school_year} נמחק`);
}

export async function deleteSchool(v: Viewer, id: string) {
  const s = await rowOrThrow<{ name: string; is_demo: boolean }>("schools", id);
  if (s.is_demo) throw new SchoolsCrmError("בית ספר ההדגמה משמש לבדיקות ולא נמחק", 409);
  const [lic, deals, contacts, trainings] = await Promise.all([
    supabaseAdmin.from("school_licenses").select("*, school_payments(*)").eq("school_id", id),
    supabaseAdmin.from("school_deals").select("*").eq("school_id", id),
    supabaseAdmin.from("school_contacts").select("*").eq("school_id", id),
    supabaseAdmin.from("school_trainings").select("*").eq("school_id", id),
  ]);
  for (const r of [lic, deals, contacts, trainings]) if (r.error) throw new SchoolsCrmError(r.error.message, 500);
  const licenseIds = (lic.data ?? []).map((r) => r.id as string);
  if (await moneyTouched(licenseIds)) {
    throw new SchoolsCrmError("בבית הספר הזה כבר נגע כסף (תשלום שהתקבל או הוחזר, מסמך ב-Sumit, או חיוב בכרטיס בתהליך), ולכן הוא לא נמחק. אפשר לסמן אותו 'לא רלוונטי'.", 409);
  }
  await backupBeforeDelete(v, "school", id, { school: s, licenses: lic.data, deals: deals.data, contacts: contacts.data, trainings: trainings.data });
  const { error } = await supabaseAdmin.from("schools").delete().eq("id", id);
  if (error) throw new SchoolsCrmError(error.message, 500);
  await dropTasksAndNotes([id, ...licenseIds, ...(deals.data ?? []).map((r) => r.id as string)]);
  await logActivity(v, "school", id, "system", `בית הספר "${s.name}" נמחק`);
}

export async function deleteOwner(v: Viewer, id: string) {
  const o = await rowOrThrow<{ name: string }>("school_owners", id);
  const [sc, dc, cc] = await Promise.all([
    supabaseAdmin.from("schools").select("id", { count: "exact", head: true }).eq("owner_id", id),
    supabaseAdmin.from("school_deals").select("id", { count: "exact", head: true }).eq("owner_id", id),
    supabaseAdmin.from("school_contacts").select("*").eq("owner_id", id),
  ]);
  // ספירה שנכשלה אינה "אפס": עסקאות וקשרים של הבעלות נמחקים איתה (cascade).
  for (const r of [sc, dc, cc]) if (r.error) throw new SchoolsCrmError(r.error.message, 500);
  const schools = sc.count;
  const deals = dc.count;
  if ((schools ?? 0) > 0) throw new SchoolsCrmError("יש בתי ספר בבעלות הזו. קודם משייכים אותם לבעלות אחרת או מנתקים.", 409);
  if ((deals ?? 0) > 0) throw new SchoolsCrmError("יש עסקאות על הבעלות הזו. קודם מוחקים אותן.", 409);
  await backupBeforeDelete(v, "school_owner", id, { owner: o, contacts: cc.data ?? [] });
  const { error } = await supabaseAdmin.from("school_owners").delete().eq("id", id);
  if (error) throw new SchoolsCrmError(error.message, 500);
  await dropTasksAndNotes([id]);
  await logActivity(v, "school_owner", id, "system", `הבעלות "${o.name}" נמחקה`);
}
