// The weekly post on the company's Facebook page: one approved article by one of the
// site's writers, shared once a week.
//
// Nothing here reads or writes Facebook. The owner opens /admin/fb-page-posts once a
// month, copies each post and schedules it himself in Meta Business Suite; no code and
// no agent touches the Meta account (the account has been blocked four times). This
// file is pure: which day, which article, which words, which link.

/** The posting day: Tuesday, a weekday evening away from the weekend. 0 = Sunday. */
export const SLOT_WEEKDAY = 2;
export const SLOT_TIME = "20:30";
/** How many weeks ahead the queue is kept full: one sitting a month schedules them all. */
export const WEEKS_AHEAD = 4;

const SITE = "https://www.mentalytics.co.il";
const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const MAX_LEAD = 300;
/** A summary shorter than this is a subtitle, not a sentence: the title leads instead. */
const MIN_LEAD = 40;

export type PostStatus = "planned" | "scheduled" | "skipped";

export type PostArticle = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  approved_at: string | null;
  /** Who wrote it, for the rotation: the therapist id (or the house name). */
  author_key: string;
  /** As the article page shows it: the house name if set, else the therapist's name. */
  author: string;
  /** The therapist's profession in the right gender; empty for a house byline. */
  role: string;
};

export type QueuedPost = { article_id: string; planned_on: string; status: PostStatus };

/** Today's date in Israel, YYYY-MM-DD. */
export function israelDate(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekday(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

/** The next `count` posting days after `today` (today itself is too late to schedule). */
export function nextSlots(today: string, count: number = WEEKS_AHEAD): string[] {
  const out: string[] = [];
  let d = addDays(today, 1);
  while (out.length < count) {
    if (weekday(d) === SLOT_WEEKDAY) out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

/** "שלישי 20.10" */
export function dayLabel(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${DAY_NAMES[weekday(iso)]} ${d}.${m}`;
}

/**
 * The next article to share. Never one already in the queue (a replaced one included).
 * Among the rest: with a picture first (the link preview shows it), then the writer
 * whose last post is the oldest (a writer never posted comes first), then the newest.
 */
export function pickArticle(articles: PostArticle[], queue: QueuedPost[]): PostArticle | null {
  const used = new Set(queue.map((q) => q.article_id));
  const byId = new Map(articles.map((a) => [a.id, a]));
  const lastPost = new Map<string, string>();
  for (const q of queue) {
    if (q.status === "skipped") continue;
    const a = byId.get(q.article_id);
    if (!a) continue;
    const prev = lastPost.get(a.author_key);
    if (!prev || q.planned_on > prev) lastPost.set(a.author_key, q.planned_on);
  }
  const candidates = articles.filter((a) => !used.has(a.id));
  candidates.sort(
    (x, y) =>
      Number(Boolean(y.image_url)) - Number(Boolean(x.image_url)) ||
      (lastPost.get(x.author_key) ?? "").localeCompare(lastPost.get(y.author_key) ?? "") ||
      (y.approved_at ?? "").localeCompare(x.approved_at ?? "") ||
      x.id.localeCompare(y.id)
  );
  return candidates[0] ?? null;
}

/**
 * The writer's own summary, tidied for a post: one space between words, no blank
 * lines, no long dashes (house rule), and at most about 300 characters, cut at the
 * end of a sentence where one is near.
 */
export function cleanSummary(summary: string | null): string {
  if (!summary) return "";
  let t = summary
    .replace(/[–—]/g, "-")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
  if (t.length <= MAX_LEAD) return t;
  const cut = t.slice(0, MAX_LEAD);
  let end = -1;
  for (const m of cut.matchAll(/[.?!](?=\s|$)/g)) end = m.index ?? end;
  t = end >= MAX_LEAD / 3 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" ")).trim()}…`;
  return t;
}

/**
 * The words of the post. It opens with the writer's summary (the link preview below
 * it already carries the title and the picture), or with the title when there is no
 * real summary, and credits the writer.
 */
export function buildPostText(a: PostArticle): string {
  const summary = cleanSummary(a.summary);
  // A summary is a sentence and ends like one; a title stands as it is.
  const lead = summary.length >= MIN_LEAD ? (/[.?!…"]$/.test(summary) ? summary : `${summary}.`) : a.title.trim();
  const by = a.role ? `${a.author}, ${a.role}` : a.author;
  const credit = a.author.includes("טיפול חכם") ? `מאמר מאת ${by}.` : `מאמר מאת ${by}, מכותבי טיפול חכם.`;
  return `${lead}\n\n${credit}`;
}

/** Each post is its own campaign, by its day, so its visits can be counted. */
export function campaignFor(plannedOn: string): string {
  return `page-${plannedOn.replace(/-/g, "")}`;
}

/**
 * The link under the post. utm_medium=social files the visit as organic Meta, not
 * as an ad: a visitor from a page post is not a paid visitor and sees every therapist.
 */
export function postLink(slug: string, plannedOn: string): string {
  return `${SITE}/research/community/${encodeURIComponent(slug)}?utm_source=facebook&utm_medium=social&utm_campaign=${campaignFor(plannedOn)}`;
}

/** What the copy button puts on the clipboard: the words, then the link on its own line. */
export function copyText(postText: string, link: string): string {
  return `${postText.trim()}\n\n${link}`;
}
