import "server-only";
import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { slugify } from "@/app/lib/articles";
import { TEACHER_TRIAL_DAYS } from "@/app/lib/teacher-options";
import type { TeacherRow } from "@/app/lib/teacher-match";

// עזרי שרת לענף המורים: טעינה לפי טוקן/slug, יצירת טוקן ו-slug, וסטטיסטיקה
// לכרטיס המורה ולאדמין. כל כתיבה למסד עוברת דרך ה-service role - לטבלת
// teachers אין שום מדיניות ציבורית.

export const TEACHER_FILES_BUCKET = process.env.SUPABASE_THERAPIST_FILES_BUCKET || "therapist-certificates";

/** העמודות שכרטיס התוצאה והפרופיל הציבורי צריכים. בלי מייל ובלי טוקן. */
export const TEACHER_PUBLIC_COLUMNS =
  "id, full_name, gender, slug, subjects, remedial, grade_groups, regions, online, languages, listing_state, paused_until, bio, phone, price_text, qualification, photo_path, experience_years";

export function newEditToken(): string {
  return randomBytes(24).toString("base64url");
}

/** slug ייחודי מהשם; בהתנגשות מוסיפים ספרות. */
export async function uniqueTeacherSlug(fullName: string): Promise<string> {
  const base = slugify(fullName) || "teacher";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${Math.floor(100 + Math.random() * 900)}`;
    const { data } = await supabaseAdmin.from("teachers").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export function trialEndDate(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + TEACHER_TRIAL_DAYS);
  return d;
}

export async function loadTeacherByToken(token: string) {
  if (!token || token.length > 120) return null;
  const { data } = await supabaseAdmin.from("teachers").select("*").eq("edit_token", token).maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

export async function loadListedTeacherBySlug(rawSlug: string): Promise<TeacherRow | null> {
  // ה-slug עברי, והפרמטר מגיע מקודד (%D7...). בלי הפענוח אף מורה לא נמצא/ה.
  let slug = rawSlug;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    /* keep raw */
  }
  if (!slug || slug.length > 200) return null;
  const { data } = await supabaseAdmin
    .from("teachers")
    .select(TEACHER_PUBLIC_COLUMNS)
    .eq("slug", slug)
    .in("listing_state", ["trial", "paying"])
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as TeacherRow;
  if (row.paused_until && new Date(row.paused_until).getTime() > Date.now()) return null;
  return row;
}

export type TeacherStats = {
  impressions_30d: number;
  contacts_30d: number;
  impressions_total: number;
  contacts_total: number;
  last_contact_at: string | null;
};

function emptyStats(): TeacherStats {
  return { impressions_30d: 0, contacts_30d: 0, impressions_total: 0, contacts_total: 0, last_contact_at: null };
}

/** הופעות ולחיצות קשר, לכל המורים שהתבקשו, בשאילתה אחת. */
export async function teacherStats(teacherIds: string[]): Promise<Record<string, TeacherStats>> {
  const out: Record<string, TeacherStats> = {};
  for (const id of teacherIds) out[id] = emptyStats();
  if (teacherIds.length === 0) return out;
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data } = await supabaseAdmin
    .from("teacher_events")
    .select("teacher_id, event_type, created_at")
    .in("teacher_id", teacherIds)
    .order("created_at", { ascending: false })
    .limit(20000);
  for (const e of (data ?? []) as { teacher_id: string; event_type: string; created_at: string }[]) {
    const s = out[e.teacher_id];
    if (!s) continue;
    const recent = e.created_at >= since30;
    if (e.event_type === "impression") {
      s.impressions_total++;
      if (recent) s.impressions_30d++;
    } else if (e.event_type === "whatsapp" || e.event_type === "phone") {
      s.contacts_total++;
      if (recent) s.contacts_30d++;
      if (!s.last_contact_at) s.last_contact_at = e.created_at;
    }
  }
  return out;
}

/** כתובת התמונה הציבורית (דרך ה-route שלנו, לא signed URL). */
export function teacherPhotoUrl(t: { id: string; photo_path: string | null }): string | null {
  return t.photo_path ? `/teacher-photo/${t.id}?v=${encodeURIComponent(t.photo_path.split("/").pop() ?? "")}` : null;
}
