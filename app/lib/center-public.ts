import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { slugify } from "@/app/lib/articles";

// עזרי העמוד הציבורי של המרכז (/centers/<slug>).

export type CenterTeamMember = { name: string; role: string; photo_path: string | null };
export type CenterGalleryPhoto = { path: string; caption: string | null };

export type PublicCenter = {
  id: string;
  name: string;
  slug: string;
  billing_track: string | null;
  public_description: string | null;
  public_managers: string | null;
  public_city: string | null;
  public_website: string | null;
  public_phone: string | null;
  logo_path: string | null;
  team_members: CenterTeamMember[];
  gallery: CenterGalleryPhoto[];
};

const PUBLIC_COLS =
  "id, name, slug, billing_track, public_description, public_managers, public_city, public_website, public_phone, logo_path, team_members, gallery";

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
  // ה-param מגיע percent-encoded עבור slug עברי (כמו slugToRegion) — לפענח לפני ההשוואה.
  let decoded: string;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    return null; // קידוד שבור — לא נמצא
  }
  const { data } = await supabaseAdmin
    .from("therapy_center_accounts")
    .select(PUBLIC_COLS)
    .eq("slug", decoded)
    .eq("status", "active")
    // מרכז מסלול-2 (כישות) גלוי כשהוא פעיל — הפרופיל הוא המוצר; מסלול 1 דורש הדלקה.
    .or("public_page_enabled.eq.true,billing_track.eq.center_entity")
    .maybeSingle();
  if (!data) return null;
  const c = data as Record<string, unknown>;
  return {
    ...(c as unknown as PublicCenter),
    team_members: Array.isArray(c.team_members) ? (c.team_members as CenterTeamMember[]) : [],
    gallery: Array.isArray(c.gallery) ? (c.gallery as CenterGalleryPhoto[]) : [],
  };
});

// חתימת URLs ללוגו, לתמונות הצוות ולגלריה (bucket פרטי). מחושב בצד-שרת בכל רינדור עמוד.
export async function signCenterAssets(
  center: { logo_path: string | null; team_members: CenterTeamMember[]; gallery?: CenterGalleryPhoto[] },
): Promise<{
  logoUrl: string | null;
  team: { name: string; role: string; photoUrl: string | null }[];
  gallery: { path: string; caption: string | null; url: string | null }[];
}> {
  const galleryItems = center.gallery ?? [];
  const paths: string[] = [];
  if (center.logo_path) paths.push(center.logo_path);
  for (const m of center.team_members) if (m.photo_path) paths.push(m.photo_path);
  for (const g of galleryItems) if (g.path) paths.push(g.path);
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabaseAdmin.storage.from("therapist-certificates").createSignedUrls(paths, 60 * 60 * 24);
    (data ?? []).forEach((s, i) => { if (s.signedUrl) urlByPath.set(paths[i], s.signedUrl); });
  }
  return {
    logoUrl: center.logo_path ? (urlByPath.get(center.logo_path) ?? null) : null,
    team: center.team_members.map((m) => ({
      name: m.name,
      role: m.role,
      photoUrl: m.photo_path ? (urlByPath.get(m.photo_path) ?? null) : null,
    })),
    gallery: galleryItems.map((g) => ({
      path: g.path,
      caption: g.caption ?? null,
      url: g.path ? (urlByPath.get(g.path) ?? null) : null,
    })),
  };
}

// כל המרכזים שעמודם הציבורי פעיל — ל-sitemap. אותם תנאי גלוי כמו
// getPublicCenterBySlug: הדלקה מפורשת, או מרכז מסלול-2 (העמוד הוא המוצר).
export async function listPublicCenters(): Promise<{ slug: string; updated_at: string | null }[]> {
  const { data } = await supabaseAdmin
    .from("therapy_center_accounts")
    .select("slug, updated_at")
    .eq("status", "active")
    .or("public_page_enabled.eq.true,billing_track.eq.center_entity")
    .not("slug", "is", null);
  return (data ?? []) as { slug: string; updated_at: string | null }[];
}
