import "server-only";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { slugify } from "@/app/lib/articles";
import { teacherDoorSupply, type TeacherRow } from "@/app/lib/teacher-match";
import { fetchAllRows } from "@/app/lib/fetch-all-rows";

import { TEACHER_LISTED_STATES, type TeacherSubject } from "@/app/lib/teacher-options";

export { teacherLinkUrl } from "@/app/lib/teacher-options";

// עזרי שרת לענף המורים: הזדהות המורה (עוגייה), טעינה לפי טוקן/slug, יצירת
// טוקן ו-slug, וסטטיסטיקה לכרטיס המורה ולאדמין. כל כתיבה למסד עוברת דרך
// ה-service role - לטבלת teachers אין שום מדיניות ציבורית.

export const TEACHER_FILES_BUCKET = process.env.SUPABASE_THERAPIST_FILES_BUCKET || "therapist-certificates";

/** העמודות שכרטיס התוצאה והפרופיל הציבורי צריכים. בלי מייל ובלי טוקן. */
export const TEACHER_PUBLIC_COLUMNS =
  "id, full_name, gender, slug, subjects, remedial, grade_groups, regions, online, languages, listing_state, paused_until, bio, phone, price_text, qualification, photo_path, experience_years, expertise, focuses, lesson_settings";

export function newEditToken(): string {
  return randomBytes(24).toString("base64url");
}

// ── הזדהות המורה ────────────────────────────────────────────────────────────
//
// למורה אין חשבון: הקישור האישי (/learning/k/<token>) הוא המפתח. הטוקן עצמו
// לא נשאר בכתובת של אף עמוד - ה-route של הקישור שם אותו בעוגיית HttpOnly
// ומפנה ל-/learning/me. הסיבה: ה-layout טוען GA4, Google Ads, טאבולה ו-
// Vercel Analytics, וכולם רושמים את כתובת העמוד. טוקן קבוע בכתובת היה
// נשלח לארבעתם בכל כניסה של המורה לפרופיל.

export const TEACHER_COOKIE = "mnt_teacher";
const COOKIE_MAX_AGE = 180 * 24 * 60 * 60;

export function setTeacherCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(TEACHER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}

function cookieValue(req: Request, name: string): string | null {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * בקשת כתיבה שהגיעה מאתר אחר. העוגייה היא SameSite=Lax, כך שדפדפן עדכני
 * ממילא לא מצרף אותה ל-POST חוצה-אתרים; זו שכבה שנייה, באותו כלל של
 * ה-middleware של האדמין: Origin קיים וזר - נדחה.
 */
export function crossSiteWrite(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.get("host");
  } catch {
    return true;
  }
}

export async function loadTeacherByToken(token: string | null | undefined) {
  if (!token || token.length < 20 || token.length > 120) return null;
  const { data } = await supabaseAdmin.from("teachers").select("*").eq("edit_token", token).maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

/** המורה שמחובר/ת בבקשה הזו (לפי העוגייה), או null. */
export async function loadTeacherFromRequest(req: Request) {
  return loadTeacherByToken(cookieValue(req, TEACHER_COOKIE));
}

// ── slug ─────────────────────────────────────────────────────────────────────

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
    .in("listing_state", [...TEACHER_LISTED_STATES])
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as TeacherRow;
  if (row.paused_until && new Date(row.paused_until).getTime() > Date.now()) return null;
  return row;
}

// ── ההיצע של הדלת הציבורית ──────────────────────────────────────────────────

type SupplyRow = Pick<TeacherRow, "subjects" | "listing_state" | "paused_until">;

/**
 * כמה מורים מוצגים כרגע, ובאילו תחומים - לעמוד /learning. החיפוש הישיר מוצג
 * רק כשיש את מי להציג. שגיאת קריאה נחשבת כמאגר ריק: העמוד עולה בלי טופס
 * החיפוש במקום ליפול.
 */
export async function loadDoorSupply(): Promise<{ total: number; subjects: TeacherSubject[] }> {
  try {
    const rows = await fetchAllRows<SupplyRow>(
      () =>
        supabaseAdmin
          .from("teachers")
          .select("subjects, listing_state, paused_until")
          .in("listing_state", [...TEACHER_LISTED_STATES])
          .order("id") as unknown as { range: (from: number, to: number) => PromiseLike<{ data: SupplyRow[] | null; error: { message: string } | null }> },
    );
    return teacherDoorSupply(rows);
  } catch (e) {
    console.error("loadDoorSupply failed:", e instanceof Error ? e.message : e);
    return { total: 0, subjects: [] };
  }
}

// ── סטטיסטיקה ────────────────────────────────────────────────────────────────

export type TeacherStats = {
  impressions_30d: number;
  contacts_30d: number;
  profile_views_30d: number;
  impressions_total: number;
  contacts_total: number;
  last_contact_at: string | null;
};

export function emptyTeacherStats(): TeacherStats {
  return { impressions_30d: 0, contacts_30d: 0, profile_views_30d: 0, impressions_total: 0, contacts_total: 0, last_contact_at: null };
}

/**
 * הופעות ולחיצות קשר לכל המורים שהתבקשו. הספירה נעשית ב-SQL
 * (teacher_event_stats): קריאת השורות עצמן נחתכת ב-1000 בשקט, וכל חיפוש
 * כותב עד עשר שורות הופעה.
 */
export async function teacherStats(teacherIds: string[]): Promise<Record<string, TeacherStats>> {
  const out: Record<string, TeacherStats> = {};
  for (const id of teacherIds) out[id] = emptyTeacherStats();
  for (let i = 0; i < teacherIds.length; i += 500) {
    const chunk = teacherIds.slice(i, i + 500);
    const { data, error } = await supabaseAdmin.rpc("teacher_event_stats", { p_ids: chunk });
    if (error) {
      console.error("teacher_event_stats failed:", error.message);
      continue;
    }
    for (const r of (data ?? []) as (TeacherStats & { teacher_id: string })[]) {
      out[r.teacher_id] = {
        impressions_30d: Number(r.impressions_30d) || 0,
        contacts_30d: Number(r.contacts_30d) || 0,
        profile_views_30d: Number(r.profile_views_30d) || 0,
        impressions_total: Number(r.impressions_total) || 0,
        contacts_total: Number(r.contacts_total) || 0,
        last_contact_at: r.last_contact_at ?? null,
      };
    }
  }
  return out;
}

/** כתובת התמונה הציבורית (דרך ה-route שלנו, לא signed URL). */
export function teacherPhotoUrl(t: { id: string; photo_path: string | null }): string | null {
  return t.photo_path ? `/teacher-photo/${t.id}?v=${encodeURIComponent(t.photo_path.split("/").pop() ?? "")}` : null;
}

/** רישום שורה בהיסטוריה של המורה (crm_notes) - מוצג באדמין. לא מפיל את הקריאה. */
export async function teacherNote(teacherId: string, body: string, author = "system"): Promise<void> {
  try {
    await supabaseAdmin.from("crm_notes").insert({ entity_type: "teacher", entity_id: teacherId, body: body.slice(0, 4000), author });
  } catch (e) {
    console.error("teacherNote failed:", e instanceof Error ? e.message : e);
  }
}
