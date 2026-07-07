import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { slugify } from "@/app/lib/articles";

// עזרי העמוד הציבורי של המרכז (/centers/<slug>).

export type PublicCenter = {
  id: string;
  name: string;
  slug: string;
  public_description: string | null;
  public_managers: string | null;
  public_city: string | null;
  public_website: string | null;
  public_phone: string | null;
};

const PUBLIC_COLS =
  "id, name, slug, public_description, public_managers, public_city, public_website, public_phone";

// slug ייחודי מתוך שם המרכז. אם ה-slug הבסיסי תפוס ע"י מרכז אחר — מוסיפים
// סיומת מספרית. excludeId מאפשר לשמור על ה-slug של המרכז עצמו בעדכון.
export async function ensureUniqueCenterSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name) || "center";
  const { data } = await supabaseAdmin
    .from("therapy_center_accounts")
    .select("id, slug")
    .like("slug", `${base}%`);
  const taken = new Set(
    (data ?? []).filter((r) => r.id !== excludeId && r.slug).map((r) => r.slug as string),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

// טוען מרכז לעמוד הציבורי — רק אם פעיל, העמוד מודלק, ויש slug. cache() מדדד
// בין generateMetadata לרינדור הדף באותה בקשה. מחזיר null אם אינו זמין לציבור.
export const getPublicCenterBySlug = cache(async (slug: string): Promise<PublicCenter | null> => {
  const { data } = await supabaseAdmin
    .from("therapy_center_accounts")
    .select(PUBLIC_COLS)
    .eq("slug", slug)
    .eq("status", "active")
    .eq("public_page_enabled", true)
    .maybeSingle();
  return (data as PublicCenter | null) ?? null;
});

// כל המרכזים שעמודם הציבורי פעיל — ל-sitemap.
export async function listPublicCenters(): Promise<{ slug: string; updated_at: string | null }[]> {
  const { data } = await supabaseAdmin
    .from("therapy_center_accounts")
    .select("slug, updated_at")
    .eq("status", "active")
    .eq("public_page_enabled", true)
    .not("slug", "is", null);
  return (data ?? []) as { slug: string; updated_at: string | null }[];
}
