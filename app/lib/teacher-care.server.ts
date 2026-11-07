import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { fetchAllRows } from "./fetch-all-rows";
import { syncAgentAlerts } from "./agent-infra";
import { teacherStats } from "./teachers.server";
import { CARE_TEMPLATES } from "./teacher-email-templates";
import { FOUNDING_TEACHERS, careDedupeKey, careFindings, type CareFinding, type CareTeacher } from "./teacher-care";

// הצד של המסד של "טיפול בפרופילים": טוען את המורים, את המספרים ואת
// המיילים שכבר נשלחו, מפעיל את הכללים (teacher-care.ts) וכותב את הטיוטות
// לתור ההצעות (agent_actions, סוכן teacher_care). רץ מהקרון היומי של
// המורים ומכפתור "בדיקה עכשיו" באדמין. לא שולח דבר.

export const TEACHER_CARE_AGENT = "teacher_care";
const DRAFT_KINDS = Object.keys(CARE_TEMPLATES);

type Row = {
  id: string;
  full_name: string;
  gender: string | null;
  listing_state: string;
  created_at: string;
  approved_at: string | null;
  remedial: boolean;
  qualification: string | null;
  institution: string | null;
  bio: string | null;
  price_text: string | null;
  focuses: string[] | null;
  expertise: string[] | null;
  certificate_path: string | null;
  photo_path: string | null;
};

export async function loadCareTeachers(): Promise<CareTeacher[]> {
  const rows = await fetchAllRows<Row>(() =>
    supabaseAdmin
      .from("teachers")
      .select("id, full_name, gender, listing_state, created_at, approved_at, remedial, qualification, institution, bio, price_text, focuses, expertise, certificate_path, photo_path")
      .in("listing_state", ["pending", "trial", "paying"])
      .order("id"),
  );
  return rows.map((r) => ({ ...r, has_certificate: !!r.certificate_path, has_photo: !!r.photo_path }));
}

/** לכל מורה: תבנית טיפול → מתי נשלחה לאחרונה. */
export async function loadCareLastSent(teacherIds: string[]): Promise<Record<string, Record<string, string>>> {
  const out: Record<string, Record<string, string>> = {};
  if (teacherIds.length === 0) return out;
  const templates = Object.values(CARE_TEMPLATES);
  for (let i = 0; i < teacherIds.length; i += 300) {
    const { data, error } = await supabaseAdmin
      .from("crm_email_log")
      .select("entity_id, template, created_at")
      .in("entity_id", teacherIds.slice(i, i + 300))
      .in("template", templates)
      .eq("status", "sent")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const id = String(r.entity_id);
      const tpl = String(r.template);
      out[id] ??= {};
      if (!out[id][tpl]) out[id][tpl] = String(r.created_at);
    }
  }
  return out;
}

/** המורים הראשונים שאושרו אי פעם, כולל מי שעבר לארכיון, כדי שהסדר לא יזוז. */
export async function loadFoundingIds(): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from("teachers")
    .select("id")
    .not("approved_at", "is", null)
    .order("approved_at", { ascending: true })
    .limit(FOUNDING_TEACHERS);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => String(r.id)));
}

export async function computeCareFindings(now = new Date()): Promise<{ teachers: CareTeacher[]; findings: CareFinding[] }> {
  const teachers = await loadCareTeachers();
  const ids = teachers.map((t) => t.id);
  const [stats, lastSent, foundingIds] = await Promise.all([teacherStats(ids), loadCareLastSent(ids), loadFoundingIds()]);
  const findings = careFindings({
    teachers,
    stats: Object.fromEntries(ids.map((id) => [id, { impressions_total: stats[id]?.impressions_total ?? 0, contacts_total: stats[id]?.contacts_total ?? 0 }])),
    lastSent,
    foundingIds,
    now,
  });
  return { teachers, findings };
}

/**
 * מפעיל את הכללים וכותב את הטיוטות לתור. טיוטה שהסיבה שלה נעלמה (התמונה
 * הועלתה, התעודה צורפה) נסגרת מעצמה; טיוטה שהבעלים דחה לא חוזרת 30 יום.
 */
export async function runTeacherCare(now = new Date()) {
  const { teachers, findings } = await computeCareFindings(now);
  const drafts = findings.filter((f) => f.draft);
  const managedKeys = teachers.flatMap((t) => DRAFT_KINDS.map((k) => careDedupeKey(t.id, k as CareFinding["kind"])));
  const synced = await syncAgentAlerts(
    TEACHER_CARE_AGENT,
    drafts.map((f) => {
      const teacher = teachers.find((t) => t.id === f.teacherId);
      return {
        actionType: f.kind,
        kind: "action" as const,
        severity: f.severity,
        title: f.title,
        body: f.draft!.body,
        entityType: "teacher",
        entityId: f.teacherId,
        entityLabel: teacher?.full_name,
        payload: { kind: f.kind, template: f.draft!.template, subject: f.draft!.subject, body: f.draft!.body },
        dedupeKey: f.dedupeKey,
      };
    }),
    { managedKeys, recoveryNote: "הפרופיל הושלם או השתנה, הטיוטה כבר לא נדרשת", snoozeDays: 30 },
  );
  return { teachers: teachers.length, findings: findings.length, drafts: drafts.length, ...synced };
}

export type CareDraftRow = {
  id: string;
  entity_id: string;
  action_type: string;
  severity: string;
  title: string;
  created_at: string;
  payload: { kind: string; template: string; subject: string; body: string };
};

/** הטיוטות הפתוחות, לפי מורה, לכרטיס המורה ולרשימת "דורש טיפול". */
export async function loadPendingCareDrafts(): Promise<Record<string, CareDraftRow[]>> {
  const { data, error } = await supabaseAdmin
    .from("agent_actions")
    .select("id, entity_id, action_type, severity, title, created_at, payload")
    .eq("agent", TEACHER_CARE_AGENT)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);
  const out: Record<string, CareDraftRow[]> = {};
  for (const r of (data ?? []) as CareDraftRow[]) {
    if (!r.entity_id || !r.payload?.template) continue;
    (out[r.entity_id] ??= []).push(r);
  }
  return out;
}
