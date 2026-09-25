import { onlineTopicSlugs, slugToCityTopic, MIN_ONLINE_TOPIC, type OnlineTopicSlug } from "@/app/lib/topics";
import { countListed } from "@/app/lib/therapist-directory";
import { ONLINE_COPY } from "@/app/lib/online-copy";

/**
 * The online page of a national topic or approach page, when one is live.
 *
 * Until 25/9/2026 the online×topic pages were linked only from the online hub
 * and from each other, while /therapists/topic/<slug> and
 * /therapists/specialty/<name> - older pages with more links of their own -
 * pointed at the generic hub. This lets each point at its own online twin,
 * with the twin's H1 as the anchor ("טיפול זוגי וייעוץ זוגי אונליין").
 *
 * Gated like the twin's own indexability, so a thin (noindex) online page is
 * never linked from here.
 */
export async function onlineTwinFor(slugOrName: string): Promise<{ href: string; label: string } | null> {
  const slug = slugOrName.replace(/\s+/g, "-");
  if (!(onlineTopicSlugs() as string[]).includes(slug)) return null;
  const topic = slugToCityTopic(slug);
  if (!topic || topic.adsOnly) return null;
  if ((await countListed({ ...topic.filter, online: true })) < MIN_ONLINE_TOPIC) return null;
  return { href: `/therapists/online/${slug}`, label: ONLINE_COPY[slug as OnlineTopicSlug].h1 };
}
