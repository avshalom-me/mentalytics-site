"use client";

import type { MissingKey } from "@/app/lib/teacher-care";

// עזרים משותפים למסכי ענף לימוד חכם באדמין: הטיפוסים שה-API מחזיר, עיצוב,
// ותאריכים. ה-API: app/api/admin-teachers (רשימה, פעולות), /overview, /upload.

export type TeacherStats = { impressions_30d: number; contacts_30d: number; profile_views_30d: number; impressions_total: number; contacts_total: number; last_contact_at: string | null };
export type CareDraft = {
  id: string;
  action_type: string;
  severity: string;
  title: string;
  created_at: string;
  payload: { kind: string; template: string; subject: string; body: string };
};
export type Teacher = {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string | null;
  gender: string | null;
  slug: string | null;
  subjects: string[];
  remedial: boolean;
  grade_groups: string[];
  regions: string[];
  online: boolean;
  expertise: string[] | null;
  focuses: string[] | null;
  lesson_settings: string[] | null;
  languages: string[];
  price_text: string | null;
  bio: string | null;
  qualification: string | null;
  institution: string | null;
  qualification_year: number | null;
  teaching_certificate: boolean;
  experience_years: number | null;
  has_certificate: boolean;
  has_photo: boolean;
  photo_url: string | null;
  declared_no_record: boolean;
  listing_state: string;
  approved_at: string | null;
  trial_ends_at: string | null;
  archived_at: string | null;
  paused_until: string | null;
  reject_reason: string | null;
  sumit_recurring_id: string | null;
  sumit_cancelled_at: string | null;
  signup_channel: string | null;
  signup_utm_source: string | null;
  signup_utm_campaign: string | null;
  signup_source: string;
  edit_url: string;
  stats: TeacherStats;
  care: { missing: MissingKey[]; done: number; total: number; hint: "marked" | "hinted" | null };
  drafts: CareDraft[];
};

export const btn = "rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-bold text-stone-600 hover:bg-stone-100 disabled:opacity-50";
export const btnPrimary = "rounded-full bg-[#3D8C8A] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#2A6462] disabled:opacity-50";
export const btnGold = "rounded-full bg-[#D49018] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#A87010] disabled:opacity-50";
export const btnDanger = "rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50";
export const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm";

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric", year: "2-digit" });
}
export function fmtStamp(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric", year: "2-digit" })} ${d.toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hour12: false })}`;
}
export const daysSince = (iso: string | null | undefined) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)) : 0);

export async function getJson<T = Record<string, unknown>>(url: string): Promise<T & { ok: boolean; error?: string }> {
  const r = await fetch(url, { cache: "no-store" });
  const j = (await r.json().catch(() => null)) as (T & { ok: boolean; error?: string }) | null;
  return j ?? ({ ok: false, error: `השרת החזיר ${r.status}. אפשר לרענן ולנסות שוב.` } as T & { ok: boolean; error?: string });
}

export async function patchTeacher(id: string, action: string, extra: Record<string, unknown> = {}) {
  const r = await fetch("/api/admin-teachers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, ...extra }) });
  const j = (await r.json().catch(() => null)) as { ok: boolean; error?: string; mail?: { status: string; error?: string } } | null;
  return j ?? { ok: false, error: `השרת החזיר ${r.status}. אפשר לרענן ולנסות שוב.` };
}

/** תוויות ערוצי ההרשמה בגרף ובטבלת הגיוס. */
export const SIGNUP_CHANNEL_LABELS: Record<string, string> = {
  ai: "עוזרי AI (ChatGPT ודומיו)",
  community: "קבוצות ופייסבוק",
  google: "גוגל",
  direct: "ישירות",
  other: "אחר",
};
export const VIEW_SOURCE_LABELS: Record<string, string> = { google: "גוגל", ai: "עוזרי AI", direct: "ישירות", social: "רשתות חברתיות", other: "אחר" };
