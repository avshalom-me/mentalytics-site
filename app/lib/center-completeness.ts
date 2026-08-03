import "server-only";
import type { CenterDirector, CenterFaqItem, CenterGalleryPhoto, CenterTeamMember } from "./center-public";

// חישוב שלמות הפרופיל הציבורי של מרכז מנתוני ה-DB — צד-שרת (מייל התזכורת).
// אותם 10 פריטים כמו מד-השלמות החי בעורך הפורטל (PublicPageEditor); אם
// משנים שם — לעדכן גם כאן.

export type CenterRowForCompleteness = {
  logo_path: string | null;
  public_description: string | null;
  team_members: unknown;
  gallery: unknown;
  public_director: unknown;
  public_founded_year: number | null;
  public_team_size: number | null;
  public_address: string | null;
  public_hours: string | null;
  public_faq: unknown;
};

export function centerProfileCompleteness(c: CenterRowForCompleteness): { pct: number; missing: string[] } {
  const team = Array.isArray(c.team_members) ? (c.team_members as CenterTeamMember[]) : [];
  const gallery = Array.isArray(c.gallery) ? (c.gallery as CenterGalleryPhoto[]) : [];
  const faq = Array.isArray(c.public_faq) ? (c.public_faq as CenterFaqItem[]) : [];
  const director =
    c.public_director && typeof c.public_director === "object" && !Array.isArray(c.public_director)
      ? (c.public_director as CenterDirector)
      : {};

  const items: { label: string; done: boolean }[] = [
    { label: "לוגו המרכז", done: !!c.logo_path },
    { label: "תיאור המרכז", done: (c.public_description ?? "").trim().length >= 40 },
    { label: "איש/אשת צוות אחד לפחות", done: team.some((m) => (m.name ?? "").trim().length > 0) },
    { label: "2+ תמונות של המרכז", done: gallery.length >= 2 },
    { label: 'דבר המנהל/ת ("אני מאמין")', done: !!((director.name ?? "").trim() && (director.note ?? "").trim()) },
    { label: "שנת ייסוד", done: c.public_founded_year != null },
    { label: "גודל הצוות", done: c.public_team_size != null },
    { label: "כתובת", done: (c.public_address ?? "").trim().length > 0 },
    { label: "שעות פעילות", done: (c.public_hours ?? "").trim().length > 0 },
    { label: "שאלה נפוצה אחת לפחות", done: faq.some((f) => (f.q ?? "").trim() && (f.a ?? "").trim()) },
  ];
  const missing = items.filter((i) => !i.done).map((i) => i.label);
  const pct = Math.round(((items.length - missing.length) / items.length) * 100);
  return { pct, missing };
}
