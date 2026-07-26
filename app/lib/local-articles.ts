import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { CITY_TO_REGION } from "./regions";

// Approved therapist-written articles matched to a locality, for the
// "מאמרים ממטפלים ב{מקום}" section on city/region/online landing pages.
// Matching: city page → author listed that city; region page → any of the
// author's cities maps to the region; online page → author works online.
// House/editorial pieces (author_name set) are excluded - they aren't a local
// therapist's own writing.

export type LocalArticle = {
  slug: string;
  title: string;
  summary: string | null;
  author: string;
};

type Row = {
  slug: string;
  title: string;
  summary: string | null;
  therapists: { full_name: string | null; regions: string[] | null; online: boolean | null } | null;
};

// Approved therapist articles matched by TOPIC (therapist_articles.topic) -
// for the specialty landing pages ("מאמרים בנושא" under טיפול זוגי etc.).
export async function loadArticlesByTopics(topics: string[], limit = 4): Promise<LocalArticle[]> {
  if (topics.length === 0) return [];
  const { data } = await supabaseAdmin
    .from("therapist_articles")
    .select("slug, title, summary, topic, therapists(full_name)")
    .eq("status", "approved")
    .is("author_name", null)
    .in("topic", topics)
    .order("approved_at", { ascending: false })
    .limit(limit);

  const rows = (data ?? []) as unknown as { slug: string; title: string; summary: string | null; therapists: { full_name: string | null } | null }[];
  return rows
    .filter((r) => r.therapists?.full_name)
    .map((r) => ({ slug: r.slug, title: r.title, summary: r.summary, author: r.therapists!.full_name! }));
}

export async function loadLocalArticles(
  place: { city: string } | { region: string } | { online: true },
  limit = 6
): Promise<LocalArticle[]> {
  const { data } = await supabaseAdmin
    .from("therapist_articles")
    .select("slug, title, summary, therapists(full_name, regions, online)")
    .eq("status", "approved")
    .is("author_name", null)
    .order("approved_at", { ascending: false })
    .limit(60);

  const rows = (data ?? []) as unknown as Row[];
  const matches = rows.filter((r) => {
    const t = r.therapists;
    if (!t?.full_name) return false;
    if ("online" in place) return t.online === true;
    if ("city" in place) return (t.regions ?? []).includes(place.city);
    return (t.regions ?? []).some((c) => CITY_TO_REGION[c] === place.region || c === place.region);
  });

  return matches.slice(0, limit).map((r) => ({
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    author: r.therapists!.full_name!,
  }));
}
